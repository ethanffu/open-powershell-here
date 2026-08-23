import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

import { launchLinuxTerminal } from '../src/terminals/linux/launcher';
import type { ResolvedTerminal } from '../src/terminals/types';

class FakeChild extends EventEmitter {
  pid = 5555;
  unref = vi.fn();
}

type SpawnCall = [string, string[], Record<string, unknown>];

function calls(): SpawnCall[] {
  return spawnMock.mock.calls as unknown as SpawnCall[];
}

describe('launchLinuxTerminal', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it('spawns Ghostty with --working-directory, detached: true, and cwd set', async () => {
    const child = new FakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => child.emit('spawn'));
      return child;
    });

    const terminal: ResolvedTerminal = {
      id: 'ghostty',
      displayName: 'Ghostty',
      binaryPath: '/usr/bin/ghostty',
      extra: {
        spec: {
          id: 'ghostty',
          displayName: 'Ghostty',
          binary: 'ghostty',
          buildArgs: (dir: string) => [`--working-directory=${dir}`],
        },
      },
    };

    const outcome = await launchLinuxTerminal(terminal, '/home/user/vault');
    expect(outcome).toEqual({ ok: true, pid: 5555 });
    expect(child.unref).toHaveBeenCalled();

    const [file, args, options] = calls()[0];
    expect(file).toBe('/usr/bin/ghostty');
    expect(args).toEqual(['--working-directory=/home/user/vault']);
    expect(options.cwd).toBe('/home/user/vault');
    expect(options.detached).toBe(true);
    expect(options.stdio).toBe('ignore');
  });

  it('handles ENOENT spawn error', async () => {
    const child = new FakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => {
        const error = new Error('not found') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        child.emit('error', error);
      });
      return child;
    });

    const terminal: ResolvedTerminal = {
      id: 'ghostty',
      displayName: 'Ghostty',
      binaryPath: '/usr/bin/ghostty',
    };

    const outcome = await launchLinuxTerminal(terminal, '/home/user/vault');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe('ENOENT');
    }
  });
});
