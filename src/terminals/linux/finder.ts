import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import type { ResolvedTerminal, TerminalFinder } from '../types';
import type { LinuxTerminalSpec } from './types';
import { LINUX_TERMINALS } from './candidates';

export interface LinuxFinderDeps {
  readonly specs: readonly LinuxTerminalSpec[];
  readonly checkExecutable: (path: string) => Promise<boolean>;
  readonly env?: NodeJS.ProcessEnv;
  readonly debug?: (message: string) => void;
}

async function defaultCheckExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export class LinuxTerminalFinder implements TerminalFinder {
  private verified: ResolvedTerminal | null = null;
  private currentPreferredId: string | null = null;
  private resolving: Promise<ResolvedTerminal | null> | null = null;
  private readonly deps: LinuxFinderDeps;

  constructor(deps?: Partial<LinuxFinderDeps>) {
    this.deps = {
      specs: deps?.specs ?? LINUX_TERMINALS,
      checkExecutable: deps?.checkExecutable ?? defaultCheckExecutable,
      env: deps?.env,
      debug: deps?.debug ?? ((msg) => console.debug(`[Open Terminal Here] ${msg}`)),
    };
  }

  get cached(): ResolvedTerminal | null {
    return this.verified;
  }

  setPreferredTerminal(id: string | null): void {
    if (this.currentPreferredId !== id) {
      this.currentPreferredId = id;
      this.invalidate();
    }
  }

  resolve(preferredId?: string | null): Promise<ResolvedTerminal | null> {
    const targetPreferred = preferredId ?? this.currentPreferredId;
    if (targetPreferred !== this.currentPreferredId) {
      this.currentPreferredId = targetPreferred;
      this.invalidate();
    }

    if (this.verified !== null) {
      return Promise.resolve(this.verified);
    }
    if (this.resolving !== null) {
      return this.resolving;
    }
    this.resolving = this.findBest(this.currentPreferredId).finally(() => {
      this.resolving = null;
    });
    return this.resolving;
  }

  invalidate(): void {
    this.verified = null;
  }

  async listInstalledTerminals(): Promise<Array<{ spec: LinuxTerminalSpec; binaryPath: string }>> {
    const pathEnv = (this.deps.env ?? process.env).PATH ?? '';
    const dirs = pathEnv.split(':').filter(Boolean);
    const installed: Array<{ spec: LinuxTerminalSpec; binaryPath: string }> = [];

    for (const spec of this.deps.specs) {
      for (const dir of dirs) {
        const fullPath = join(dir, spec.binary);
        const isExecutable = await this.deps.checkExecutable(fullPath);
        if (isExecutable) {
          installed.push({ spec, binaryPath: fullPath });
          break;
        }
      }
    }
    return installed;
  }

  private async findBest(preferredId?: string | null): Promise<ResolvedTerminal | null> {
    const pathEnv = (this.deps.env ?? process.env).PATH ?? '';
    const dirs = pathEnv.split(':').filter(Boolean);

    // If user has a preferred terminal, attempt to find that one first
    if (preferredId !== null && preferredId !== undefined && preferredId !== 'auto' && preferredId !== '') {
      const normalizedPreferred = preferredId.toLowerCase().replace(/^terminal-choice-/, '');
      const match = this.deps.specs.find(
        (s) => s.id.toLowerCase() === normalizedPreferred || s.binary.toLowerCase() === normalizedPreferred,
      );
      if (match !== undefined) {
        for (const dir of dirs) {
          const fullPath = join(dir, match.binary);
          const isExecutable = await this.deps.checkExecutable(fullPath);
          if (isExecutable) {
            this.verified = {
              id: match.id,
              displayName: match.displayName,
              binaryPath: fullPath,
              extra: { spec: match },
            };
            this.deps.debug?.(`found preferred terminal: ${match.displayName} at ${fullPath}`);
            return this.verified;
          }
        }
        this.deps.debug?.(`preferred terminal ${match.displayName} not found on system`);
      }
    }

    // Fallback: search all supported candidates in order
    for (const spec of this.deps.specs) {
      for (const dir of dirs) {
        const fullPath = join(dir, spec.binary);
        const isExecutable = await this.deps.checkExecutable(fullPath);
        if (isExecutable) {
          this.verified = {
            id: spec.id,
            displayName: spec.displayName,
            binaryPath: fullPath,
            extra: { spec },
          };
          this.deps.debug?.(`found terminal: ${spec.displayName} at ${fullPath}`);
          return this.verified;
        }
      }
      this.deps.debug?.(`rejected terminal ${spec.displayName} (${spec.binary})`);
    }

    return null;
  }
}
