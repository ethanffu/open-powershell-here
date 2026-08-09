import {
  FileSystemAdapter,
  Notice,
  Plugin,
  TFolder,
  type App,
  type Menu,
  type PluginManifest,
  type TAbstractFile,
} from 'obsidian';
import { getFolderPath, getVaultRootPath } from './vault-path';
import { buildCandidates } from './powershell/candidates';
import { probeMajorVersion } from './powershell/version-probe';
import { launchInteractive } from './powershell/launcher';
import { PowerShellFinder, type FinderDeps } from './powershell/finder';

const RIBBON_ICON = 'terminal';
const RIBBON_TOOLTIP = 'Open PowerShell at vault root';

const MENU_ITEM_TITLE = 'Open PowerShell here';
const MENU_ITEM_ICON = 'terminal';

const NOTICE_NOT_WINDOWS = 'Vault PowerShell only supports Obsidian Desktop on Windows.';
const NOTICE_NO_VAULT_PATH = 'Unable to resolve the local vault path.';
const NOTICE_NOT_FOUND =
  'PowerShell 7 or later was not found. Install PowerShell and restart Obsidian.';
const NOTICE_START_FAILED =
  'PowerShell could not be started. Check the developer console for details.';
const NOTICE_SEMICOLON =
  'PowerShell cannot be opened for paths containing a semicolon (;).';

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
    // Entry points (exactly two, per user-approved constraint change):
    //   1. the ribbon button -> vault root;
    //   2. the single-folder context-menu item -> that folder.
    // No commands, no settings, no keybindings, no batch (files-menu) entry,
    // no per-file menu entry.
    this.addRibbonIcon(RIBBON_ICON, RIBBON_TOOLTIP, () => {
      void this.openPowerShell(getVaultRootPath(this.app.vault));
    });

    // Lifecycle is managed through `registerEvent`: Obsidian unregisters the
    // handler on disable/reload, so reloads never leave duplicate handlers.
    this.registerEvent(this.app.workspace.on('file-menu', this.onFileMenu));
  }

  /**
   * Single-folder context-menu handler (Obsidian's public `file-menu`
   * event). Shows the item only for exactly one `TFolder` on Windows with a
   * local file system adapter. The target path is resolved when the item is
   * clicked, not when the menu is built.
   */
  private readonly onFileMenu = (menu: Menu, file: TAbstractFile): void => {
    if (this.platform !== 'win32') {
      return;
    }
    if (!(file instanceof TFolder)) {
      return; // plain files and anything else get no item.
    }
    if (!(this.app.vault.adapter instanceof FileSystemAdapter)) {
      return; // non-local adapters (e.g. remote vaults) get no item.
    }
    const folder = file;
    menu.addItem((item) => {
      item
        .setTitle(MENU_ITEM_TITLE)
        .setIcon(MENU_ITEM_ICON)
        .onClick(() => {
          void this.openPowerShell(getFolderPath(this.app.vault, folder));
        });
    });
  };

  /**
   * Shared launch flow for both entry points (ribbon and folder context
   * menu): platform check -> semicolon guard -> target path -> find/verify
   * pwsh -> launch. On `ENOENT` at launch time the cache is cleared and a
   * single retry is performed (never more than once per click, never
   * recursive).
   *
   * `targetDir` is the directory PowerShell should open: the vault root for
   * the ribbon, the right-clicked folder's absolute path for the menu.
   */
  async openPowerShell(targetDir: string | null): Promise<void> {
    if (this.platform !== 'win32') {
      new Notice(NOTICE_NOT_WINDOWS);
      return;
    }

    if (targetDir === null) {
      new Notice(NOTICE_NO_VAULT_PATH);
      return;
    }

    // Semicolon guard (user-approved, 2026-08-09): wt.exe splits its
    // command line on ';', so a path containing one cannot be launched
    // reliably. No process is created at all — not even the version probe.
    if (targetDir.includes(';')) {
      new Notice(NOTICE_SEMICOLON);
      return;
    }

    const verified = await this.finder.resolve();
    if (verified === null) {
      new Notice(NOTICE_NOT_FOUND);
      return;
    }

    const outcome = await launchInteractive(verified, targetDir);
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
      const retry = await launchInteractive(reVerified, targetDir);
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
