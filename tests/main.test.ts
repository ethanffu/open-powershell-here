import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emitFileMenu,
  FileSystemAdapter,
  Menu,
  resetState,
  state,
  TFolder,
  TFile,
  Workspace,
} from '../tests/mocks/obsidian';
import VaultPowerShellPlugin, { type PluginDeps } from '../src/main';
import { getVaultRootPath } from '../src/vault-path';
import { type FinderDeps } from '../src/powershell/finder';

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

/** Default finder deps: one verified Program Files pwsh. */
function finderDeps(
  probeMajorVersion: () => Promise<number | null> = vi.fn().mockResolvedValue(7),
): FinderDeps {
  return {
    buildCandidates: () => [{ path: PWSH, source: 'ProgramFiles' }],
    probeMajorVersion,
  };
}

function makePlugin(overrides: Partial<PluginDeps> = {}): VaultPowerShellPlugin {
  const deps: Partial<PluginDeps> = {
    platform: 'win32',
    finder: finderDeps(),
    ...overrides,
  };
  const app = {
    vault: {
      adapter: new FileSystemAdapter(VAULT),
    },
    workspace: new Workspace(),
  };
  return new VaultPowerShellPlugin(app as never, {} as never, deps);
}

/** The plugin's mock vault object (typed loosely; the mock app is a plain object). */
function pluginVault(plugin: VaultPowerShellPlugin): { adapter: unknown } {
  return (plugin.app as { vault: { adapter: unknown } }).vault;
}

function setAdapter(plugin: VaultPowerShellPlugin, adapter: unknown): void {
  pluginVault(plugin).adapter = adapter;
}

/** Drain the event loop so mocked spawn setImmediates settle. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

/** Simulate a right click on `target` and return the built Menu. */
function rightClick(target: unknown): Menu {
  const menu = new Menu();
  emitFileMenu(menu, target);
  return menu;
}

