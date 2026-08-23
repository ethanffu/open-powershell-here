import { spawn, type ChildProcess } from 'node:child_process';
import type { LaunchOutcome } from '../types';
import type { VerifiedPowerShell } from './types';

const WINDOWS_TERMINAL = 'wt.exe';

function spawnDirect(
  verified: VerifiedPowerShell,
  targetDir: string,
): Promise<LaunchOutcome> {
  return spawnPwsh(
    verified.path,
    ['-WorkingDirectory', targetDir],
    targetDir,
    'inherit',
  );
}

function spawnHosted(
  verified: VerifiedPowerShell,
  targetDir: string,
): Promise<LaunchOutcome> {
  return spawnPwsh(
    WINDOWS_TERMINAL,
    ['-w', '0', verified.path, '-WorkingDirectory', targetDir],
    targetDir,
    'ignore',
  );
}

function spawnPwsh(
  executable: string,
  args: string[],
  targetDir: string,
  stdio: 'inherit' | 'ignore',
): Promise<LaunchOutcome> {
  return new Promise((resolve) => {
    let settled = false;

    let child: ChildProcess;
    try {
      child = spawn(executable, args, {
        cwd: targetDir,
        env: process.env,
        shell: false,
        windowsHide: false,
        detached: false,
        stdio,
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

/**
 * Start the formal, interactive PowerShell session in `targetDir`.
 *
 * Strategy:
 *  1. refuse paths containing `;` without spawning anything;
 *  2. hosted mode via Windows Terminal;
 *  3. if `wt.exe` is missing (ENOENT), fall back to direct spawn.
 */
export function launchInteractive(
  verified: VerifiedPowerShell,
  targetDir: string,
): Promise<LaunchOutcome> {
  if (targetDir.includes(';')) {
    return Promise.resolve({
      ok: false,
      code: 'UNKNOWN',
      error: new Error(
        'Refusing to launch PowerShell for a path containing a semicolon (;).',
      ),
    });
  }
  return spawnHosted(verified, targetDir).then((outcome) => {
    if (outcome.ok) {
      return outcome;
    }
    if (outcome.code === 'ENOENT') {
      return spawnDirect(verified, targetDir);
    }
    return outcome;
  });
}
