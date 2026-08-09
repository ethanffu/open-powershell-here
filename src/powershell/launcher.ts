import { spawn } from 'node:child_process';
import type { LaunchOutcome, VerifiedPowerShell } from './types';

/**
 * Console window host for the formal session.
 *
 * CONSTRAINT CHANGE (user-authorized, 2026-08-08): the original spec forbade
 * `wt.exe` and required a bare `pwsh.exe` spawn. Real-machine experiments
 * (see MANUAL_TESTS.md "Platform behavior findings") proved that from an
 * Explorer-launched Obsidian (GUI process without a console) a bare spawn
 * can never give pwsh interactive console handles: libuv always passes
 * explicit standard handles (NUL / INVALID_HANDLE_VALUE / pipes) with
 * STARTF_USESTDHANDLES, so pwsh exits immediately. The user experienced this
 * as the window flashing and closing.
 *
 * The user then authorized relaxing the constraint so the plugin may use
 * `wt.exe` (Windows Terminal) purely as the console window host: Windows
 * Terminal creates the real console, attaches its handles to pwsh, and the
 * plugin still does NOT proxy or observe any input/output. Verified in a
 * console-less (DETACHED) parent simulation:
 *   - pwsh gets `[Console]::IsInputRedirected == False` (fully interactive)
 *   - `-WorkingDirectory` arrives intact for paths containing spaces, `&`,
 *     parentheses, single quotes and CJK characters
 *   - the session keeps running after the parent exits
 *
 * Known limitation: `wt.exe` splits its command line on `;`, so a target
 * path containing `;` can never be launched reliably. Per user approval
 * (2026-08-09) such paths are refused: `launchInteractive` returns a
 * failure WITHOUT spawning anything, and the plugin shows a notice instead.
 * The caller (`main.ts`) guards before the probe; this function re-guards
 * defensively so no process is ever created for a `;` path.
 */
const WINDOWS_TERMINAL = 'wt.exe';

/**
 * Direct spawn of the verified pwsh.exe (no console window host). This is
 * the original, strictly compliant path. It is fully interactive when
 * Obsidian itself was started from a terminal (pwsh attaches to that
 * console); from an Explorer-launched Obsidian the session cannot receive
 * console handles and pwsh exits immediately (documented platform
 * limitation). Used only as the fallback when `wt.exe` is missing.
 */
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

/**
 * Spawn through the Windows Terminal host so that pwsh receives real console
 * handles even when Obsidian was launched from Explorer (no console).
 */
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

    let child: ReturnType<typeof spawn>;
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

    // Obsidian must not wait for the session. In hosted mode the terminal
    // owns pwsh afterwards; in direct mode no pipe handles are held, so the
    // session survives Obsidian closing in both cases.
    child.unref();
  });
}

/**
 * Start the formal, interactive PowerShell session in `targetDir` (the
 * vault root for the ribbon, the right-clicked folder for the context
 * menu).
 *
 * Safe path passing (both modes):
 *  - the target directory is passed as its own argument to
 *    `-WorkingDirectory`
 *  - the child `cwd` is set to the target directory as an additional
 *    guarantee
 *  - the path is never embedded in a command string
 *
 * Session rules (both modes): no `-NoProfile`, no `-NonInteractive`, no
 * `-Command`; the user profile loads normally and nothing is auto-executed.
 *
 * Strategy:
 *  1. refuse paths containing `;` without spawning anything (wt.exe would
 *     split on the semicolon; launching there is unreliable by design);
 *  2. hosted mode via Windows Terminal;
 *  3. if `wt.exe` is missing (ENOENT), fall back to the direct spawn of the
 *     verified pwsh.exe.
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
      // wt.exe is not available on this machine — fall back to the direct
      // spawn of the verified pwsh.exe.
      return spawnDirect(verified, targetDir);
    }
    return outcome;
  });
}
