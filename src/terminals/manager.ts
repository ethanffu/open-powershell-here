import type { LaunchOutcome, ResolvedTerminal, TerminalFinder } from './types';
import { PowerShellFinder } from './windows/finder';
import { launchInteractive as launchWindowsInteractive } from './windows/launcher';
import type { VerifiedPowerShell } from './windows/types';
import { LinuxTerminalFinder } from './linux/finder';
import { launchLinuxTerminal } from './linux/launcher';

export type TerminalLaunchResult =
  | { readonly kind: 'success' }
  | { readonly kind: 'unsupported_platform'; readonly platform: string }
  | { readonly kind: 'no_target_path' }
  | { readonly kind: 'semicolon_in_path' }
  | { readonly kind: 'not_found'; readonly platform: string }
  | { readonly kind: 'failed'; readonly error?: Error };

export interface TerminalManagerDeps {
  readonly platform: NodeJS.Platform;
  readonly finder?: TerminalFinder;
  readonly launch?: (terminal: ResolvedTerminal, targetDir: string) => Promise<LaunchOutcome>;
}

export class TerminalManager {
  readonly platform: NodeJS.Platform;
  readonly finder: TerminalFinder | null;
  private readonly launcher: ((terminal: ResolvedTerminal, targetDir: string) => Promise<LaunchOutcome>) | null;
  private explicitPreferredTerminal: string | null = null;

  constructor(deps?: Partial<TerminalManagerDeps>) {
    this.platform = deps?.platform ?? process.platform;

    if (deps?.finder !== undefined) {
      this.finder = deps.finder;
    } else if (this.platform === 'win32') {
      this.finder = new PowerShellFinder();
    } else if (this.platform === 'linux') {
      this.finder = new LinuxTerminalFinder();
    } else {
      this.finder = null;
    }

    if (deps?.launch !== undefined) {
      this.launcher = deps.launch;
    } else if (this.platform === 'win32') {
      this.launcher = (term, dir) => {
        const verified: VerifiedPowerShell = {
          path: term.binaryPath,
          majorVersion: (term.extra?.majorVersion as number) ?? 7,
        };
        return launchWindowsInteractive(verified, dir);
      };
    } else if (this.platform === 'linux') {
      this.launcher = (term, dir) => launchLinuxTerminal(term, dir);
    } else {
      this.launcher = null;
    }
  }

  isPlatformSupported(): boolean {
    return this.platform === 'win32' || this.platform === 'linux';
  }

  getMenuTitle(): string {
    return 'Open Terminal here';
  }

  getRibbonTooltip(): string {
    return 'Open Terminal at vault root';
  }

  setPreferredTerminal(id: string | null): void {
    this.explicitPreferredTerminal = id;
    if (this.finder instanceof LinuxTerminalFinder) {
      this.finder.setPreferredTerminal(id);
    }
  }

  detectPreferredTerminalFromDom(): string | null {
    if (this.explicitPreferredTerminal !== null) {
      return this.explicitPreferredTerminal;
    }
    if (typeof document === 'undefined') {
      return null;
    }
    const classList = document.body.classList;
    for (const cls of Array.from(classList)) {
      if (cls.startsWith('terminal-choice-') && cls !== 'terminal-choice-auto') {
        return cls.replace('terminal-choice-', '');
      }
    }
    return null;
  }

  async launch(targetDir: string | null, preferredTerminal?: string | null): Promise<TerminalLaunchResult> {
    if (!this.isPlatformSupported() || this.finder === null || this.launcher === null) {
      return { kind: 'unsupported_platform', platform: this.platform };
    }

    if (targetDir === null) {
      return { kind: 'no_target_path' };
    }

    if (this.platform === 'win32' && targetDir.includes(';')) {
      return { kind: 'semicolon_in_path' };
    }

    const preferred = preferredTerminal ?? this.detectPreferredTerminalFromDom();
    if (this.finder instanceof LinuxTerminalFinder) {
      this.finder.setPreferredTerminal(preferred);
    }

    const verified = await this.finder.resolve();
    if (verified === null) {
      return { kind: 'not_found', platform: this.platform };
    }

    const outcome = await this.launcher(verified, targetDir);
    if (outcome.ok) {
      return { kind: 'success' };
    }

    if (outcome.code === 'ENOENT') {
      this.finder.invalidate();
      const reVerified = await this.finder.resolve();
      if (reVerified === null) {
        return { kind: 'not_found', platform: this.platform };
      }
      const retry = await this.launcher(reVerified, targetDir);
      if (retry.ok) {
        return { kind: 'success' };
      }
      return { kind: 'failed', error: retry.error };
    }

    return { kind: 'failed', error: outcome.error };
  }
}
