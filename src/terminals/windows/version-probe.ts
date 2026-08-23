import { execFile, type ExecFileOptions } from 'node:child_process';
import { PROBE_ARGS, PROBE_TIMEOUT_MS } from './types';

export interface ProbeOptions {
  readonly timeoutMs?: number;
}

/** Callback-style wrapper around `execFile` (never uses a shell). */
function runExecFile(
  file: string,
  args: string[],
  options: ExecFileOptions,
): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, _stderr) => {
      if (error !== null) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      const text = typeof stdout === 'string' ? stdout : stdout.toString('utf8');
      resolve({ stdout: text });
    });
  });
}

/**
 * Asynchronously probe a candidate with the fixed hidden probe command:
 *
 *   pwsh.exe -NoLogo -NoProfile -NonInteractive -Command $PSVersionTable.PSVersion.Major
 *
 * Requirements enforced here:
 *  - no shell (`shell: false`)
 *  - argument array, never a joined command line
 *  - `windowsHide: true` (no window flash)
 *  - bounded timeout (default 5 s)
 *  - only exit code 0 is accepted (`execFile` rejects otherwise)
 *  - output must trim to a plain integer, and the major version must be >= 7.
 *    PowerShell 6 is rejected by design.
 *
 * Returns the major version on success, or `null` for any failure. Never
 * throws and never blocks the UI thread.
 */
export async function probeMajorVersion(
  exePath: string,
  options: ProbeOptions = {},
): Promise<number | null> {
  try {
    const { stdout } = await runExecFile(exePath, [...PROBE_ARGS], {
      shell: false,
      windowsHide: true,
      timeout: options.timeoutMs ?? PROBE_TIMEOUT_MS,
      encoding: 'utf8',
      env: process.env,
    });
    return parseMajorVersion(stdout);
  } catch {
    return null;
  }
}

/**
 * Parse the probe output. Only a trimmed, plain, non-negative integer is
 * accepted; values below 7 (e.g. PowerShell 6) are rejected.
 */
export function parseMajorVersion(rawOutput: string): number | null {
  const trimmed = rawOutput.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    return null;
  }
  const major = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(major)) {
    return null;
  }
  return major >= 7 ? major : null;
}
