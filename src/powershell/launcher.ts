import { spawn } from 'node:child_process';
import type { LaunchOutcome, VerifiedPowerShell } from './types';

/**
 * Start the formal, interactive PowerShell session with the already verified
 * `pwsh.exe`.
 *
 * Safe path passing:
 *  - the vault root is passed as its own argument to `-WorkingDirectory`
 *  - the child `cwd` is set to the vault root as an additional guarantee
 *  - the vault path is never embedded in a command string
 *
 * Session rules:
 *  - no `-NoProfile`, no `-NonInteractive`, no `-Command` — the user's
 *    profile loads normally and nothing is auto-executed
 *  - no shell (`shell: false`), direct process creation only
 *  - `windowsHide: false` so the OS may create a console window
 *  - NOT detached: `detached: true` maps to DETACHED_PROCESS, which would
 *    remove the console entirely
 *
 * stdio: `'inherit'` was chosen over `'ignore'` after real Windows
 * verification (see MANUAL_TESTS.md "Platform behavior findings"):
 *  - `'ignore'` gives pwsh NUL handles -> stdin is redirected -> pwsh exits
 *    immediately; the window would only flash.
 *  - `'inherit'` lets pwsh attach to a real console when the host process has
 *    one (e.g. Obsidian started from a terminal), giving a fully interactive
 *    session. From an Explorer-launched, console-less Obsidian, Windows does
 *    not hand the new console's standard handles to the child, which is a
 *    platform limitation of direct process creation from a GUI parent; this
 *    is reported honestly in MANUAL_TESTS.md.
 *  - `'inherit'` also means the plugin never proxies, listens to or records
 *    the user's terminal input/output.
 */
export function launchInteractive(
  verified: VerifiedPowerShell,
  vaultPath: string,
): Promise<LaunchOutcome> {
  return new Promise((resolve) => {
    let settled = false;

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(verified.path, ['-WorkingDirectory', vaultPath], {
        cwd: vaultPath,
        env: process.env,
        shell: false,
        windowsHide: false,
        detached: false,
        stdio: 'inherit',
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

    // Obsidian must not wait for the PowerShell session; the session keeps
    // running on its own after Obsidian closes (no pipe handles are held).
    child.unref();
  });
}
