/**
 * Specification and types for supported Linux terminal emulators.
 */

export interface LinuxTerminalSpec {
  readonly id: string;
  readonly displayName: string;
  readonly binary: string;
  readonly buildArgs: (targetDir: string) => string[];
}
