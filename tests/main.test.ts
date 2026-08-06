import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSystemAdapter, resetState, state } from '../tests/mocks/obsidian';
import VaultPowerShellPlugin, { type PluginDeps } from '../src/main';

const spawnState = vi.hoisted(() => ({
  spawns: [] as Array<[string, string[], Record<string, unknown>]>,
  /** Number of initial spawns that should emit ENOENT before succeeding. */
  failSpawnCount: 0,
}));

vi.mock('node:child_process', () => {
  const makeChild = () => {
    const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
    return {
      pid: 777,
      unref() {},
      once(event: string, fn: (...args: unknown[]) => void) {
        const list = handlers.get(event) ?? [];
        list.push(fn);
        handlers.set(event, list);
      },
      emit(event: string, ...args: unknown[]) {
        for (const fn of handlers.get(event) ?? []) {
          fn(...args);
        }
      },
    };
  };
  return {
    spawn: (...args: unknown[]) => {
      spawnState.spawns.push(args as [string, string[], Record<string, unknown>]);
      const child = makeChild();
      const index = spawnState.spawns.length - 1;
      setImmediate(() => {
        if (index < spawnState.failSpawnCount) {
          const error = new Error('missing') as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          child.emit('error', error);
        } else {
          child.emit('spawn');
        }
      });
      return child;
    },
  };
});

const VAULT = "E:\\Test Vault & (x) '中文'";
const PWSH = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';

function makePlugin(overrides: Partial<PluginDeps> = {}): VaultPowerShellPlugin {
  const deps: Partial<PluginDeps> = {
    platform: 'win32',
    finder: {
      buildCandidates: () => [{ path: PWSH, source: 'ProgramFiles' }],
      probeMajorVersion: vi.fn().mockResolvedValue(7),
    },
    ...overrides,
  };
  const app = {
    vault: {
      adapter: new FileSystemAdapter(VAULT),
    },
  };
  return new VaultPowerShellPlugin(app as never, {} as never, deps);
}

function setAdapter(plugin: VaultPowerShellPlugin, adapter: unknown): void {
  (plugin.app as { vault: { adapter: unknown } }).vault.adapter = adapter;
}

