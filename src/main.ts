import {
  FileSystemAdapter,
  Notice,
  Plugin,
  TFile,
  TFolder,
  type App,
  type Menu,
  type PluginManifest,
  type TAbstractFile,
} from 'obsidian';
import { getTargetPath, getVaultRootPath } from './vault-path';
import { TerminalManager, type TerminalManagerDeps } from './terminals/manager';

const RIBBON_ICON = 'terminal';

/**
 * Body classes applied by Style Settings when "Hide the ribbon button"
 * is ON.
 */
const HIDE_RIBBON_BODY_CLASSES = [
  'hide-vault-terminal-ribbon',
  'hide-vault-powershell-ribbon',
];

const MENU_ITEM_ICON = 'terminal';

export const NOTICE_UNSUPPORTED_PLATFORM =
  'Open Terminal Here currently supports Windows and Linux.';
export const NOTICE_NO_VAULT_PATH = 'Unable to resolve the local vault path.';
export const NOTICE_NOT_FOUND_WINDOWS =
  'PowerShell 7 or later was not found. Install PowerShell and restart Obsidian.';
export const NOTICE_NOT_FOUND_LINUX =
  'No supported terminal emulator was found. Install Ghostty (recommended) or another supported terminal.';
export const NOTICE_START_FAILED =
  'Terminal could not be started. Check the developer console for details.';
export const NOTICE_SEMICOLON =
  'PowerShell cannot be opened for paths containing a semicolon (;).';

/** Test seam: injected dependencies (platform, terminal manager). */
export interface PluginDeps {
  readonly platform?: NodeJS.Platform;
  readonly terminalManager?: TerminalManager;
  readonly managerDeps?: Partial<TerminalManagerDeps>;
}

export default class VaultTerminalPlugin extends Plugin {
  readonly terminalManager: TerminalManager;
  private ribbonEl: HTMLElement | null = null;
  private ribbonObserver: MutationObserver | null = null;

  constructor(app: App, manifest: PluginManifest, deps?: Partial<PluginDeps>) {
    super(app, manifest);
    if (deps?.terminalManager !== undefined) {
      this.terminalManager = deps.terminalManager;
    } else {
      const platform = deps?.platform ?? deps?.managerDeps?.platform;
      this.terminalManager = new TerminalManager({
        platform,
        ...deps?.managerDeps,
      });
    }
  }

  onload(): void {
    const tooltip = this.terminalManager.getRibbonTooltip();
    const ribbonEl = this.addRibbonIcon(RIBBON_ICON, tooltip, () => {
      void this.openTerminal(getVaultRootPath(this.app.vault));
    });

    ribbonEl.addClass('vault-terminal-ribbon');
    ribbonEl.addClass('vault-powershell-ribbon');
    this.ribbonEl = ribbonEl;
    this.setupRibbonVisibilityEnforcement();

    this.registerEvent(this.app.workspace.on('file-menu', this.onFileMenu));
  }

  onunload(): void {
    this.ribbonObserver?.disconnect();
    this.ribbonObserver = null;
    this.ribbonEl = null;
    super.onunload();
  }

  /**
   * Enforce the Style Settings hide toggle in JS via MutationObserver.
   */
  private setupRibbonVisibilityEnforcement(): void {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return;
    }
    const apply = (): void => {
      if (this.ribbonEl === null) {
        return;
      }
      const shouldHide = HIDE_RIBBON_BODY_CLASSES.some((cls) =>
        document.body.classList.contains(cls),
      );
      this.ribbonEl.style.display = shouldHide ? 'none' : '';
    };
    this.ribbonObserver = new MutationObserver(apply);
    this.ribbonObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
    apply();
  }

  /**
   * Context-menu handler for folders and files.
   * - Shows for a single TFolder (opens that folder).
   * - Shows for a single TFile (opens that file's parent folder).
   */
  private readonly onFileMenu = (menu: Menu, file: TAbstractFile): void => {
    if (!this.terminalManager.isPlatformSupported()) {
      return;
    }
    if (!(file instanceof TFolder || file instanceof TFile)) {
      return;
    }
    if (!(this.app.vault.adapter instanceof FileSystemAdapter)) {
      return;
    }

    const title = this.terminalManager.getMenuTitle();
    menu.addItem((item) => {
      item
        .setTitle(title)
        .setIcon(MENU_ITEM_ICON)
        .onClick(() => {
          void this.openTerminal(getTargetPath(this.app.vault, file));
        });
    });
  };

  /**
   * Open the native terminal at the given target directory.
   */
  async openTerminal(targetDir: string | null): Promise<void> {
    const result = await this.terminalManager.launch(targetDir);

    switch (result.kind) {
      case 'success':
        return;
      case 'unsupported_platform':
        new Notice(NOTICE_UNSUPPORTED_PLATFORM);
        return;
      case 'no_target_path':
        new Notice(NOTICE_NO_VAULT_PATH);
        return;
      case 'semicolon_in_path':
        new Notice(NOTICE_SEMICOLON);
        return;
      case 'not_found':
        new Notice(
          result.platform === 'win32'
            ? NOTICE_NOT_FOUND_WINDOWS
            : NOTICE_NOT_FOUND_LINUX,
        );
        return;
      case 'failed':
        console.error('[Open Terminal Here] launch failed', result.error);
        new Notice(NOTICE_START_FAILED);
        return;
    }
  }
}
