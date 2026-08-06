import { Notice, Plugin, type App, type PluginManifest } from 'obsidian';
import { getVaultRootPath } from './vault-path';
import { buildCandidates } from './powershell/candidates';
import { probeMajorVersion } from './powershell/version-probe';
import { launchInteractive } from './powershell/launcher';
import { PowerShellFinder, type FinderDeps } from './powershell/finder';

const RIBBON_ICON = 'terminal';
const RIBBON_TOOLTIP = 'Open PowerShell at vault root';

const NOTICE_NOT_WINDOWS = 'Vault PowerShell only supports Obsidian Desktop on Windows.';
const NOTICE_NO_VAULT_PATH = 'Unable to resolve the local vault path.';
const NOTICE_NOT_FOUND =
  'PowerShell 7 or later was not found. Install PowerShell and restart Obsidian.';
const NOTICE_START_FAILED =
  'PowerShell could not be started. Check the developer console for details.';

/** Test seam: injected dependencies (platform, finder internals). */
export interface PluginDeps {
  readonly finder: FinderDeps;
  readonly platform: NodeJS.Platform;
}

export default class VaultPowerShellPlugin extends Plugin {
  private readonly finder: PowerShellFinder;
  private readonly platform: NodeJS.Platform;

  constructor(app: App, manifest: PluginManifest, deps?: Partial<PluginDeps>) {
    super(app, manifest);
    this.platform = deps?.platform ?? process.platform;
    this.finder = new PowerShellFinder({
      buildCandidates: deps?.finder?.buildCandidates ?? buildCandidates,
      probeMajorVersion: deps?.finder?.probeMajorVersion ?? probeMajorVersion,
      env: deps?.finder?.env,
      debug: deps?.finder?.debug ?? ((message) => console.debug(`[Vault PowerShell] ${message}`)),
    });
  }

  onload(): void {
    // The ribbon is the only entry point: no commands, no settings, no menu
    // items, no keybindings. It stays visible on non-Windows platforms too;
    // clicking it there shows the platform notice.
    this.addRibbonIcon(RIBBON_ICON, RIBBON_TOOLTIP, () => {
      void this.openPowerShell();
    });
  }

  /**
   * Click handler: platform check -> vault path -> find/verify pwsh ->
   * launch. On `ENOENT` at launch time the cache is cleared and a single
   * retry is performed (never more than once per click, never recursive).
   */
  async openPowerShell(): Promise<void> {
    if (this.platform !== 'win32') {
      new Notice(NOTICE_NOT_WINDOWS);
      return;
    }

    const vaultPath = getVaultRootPath(this.app.vault);
    if (vaultPath === null) {
      new Notice(NOTICE_NO_VAULT_PATH);
      return;
    }

    const verified = await this.finder.resolve();
    if (verified === null) {
      new Notice(NOTICE_NOT_FOUND);
      return;
    }

    const outcome = await launchInteractive(verified, vaultPath);
    if (outcome.ok) {
      return; // Success: no notice, per spec.
    }

    if (outcome.code === 'ENOENT') {
      // The cached executable is gone (e.g. it was uninstalled): clear the
      // cache, re-find once, and retry exactly once.
      this.finder.invalidate();
      const reVerified = await this.finder.resolve();
      if (reVerified === null) {
        new Notice(NOTICE_NOT_FOUND);
        return;
      }
      const retry = await launchInteractive(reVerified, vaultPath);
      if (retry.ok) {
        return;
      }
      console.error(
        '[Vault PowerShell] launch failed on retry',
        retry.code,
        retry.error,
      );
      new Notice(NOTICE_START_FAILED);
      return;
    }

    console.error('[Vault PowerShell] launch failed', outcome.code, outcome.error);
    new Notice(NOTICE_START_FAILED);
  }
}