describe('VaultPowerShellPlugin', () => {
  beforeEach(() => {
    resetState();
    spawnState.spawns.length = 0;
    spawnState.failSpawnCount = 0;
  });

  it('adds the ribbon icon on load and the click handler opens a session', async () => {
    const plugin = makePlugin();
    plugin.onload();
    expect(state.ribbonCalls).toHaveLength(1);
    const [icon, tooltip, callback] = state.ribbonCalls[0];
    expect(icon).toBe('terminal');
    expect(tooltip).toBe('Open PowerShell at vault root');
    callback();
    // The ribbon callback fires-and-forgets the async pipeline; let the
    // event loop drain (probe promise + spawn setImmediate) before asserting.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(spawnState.spawns).toHaveLength(1);
  });

  it('shows the non-Windows notice and does not spawn on non-Windows platforms', async () => {
    const plugin = makePlugin({ platform: 'linux' });
    await plugin.openPowerShell();
    expect(state.notices).toEqual([
      'Vault PowerShell only supports Obsidian Desktop on Windows.',
    ]);
    expect(spawnState.spawns).toHaveLength(0);
  });

  it('fails gracefully when the vault adapter is not a FileSystemAdapter', async () => {
    const plugin = makePlugin();
    setAdapter(plugin, {});
    await plugin.openPowerShell();
    expect(state.notices).toEqual(['Unable to resolve the local vault path.']);
    expect(spawnState.spawns).toHaveLength(0);
  });

  it('shows a notice when no PowerShell 7+ is found', async () => {
    const plugin = makePlugin({
      finder: {
        buildCandidates: () => [{ path: PWSH, source: 'ProgramFiles' }],
        probeMajorVersion: vi.fn().mockResolvedValue(null),
      },
    });
    await plugin.openPowerShell();
    expect(state.notices).toEqual([
      'PowerShell 7 or later was not found. Install PowerShell and restart Obsidian.',
    ]);
    expect(spawnState.spawns).toHaveLength(0);
  });

  it('launches through Windows Terminal at the vault root without a success notice', async () => {
    const plugin = makePlugin();
    await plugin.openPowerShell();
    expect(state.notices).toHaveLength(0);
    expect(spawnState.spawns).toHaveLength(1);
    const [file, args, options] = spawnState.spawns[0];
    expect(file).toBe('wt.exe');
    expect(args).toEqual(['-w', '0', PWSH, '-WorkingDirectory', VAULT]);
    expect(options.cwd).toBe(VAULT);
    expect(options.shell).toBe(false);
  });

  it('falls back to the direct pwsh spawn when wt.exe is missing', async () => {
    const probe = vi.fn().mockResolvedValue(7);
    const plugin = makePlugin({
      finder: {
        buildCandidates: () => [{ path: PWSH, source: 'ProgramFiles' }],
        probeMajorVersion: probe,
      },
    });
    spawnState.failSpawnCount = 1; // wt.exe ENOENT -> launcher falls back
    await plugin.openPowerShell();
    expect(state.notices).toHaveLength(0);
    expect(spawnState.spawns).toHaveLength(2);
    expect(spawnState.spawns[0][0]).toBe('wt.exe');
    expect(spawnState.spawns[1][0]).toBe(PWSH);
    // The pwsh cache is untouched by a missing wt.exe.
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('clears the cache and retries exactly once when both wt and pwsh fail with ENOENT', async () => {
    const probe = vi.fn().mockResolvedValue(7);
    const plugin = makePlugin({
      finder: {
        buildCandidates: () => [{ path: PWSH, source: 'ProgramFiles' }],
        probeMajorVersion: probe,
      },
    });
    spawnState.failSpawnCount = 2; // wt ENOENT + fallback pwsh ENOENT
    await plugin.openPowerShell();
    // First click: wt + fallback pwsh. Cache cleared, one re-verify, second
    // click: wt again (succeeds this time).
    expect(spawnState.spawns).toHaveLength(3);
    expect(probe).toHaveBeenCalledTimes(2);
    expect(state.notices).toHaveLength(0);
    expect(spawnState.spawns[2][0]).toBe('wt.exe');
  });

  it('shows the start-failed notice when the retry also fails', async () => {
    const probe = vi.fn().mockResolvedValue(7);
    const plugin = makePlugin({
      finder: {
        buildCandidates: () => [{ path: PWSH, source: 'ProgramFiles' }],
        probeMajorVersion: probe,
      },
    });
    spawnState.failSpawnCount = 4; // every spawn in both attempts fails
    await plugin.openPowerShell();
    // Attempt 1: wt + fallback pwsh. Attempt 2 (retry): wt + fallback pwsh.
    expect(spawnState.spawns).toHaveLength(4);
    expect(probe).toHaveBeenCalledTimes(2);
    expect(state.notices).toEqual([
      'PowerShell could not be started. Check the developer console for details.',
    ]);
  });

  it('shows the not-found notice when re-verification after ENOENT finds nothing', async () => {
    const probe = vi.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(null);
    const plugin = makePlugin({
      finder: {
        buildCandidates: () => [{ path: PWSH, source: 'ProgramFiles' }],
        probeMajorVersion: probe,
      },
    });
    spawnState.failSpawnCount = 2; // wt + pwsh both ENOENT on the first click
    await plugin.openPowerShell();
    expect(spawnState.spawns).toHaveLength(2);
    expect(probe).toHaveBeenCalledTimes(2);
    expect(state.notices).toEqual([
      'PowerShell 7 or later was not found. Install PowerShell and restart Obsidian.',
    ]);
  });

  it('opens a new window on every click once pwsh is cached (no cooldown)', async () => {
    const probe = vi.fn().mockResolvedValue(7);
    const plugin = makePlugin({
      finder: {
        buildCandidates: () => [{ path: PWSH, source: 'ProgramFiles' }],
        probeMajorVersion: probe,
      },
    });
    await plugin.openPowerShell();
    await plugin.openPowerShell();
    await plugin.openPowerShell();
    expect(spawnState.spawns).toHaveLength(3);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(state.notices).toHaveLength(0);
  });
});
