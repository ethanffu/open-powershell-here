import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

import { launchInteractive } from '../src/powershell/launcher';

class FakeChild extends EventEmitter {
  pid = 4242;
  unref = vi.fn();
}

const VAULT = "E:\\My Vault (x) & 'y' 中文";
const VAULT_SEMICOLON = 'E:\\Odd;Vault';
const PWSH = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';

type SpawnCall = [string, string[], Record<string, unknown>];

/** Queue spawn results: each entry is 'spawn' (success) or an error code. */
function mockSpawns(behaviors: Array<'spawn' | 'ENOENT' | 'EACCES'>): FakeChild[] {
  const children: FakeChild[] = [];
  spawnMock.mockImplementation(() => {
    const child = new FakeChild();
    children.push(child);
    const index = children.length - 1;
    setImmediate(() => {
      const behavior = behaviors[Math.min(index, behaviors.length - 1)];
      if (behavior === 'spawn') {
        child.emit('spawn');
      } else {
        const error = new Error(behavior) as NodeJS.ErrnoException;
        error.code = behavior;
        child.emit('error', error);
      }
    });
    return child;
  });
  return children;
}

function calls(): SpawnCall[] {
  return spawnMock.mock.calls as unknown as SpawnCall[];
}

describe('launchInteractive — hosted mode via Windows Terminal', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it('spawns wt.exe with the verified pwsh and the vault path as its own -WorkingDirectory argument', async () => {
    mockSpawns(['spawn']);
    const outcome = await launchInteractive({ path: PWSH, majorVersion: 7 }, VAULT);
    expect(outcome).toEqual({ ok: true, pid: 4242 });
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [file, args, options] = calls()[0];
    expect(file).toBe('wt.exe');
    expect(args).toEqual(['-w', '0', PWSH, '-WorkingDirectory', VAULT]);
    expect(options.cwd).toBe(VAULT);
    expect(options.shell).toBe(false);
    expect(options.windowsHide).toBe(false);
    expect(options.detached).toBe(false);
  });

  it('never passes -NoProfile, -NonInteractive or -Command in the real session', async () => {
    mockSpawns(['spawn']);
    await launchInteractive({ path: PWSH, majorVersion: 7 }, VAULT);
    const [, args] = calls()[0];
    expect(args).not.toContain('-NoProfile');
    expect(args).not.toContain('-NonInteractive');
    expect(args).not.toContain('-Command');
    expect(args).toContain('-WorkingDirectory');
    expect(args).toContain(VAULT);
  });

  it('does not auto-run scripts', async () => {
    mockSpawns(['spawn']);
    await launchInteractive({ path: PWSH, majorVersion: 7 }, VAULT);
    const [, args] = calls()[0];
    for (const arg of args) {
      expect(arg).not.toMatch(/\.(ps1|cmd|bat)$/i);
    }
  });

  it('unrefs the host child so Obsidian does not wait for the session', async () => {
    const children = mockSpawns(['spawn']);
    await launchInteractive({ path: PWSH, majorVersion: 7 }, VAULT);
    expect(children[0].unref).toHaveBeenCalled();
  });

  it('falls back to the direct pwsh spawn when wt.exe is missing', async () => {
    mockSpawns(['ENOENT', 'spawn']);
    const outcome = await launchInteractive({ path: PWSH, majorVersion: 7 }, VAULT);
    expect(outcome.ok).toBe(true);
    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(calls()[0][0]).toBe('wt.exe');
    const [file, args, options] = calls()[1];
    expect(file).toBe(PWSH);
    expect(args).toEqual(['-WorkingDirectory', VAULT]);
    expect(options.cwd).toBe(VAULT);
    expect(options.shell).toBe(false);
    expect(options.stdio).toBe('inherit');
  });

  it('reports failures that are not ENOENT without falling back', async () => {
    mockSpawns(['EACCES']);
    const outcome = await launchInteractive({ path: PWSH, majorVersion: 7 }, VAULT);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe('UNKNOWN');
    }
  });
});

describe('launchInteractive — direct mode', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it('spawns the verified pwsh.exe directly for vault paths containing ";"', async () => {
    mockSpawns(['spawn']);
    const outcome = await launchInteractive(
      { path: PWSH, majorVersion: 7 },
      VAULT_SEMICOLON,
    );
    expect(outcome.ok).toBe(true);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [file, args, options] = calls()[0];
    expect(file).toBe(PWSH);
    expect(args).toEqual(['-WorkingDirectory', VAULT_SEMICOLON]);
    expect(options.cwd).toBe(VAULT_SEMICOLON);
    expect(options.shell).toBe(false);
    expect(options.stdio).toBe('inherit');
  });

  it('never spawns forbidden programs in direct mode', async () => {
    mockSpawns(['spawn']);
    await launchInteractive({ path: PWSH, majorVersion: 7 }, VAULT_SEMICOLON);
    const [file] = calls()[0];
    const lower = file.toLowerCase();
    expect(lower).toMatch(/pwsh\.exe$/);
    for (const forbidden of ['powershell.exe', 'cmd.exe', 'wt.exe', 'conhost.exe', 'bash.exe']) {
      expect(lower).not.toMatch(new RegExp(`${forbidden.replace('.', '\\.')}$`));
    }
  });

  it('reports ENOENT launch failures for a missing pwsh.exe', async () => {
    mockSpawns(['ENOENT']);
    const outcome = await launchInteractive(
      { path: 'C:\\gone\\pwsh.exe', majorVersion: 7 },
      VAULT_SEMICOLON,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe('ENOENT');
      expect(outcome.error).toBeInstanceOf(Error);
    }
  });
});
