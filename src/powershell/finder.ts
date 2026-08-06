import type { VerifiedPowerShell } from './types';
import type { Candidate } from './candidates';

export interface FinderDeps {
  readonly buildCandidates: (env?: NodeJS.ProcessEnv) => Candidate[];
  readonly probeMajorVersion: (exePath: string) => Promise<number | null>;
  readonly env?: NodeJS.ProcessEnv;
  readonly debug?: (message: string) => void;
}

/**
 * Resolves and caches the verified `pwsh.exe` for the current Obsidian run.
 *
 * - The verified executable path and major version are cached in memory only.
 * - A "resolving" single-flight lock ensures fast double clicks cannot start
 *   multiple parallel probe chains; the lock is released as soon as the
 *   resolution settles.
 * - Once cached, every `resolve()` returns synchronously, so consecutive
 *   clicks open a new window every time (no cooldown).
 * - `invalidate()` clears the cache so the caller can re-resolve once after
 *   an `ENOENT` at launch time.
 */
export class PowerShellFinder {
  private verified: VerifiedPowerShell | null = null;
  private resolving: Promise<VerifiedPowerShell | null> | null = null;

  constructor(private readonly deps: FinderDeps) {}

  /** The currently cached result, if any. */
  get cached(): VerifiedPowerShell | null {
    return this.verified;
  }

  /** Resolve once; concurrent callers share the same in-flight probe chain. */
  resolve(): Promise<VerifiedPowerShell | null> {
    if (this.verified !== null) {
      return Promise.resolve(this.verified);
    }
    if (this.resolving !== null) {
      return this.resolving;
    }
    this.resolving = this.findBest().finally(() => {
      this.resolving = null;
    });
    return this.resolving;
  }

  /** Drop the cached result (e.g. the cached executable is gone). */
  invalidate(): void {
    this.verified = null;
  }

  private async findBest(): Promise<VerifiedPowerShell | null> {
    const candidates = this.deps.buildCandidates(this.deps.env);
    for (const candidate of candidates) {
      const major = await this.deps.probeMajorVersion(candidate.path);
      if (major !== null) {
        this.verified = { path: candidate.path, majorVersion: major };
        this.deps.debug?.(`verified pwsh: ${candidate.path} (major ${major})`);
        return this.verified;
      }
      this.deps.debug?.(`rejected candidate ${candidate.source}: ${candidate.path}`);
    }
    return null;
  }
}
