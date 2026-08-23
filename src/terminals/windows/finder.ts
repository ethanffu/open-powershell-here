import type { ResolvedTerminal, TerminalFinder } from '../types';
import type { VerifiedPowerShell } from './types';
import type { Candidate } from './candidates';
import { buildCandidates } from './candidates';
import { probeMajorVersion } from './version-probe';

export interface FinderDeps {
  readonly buildCandidates: (env?: NodeJS.ProcessEnv) => Candidate[];
  readonly probeMajorVersion: (exePath: string) => Promise<number | null>;
  readonly env?: NodeJS.ProcessEnv;
  readonly debug?: (message: string) => void;
}

export class PowerShellFinder implements TerminalFinder {
  private verified: VerifiedPowerShell | null = null;
  private resolving: Promise<ResolvedTerminal | null> | null = null;
  private readonly deps: FinderDeps;

  constructor(deps?: Partial<FinderDeps>) {
    this.deps = {
      buildCandidates: deps?.buildCandidates ?? buildCandidates,
      probeMajorVersion: deps?.probeMajorVersion ?? probeMajorVersion,
      env: deps?.env,
      debug: deps?.debug ?? ((msg) => console.debug(`[Open Terminal Here] ${msg}`)),
    };
  }

  get cached(): ResolvedTerminal | null {
    if (this.verified === null) {
      return null;
    }
    return {
      id: 'powershell',
      displayName: 'PowerShell',
      binaryPath: this.verified.path,
      extra: { majorVersion: this.verified.majorVersion },
    };
  }

  get verifiedPowerShell(): VerifiedPowerShell | null {
    return this.verified;
  }

  resolve(): Promise<ResolvedTerminal | null> {
    if (this.verified !== null) {
      return Promise.resolve(this.cached);
    }
    if (this.resolving !== null) {
      return this.resolving;
    }
    this.resolving = this.findBest().finally(() => {
      this.resolving = null;
    });
    return this.resolving;
  }

  invalidate(): void {
    this.verified = null;
  }

  private async findBest(): Promise<ResolvedTerminal | null> {
    const candidates = this.deps.buildCandidates(this.deps.env);
    for (const candidate of candidates) {
      const major = await this.deps.probeMajorVersion(candidate.path);
      if (major !== null) {
        this.verified = { path: candidate.path, majorVersion: major };
        this.deps.debug?.(`verified pwsh: ${candidate.path} (major ${major})`);
        return this.cached;
      }
      this.deps.debug?.(`rejected candidate ${candidate.source}: ${candidate.path}`);
    }
    return null;
  }
}
