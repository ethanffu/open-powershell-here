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

function mockSpawn(behavior: 'spawn' | 'enoent' | 'unknown-error'): FakeChild {
  const child = new FakeChild();
  spawnMock.mockReturnValue(child);
  setImmediate(() => {
    if (behavior === 'spawn') {
      child.emit('spawn');
    } else {
      const error = new Error(behavior) as NodeJS.ErrnoException;
      error.code = behavior === 'enoent' ? 'ENOENT' : 'EACCES';
      child.emit('error', error);
    }
  });
  return child;
}

describe('launchInteractive', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it('spawns only the verified pwsh.exe', async () => {
    mockSpawn('spawn');
    const outcome = await launchInteractive({ path: 'C:\\Verified\\pwsh.exe', majorVersion: 7 }, VAULT);
    expect(outcome).toEqual({ ok: true, pid: 4242 });
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0][0]).toBe('C:\\Verified\\pwsh.exe');
  });

  it('passes the vault path as its own -WorkingDirectory argument and sets cwd', async () => {
    mockSpawn('spawn');
    await launchInteractive({ path: 'C:\\pwsh.exe', majorVersion: 7 }, VAULT);
    const [, args, options] = spawnMock.mock.calls[0] as [
      string,
      string[],
      Record<string, unknown>,
    ];
    expect(args).toEqual(['-WorkingDirectory', VAULT]);
    expect(options.cwd).toBe(VAULT);
    // The vault path must never be embedded in a command string:
    // it appears only as a standalone argument and as cwd.
    expect(args.join(' ')).not.toContain('Set-Location');
    expect(args.join(' ')).not.toContain('cd ');
  });

  it('does not enable a shell and does not use forbidden programs', async () => {
    mockSpawn('spawn');
    await launchInteractive({ path: 'C:\\pwsh.exe', majorVersion: 7 }, VAULT);
    const [file, , options] = spawnMock.mock.calls[0] as [
      string,
      string[],
      Record<string, unknown>,
    ];
    expect(options.shell).toBe(false);
    const lower = file.toLowerCase();
    expect(lower).toMatch(/pwsh\.exe$/);
    for (const forbidden of ['powershell.exe', 'cmd.exe', 'wt.exe', 'conhost.exe', 'bash.exe']) {
      expect(lower).not.toMatch(new RegExp(`${forbidden.replace('.', '\\.')}$`));
    }
  });

  it('never passes -NoProfile, -NonInteractive or -Command in the real session', async () => {
    mockSpawn('spawn');
    await launchInteractive({ path: 'C:\\pwsh.exe', majorVersion: 7 }, VAULT);
    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(args).not.toContain('-NoProfile');
    expect(args).not.toContain('-NonInteractive');
    expect(args).not.toContain('-Command');
    expect(args).toEqual(['-WorkingDirectory', VAULT]);
  });

  it('does not auto-run scripts', async () => {
    mockSpawn('spawn');
    await launchInteractive({ path: 'C:\\pwsh.exe', majorVersion: 7 }, VAULT);
    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    for (const arg of args) {
      expect(arg).not.toMatch(/\.(ps1|cmd|bat)$/i);
    }
  });

  it('shows the window (windowsHide false) and is not detached', async () => {
    mockSpawn('spawn');
    await launchInteractive({ path: 'C:\\pwsh.exe', majorVersion: 7 }, VAULT);
    const [, , options] = spawnMock.mock.calls[0] as [
      string,
      string[],
      Record<string, unknown>,
    ];
    expect(options.windowsHide).toBe(false);
    expect(options.detached).toBe(false);
  });

  it('uses stdio inherit, never the unverified "ignore" value', async () => {
    mockSpawn('spawn');
    await launchInteractive({ path: 'C:\\pwsh.exe', majorVersion: 7 }, VAULT);
    const [, , options] = spawnMock.mock.calls[0] as [
      string,
      string[],
      Record<string, unknown>,
    ];
    expect(options.stdio).not.toBe('ignore');
    expect(options.stdio).toBe('inherit');
  });

  it('unrefs the child so Obsidian does not wait for the session', async () => {
    const child = mockSpawn('spawn');
    await launchInteractive({ path: 'C:\\pwsh.exe', majorVersion: 7 }, VAULT);
    expect(child.unref).toHaveBeenCalled();
  });

  it('reports ENOENT launch failures', async () => {
    mockSpawn('enoent');
    const outcome = await launchInteractive({ path: 'C:\\gone\\pwsh.exe', majorVersion: 7 }, VAULT);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe('ENOENT');
      expect(outcome.error).toBeInstanceOf(Error);
    }
  });

  it('reports unknown launch failures with a code', async () => {
    mockSpawn('unknown-error');
    const outcome = await launchInteractive({ path: 'C:\\pwsh.exe', majorVersion: 7 }, VAULT);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe('UNKNOWN');
    }
  });
});
