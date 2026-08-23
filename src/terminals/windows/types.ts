/**
 * Shared types and constants for the Windows PowerShell launch pipeline.
 */

/** A `pwsh.exe` executable whose major version has been verified to be >= 7. */
export interface VerifiedPowerShell {
  readonly path: string;
  readonly majorVersion: number;
}

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