describe('VaultPowerShellPlugin', () => {
  beforeEach(() => {
    resetState();
    spawnState.spawns.length = 0;
    spawnState.failSpawnCount = 0;
  });

  describe('ribbon entry', () => {
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
      await flush();
      expect(spawnState.spawns).toHaveLength(1);
    });

    it('opens PowerShell at the vault root from the ribbon', async () => {
      const plugin = makePlugin();
      plugin.onload();
      const [, , callback] = state.ribbonCalls[0];
      callback();
      await flush();
      expect(spawnState.spawns).toHaveLength(1);
      const [file, args, options] = spawnState.spawns[0];
      expect(file).toBe('wt.exe');
      expect(args).toEqual(['-w', '0', PWSH, '-WorkingDirectory', VAULT]);
      expect(options.cwd).toBe(VAULT);
      expect(options.shell).toBe(false);
    });

    it('adds a stable CSS class to the ribbon element (Style Settings hook)', () => {
      const plugin = makePlugin();
      plugin.onload();
      expect(state.ribbonCalls).toHaveLength(1);
      // styles.css hides `.vault-powershell-ribbon` when Style Settings
      // toggles `body.hide-vault-powershell-ribbon`; the class must be
      // icon-independent so the CSS survives icon changes.
      expect(state.ribbonClasses).toContain('vault-powershell-ribbon');
    });
  });

  describe('folder context menu entry', () => {
    it('registers a single file-menu handler through registerEvent on load', () => {
      const plugin = makePlugin();
      plugin.onload();
      expect(state.workspaceOnCalls.map(([event]) => event)).toEqual(['file-menu']);
      expect(state.registerEventCalls).toHaveLength(1);
      expect(state.workspaceHandlers.get('file-menu')).toHaveLength(1);
    });

    it('adds exactly one "Open PowerShell here" item for a single folder', () => {
      const plugin = makePlugin();
      plugin.onload();
      const menu = rightClick(new TFolder('Notes/Deep'));
      expect(menu.items).toHaveLength(1);
      expect(menu.items[0].title).toBe('Open PowerShell here');
    });

    it('uses the terminal icon for the menu item', () => {
      const plugin = makePlugin();
      plugin.onload();
      const menu = rightClick(new TFolder('Notes'));
      expect(menu.items).toHaveLength(1);
      expect(menu.items[0].icon).toBe('terminal');
    });

    it('opens PowerShell in the absolute path of a nested folder when clicked', async () => {
      const plugin = makePlugin();
      plugin.onload();
      const menu = rightClick(new TFolder('Notes/Deep Folder'));
      menu.items[0].click();
      await flush();
      expect(spawnState.spawns).toHaveLength(1);
      const expected = `${VAULT}\\Notes\\Deep Folder`;
      const [file, args, options] = spawnState.spawns[0];
      expect(file).toBe('wt.exe');
      expect(args).toEqual(['-w', '0', PWSH, '-WorkingDirectory', expected]);
      expect(options.cwd).toBe(expected);
      expect(options.shell).toBe(false);
    });

    it('resolves the vault root folder to the adapter base path', async () => {
      const plugin = makePlugin();
      plugin.onload();
      const menu = rightClick(new TFolder(''));
      menu.items[0].click();
      await flush();
      expect(spawnState.spawns).toHaveLength(1);
      const [file, args, options] = spawnState.spawns[0];
      expect(file).toBe('wt.exe');
      expect(args).toEqual(['-w', '0', PWSH, '-WorkingDirectory', VAULT]);
      expect(options.cwd).toBe(VAULT);
    });

    it('adds no menu item for a regular file', () => {
      const plugin = makePlugin();
      plugin.onload();
      const menu = rightClick(new TFile('notes.md'));
      expect(menu.items).toHaveLength(0);
    });

    it('adds no folder menu item on non-Windows platforms', () => {
      const plugin = makePlugin({ platform: 'linux' });
      plugin.onload();
      const menu = rightClick(new TFolder('Notes'));
      expect(menu.items).toHaveLength(0);
    });

    it('adds no folder menu item when the adapter is not a FileSystemAdapter', () => {
      const plugin = makePlugin();
      setAdapter(plugin, {});
      plugin.onload();
      const menu = rightClick(new TFolder('Notes'));
      expect(menu.items).toHaveLength(0);
    });

    it('does not register a bulk multi-select (files-menu) entry', () => {
      const plugin = makePlugin();
      plugin.onload();
      const events = state.workspaceOnCalls.map(([event]) => event);
      expect(events).toEqual(['file-menu']);
      expect(events).not.toContain('files-menu');
    });

    it('passes special-character folder paths as a single argument', async () => {
      const plugin = makePlugin();
      plugin.onload();
      const menu = rightClick(
        new TFolder("Notes/It's (x) & 中文/子目录"),
      );
      menu.items[0].click();
      await flush();
      const expected = `${VAULT}\\Notes\\It's (x) & 中文\\子目录`;
      const [file, args, options] = spawnState.spawns[0];
      expect(file).toBe('wt.exe');
      expect(args).toEqual(['-w', '0', PWSH, '-WorkingDirectory', expected]);
      expect(options.cwd).toBe(expected);
    });

    it('does not leave duplicate menu handlers after a plugin reload', () => {
      const plugin = makePlugin();
      plugin.onload();
      plugin.onunload();
      plugin.onload();
      expect(state.workspaceHandlers.get('file-menu')).toHaveLength(1);
      const menu = rightClick(new TFolder('Notes'));
      expect(menu.items).toHaveLength(1);
      expect(menu.items[0].title).toBe('Open PowerShell here');
    });
  });

  describe('shared launch flow', () => {
    it('shows the non-Windows notice and does not spawn on non-Windows platforms', async () => {
      const plugin = makePlugin({ platform: 'linux' });
      await plugin.openPowerShell(VAULT);
      expect(state.notices).toEqual([
        'Vault PowerShell only supports Obsidian Desktop on Windows.',
      ]);
      expect(spawnState.spawns).toHaveLength(0);
    });

    it('fails gracefully when no target path can be resolved', async () => {
      const plugin = makePlugin();
      setAdapter(plugin, {});
      const root = getVaultRootPath(pluginVault(plugin) as never);
      expect(root).toBeNull();
      await plugin.openPowerShell(root);
      expect(state.notices).toEqual(['Unable to resolve the local vault path.']);
      expect(spawnState.spawns).toHaveLength(0);
    });

    it('shows a notice when no PowerShell 7+ is found', async () => {
      const plugin = makePlugin({ finder: finderDeps(vi.fn().mockResolvedValue(null)) });
      await plugin.openPowerShell(VAULT);
      expect(state.notices).toEqual([
        'PowerShell 7 or later was not found. Install PowerShell and restart Obsidian.',
      ]);
      expect(spawnState.spawns).toHaveLength(0);
    });

    it('launches through Windows Terminal at the target directory without a success notice', async () => {
      const plugin = makePlugin();
      await plugin.openPowerShell(VAULT);
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
      const plugin = makePlugin({ finder: finderDeps(probe) });
      spawnState.failSpawnCount = 1; // wt.exe ENOENT -> launcher falls back
      await plugin.openPowerShell(VAULT);
      expect(state.notices).toHaveLength(0);
      expect(spawnState.spawns).toHaveLength(2);
      expect(spawnState.spawns[0][0]).toBe('wt.exe');
      expect(spawnState.spawns[1][0]).toBe(PWSH);
      // The pwsh cache is untouched by a missing wt.exe.
      expect(probe).toHaveBeenCalledTimes(1);
    });

    it('clears the cache and retries exactly once when both wt and pwsh fail with ENOENT', async () => {
      const probe = vi.fn().mockResolvedValue(7);
      const plugin = makePlugin({ finder: finderDeps(probe) });
      spawnState.failSpawnCount = 2; // wt ENOENT + fallback pwsh ENOENT
      await plugin.openPowerShell(VAULT);
      // First click: wt + fallback pwsh. Cache cleared, one re-verify, second
      // click: wt again (succeeds this time).
      expect(spawnState.spawns).toHaveLength(3);
      expect(probe).toHaveBeenCalledTimes(2);
      expect(state.notices).toHaveLength(0);
      expect(spawnState.spawns[2][0]).toBe('wt.exe');
    });

    it('shows the start-failed notice when the retry also fails', async () => {
      const probe = vi.fn().mockResolvedValue(7);
      const plugin = makePlugin({ finder: finderDeps(probe) });
      spawnState.failSpawnCount = 4; // every spawn in both attempts fails
      await plugin.openPowerShell(VAULT);
      // Attempt 1: wt + fallback pwsh. Attempt 2 (retry): wt + fallback pwsh.
      expect(spawnState.spawns).toHaveLength(4);
      expect(probe).toHaveBeenCalledTimes(2);
      expect(state.notices).toEqual([
        'PowerShell could not be started. Check the developer console for details.',
      ]);
    });

    it('shows the not-found notice when re-verification after ENOENT finds nothing', async () => {
      const probe = vi.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(null);
      const plugin = makePlugin({ finder: finderDeps(probe) });
      spawnState.failSpawnCount = 2; // wt + pwsh both ENOENT on the first click
      await plugin.openPowerShell(VAULT);
      expect(spawnState.spawns).toHaveLength(2);
      expect(probe).toHaveBeenCalledTimes(2);
      expect(state.notices).toEqual([
        'PowerShell 7 or later was not found. Install PowerShell and restart Obsidian.',
      ]);
    });

    it('opens a new window on every click once pwsh is cached (no cooldown)', async () => {
      const probe = vi.fn().mockResolvedValue(7);
      const plugin = makePlugin({ finder: finderDeps(probe) });
      await plugin.openPowerShell(VAULT);
      await plugin.openPowerShell(VAULT);
      await plugin.openPowerShell(VAULT);
      expect(spawnState.spawns).toHaveLength(3);
      expect(probe).toHaveBeenCalledTimes(1);
      expect(state.notices).toHaveLength(0);
    });

    it('shows the semicolon notice and creates no process for ";" paths', async () => {
      const probe = vi.fn().mockResolvedValue(7);
      const plugin = makePlugin({ finder: finderDeps(probe) });
      await plugin.openPowerShell('E:\\Odd;Vault');
      expect(state.notices).toEqual([
        'PowerShell cannot be opened for paths containing a semicolon (;).',
      ]);
      // No process at all: neither the launch spawns (wt.exe/pwsh.exe) nor
      // even the version probe ran.
      expect(spawnState.spawns).toHaveLength(0);
      expect(probe).not.toHaveBeenCalled();
    });

    it('shares the PowerShellFinder cache between the ribbon and the context menu', async () => {
      const probe = vi.fn().mockResolvedValue(7);
      const plugin = makePlugin({ finder: finderDeps(probe) });
      await plugin.openPowerShell(VAULT); // ribbon -> vault root
      await plugin.openPowerShell(`${VAULT}\\Sub`); // context menu -> folder
      expect(probe).toHaveBeenCalledTimes(1); // verified once, shared
      expect(spawnState.spawns).toHaveLength(2); // a new session per entry
    });

    it('single-flights the first probe across both entries', async () => {
      let releaseProbe: (value: number | null) => void = () => {};
      const probe = vi.fn().mockImplementation(
        () =>
          new Promise<number | null>((resolve) => {
            releaseProbe = resolve;
          }),
      );
      const plugin = makePlugin({ finder: finderDeps(probe) });
      const ribbon = plugin.openPowerShell(VAULT);
      const menu = plugin.openPowerShell(`${VAULT}\\Sub`);
      expect(probe).toHaveBeenCalledTimes(1); // single flight across entries
      releaseProbe(7);
      await Promise.all([ribbon, menu]);
      expect(probe).toHaveBeenCalledTimes(1);
      expect(spawnState.spawns).toHaveLength(2);
    });
  });
});
