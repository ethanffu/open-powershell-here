import { spawn, type ChildProcess } from 'node:child_process';
import type { LaunchOutcome, ResolvedTerminal } from '../types';
import type { LinuxTerminalSpec } from './types';

export function launchLinuxTerminal(
  terminal: ResolvedTerminal,
  targetDir: string,
): Promise<LaunchOutcome> {
  const spec = terminal.extra?.spec as LinuxTerminalSpec | undefined;
  const args = spec !== undefined ? spec.buildArgs(targetDir) : [`--working-directory=${targetDir}`];

  return new Promise((resolve) => {
    let settled = false;

    let child: ChildProcess;
    try {
      child = spawn(terminal.binaryPath, args, {
        cwd: targetDir,
        env: process.env,
        shell: false,
        detached: true,
        stdio: 'ignore',
      });
    } catch (error) {
      resolve({ ok: false, code: 'UNKNOWN', error: error as Error });
      return;
    }

    child.once('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      const code = (error as NodeJS.ErrnoException).code;
      resolve({
        ok: false,
        code: code === 'ENOENT' ? 'ENOENT' : 'UNKNOWN',
        error,
      });
    });

    child.once('spawn', () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ ok: true, pid: child.pid ?? 0 });
    });

    child.unref();
  });
}
