/**
 * Shared types and constants for the PowerShell launch pipeline.
 */

/** A `pwsh.exe` executable whose major version has been verified to be >= 7. */
export interface VerifiedPowerShell {
  readonly path: string;
  readonly majorVersion: number;
}

/** Outcome of a formal (interactive) session launch. */
export type LaunchOutcome =
  | { readonly ok: true; readonly pid: number }
  | { readonly ok: false; readonly code: 'ENOENT' | 'UNKNOWN'; readonly error: Error };

/** Arguments used ONLY for the hidden version probe. */
export const PROBE_ARGS = [
  '-NoLogo',
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  '$PSVersionTable.PSVersion.Major',
] as const;

/** Timeout for the hidden version probe. */
export const PROBE_TIMEOUT_MS = 5000;
