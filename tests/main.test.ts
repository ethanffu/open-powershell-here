import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emitFileMenu,
  FileSystemAdapter,
  Menu,
  resetState,
  state,
  TFile,
  TFolder,
  Workspace,
} from './mocks/obsidian';
import VaultTerminalPlugin, {
  type PluginDeps,
  NOTICE_NOT_FOUND_LINUX,
  NOTICE_NOT_FOUND_WINDOWS,
  NOTICE_NO_VAULT_PATH,
  NOTICE_SEMICOLON,
  NOTICE_START_FAILED,
  NOTICE_UNSUPPORTED_PLATFORM,
} from '../src/main';
import { TerminalManager } from '../src/terminals/manager';
import type { ResolvedTerminal, TerminalFinder } from '../src/terminals/types';

const VAULT_WIN = "E:\\Test Vault & (x) '中文'";
const PWSH = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';

function makeMockFinder(resolved: ResolvedTerminal | null): TerminalFinder {
  let cached = resolved;
  return {
    get cached() {
      return cached;
    },
    resolve: vi.fn().mockImplementation(async () => cached),
    invalidate: vi.fn().mockImplementation(() => {
      cached = null;
    }),
  };
}

interface MockApp {
  vault: {
    adapter: unknown;
  };
  workspace: Workspace;
}

function setMockAdapter(plugin: VaultTerminalPlugin, adapter: unknown): void {
  const app = plugin.app as unknown as MockApp;
  app.vault.adapter = adapter;
}

function makePlugin(overrides: Partial<PluginDeps> = {}, vaultPath = VAULT_WIN): VaultTerminalPlugin {
  const platform = overrides.platform ?? 'win32';
  const defaultFinder = platform === 'win32'
    ? makeMockFinder({
        id: 'powershell',
        displayName: 'PowerShell',
        binaryPath: PWSH,
        extra: { majorVersion: 7 },
      })
    : makeMockFinder({
        id: 'ghostty',
        displayName: 'Ghostty',
        binaryPath: '/usr/bin/ghostty',
      });

  const manager = overrides.terminalManager ?? new TerminalManager({
    platform,
    finder: defaultFinder,
    launch: vi.fn().mockResolvedValue({ ok: true, pid: 1234 }),
    ...overrides.managerDeps,
  });

  const app = {
    vault: {
      adapter: new FileSystemAdapter(vaultPath),
    },
    workspace: new Workspace(),
  };

  return new VaultTerminalPlugin(app as never, {} as never, {
    platform,
    terminalManager: manager,
    ...overrides,
  });
}

function rightClick(target: unknown): Menu {
  const menu = new Menu();
  emitFileMenu(menu, target);
  return menu;
}

function withFakeDom(bodyClass: string | null, fn: () => void): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const savedDocument = globals.document;
  const savedObserver = globals.MutationObserver;

  globals.document = {
    body: {
      classList: {
        contains: (cls: string) => cls === bodyClass,
      },
    },
  };
  globals.MutationObserver = class {
    observe(): void {}
    disconnect(): void {}
  };

  try {
    fn();
  } finally {
    if (savedDocument === undefined) {
      delete globals.document;
    } else {
      globals.document = savedDocument;
    }
    if (savedObserver === undefined) {
      delete globals.MutationObserver;
    } else {
      globals.MutationObserver = savedObserver;
    }
  }
}

describe('VaultTerminalPlugin', () => {
  beforeEach(() => {
    resetState();
  });

  describe('ribbon integration', () => {
    it('registers the ribbon button on load with Open Terminal tooltip', () => {
      const winPlugin = makePlugin({ platform: 'win32' });
      winPlugin.onload();
      expect(state.ribbonCalls).toHaveLength(1);
      expect(state.ribbonCalls[0][0]).toBe('terminal');
      expect(state.ribbonCalls[0][1]).toBe('Open Terminal at vault root');

      resetState();
      const linuxPlugin = makePlugin({ platform: 'linux' });
      linuxPlugin.onload();
      expect(state.ribbonCalls).toHaveLength(1);
      expect(state.ribbonCalls[0][1]).toBe('Open Terminal at vault root');
    });

    it('attaches stable classes to ribbon element for Style Settings', () => {
      const plugin = makePlugin();
      plugin.onload();
      expect(state.ribbonClasses).toContain('vault-terminal-ribbon');
      expect(state.ribbonClasses).toContain('vault-powershell-ribbon');
    });

    it('enforces visibility when hide-vault-terminal-ribbon is present on body', () => {
      withFakeDom('hide-vault-terminal-ribbon', () => {
        const plugin = makePlugin();
        plugin.onload();
        expect(state.ribbonElements[0].style.display).toBe('none');
      });
    });

    it('enforces visibility when legacy hide-vault-powershell-ribbon is present on body', () => {
      withFakeDom('hide-vault-powershell-ribbon', () => {
        const plugin = makePlugin();
        plugin.onload();
        expect(state.ribbonElements[0].style.display).toBe('none');
      });
    });

    it('keeps ribbon visible when hide class is absent', () => {
      withFakeDom(null, () => {
        const plugin = makePlugin();
        plugin.onload();
        expect(state.ribbonElements[0].style.display).toBe('');
      });
    });
  });

  describe('context menu integration', () => {
    it('adds menu item for a TFolder', () => {
      const plugin = makePlugin({ platform: 'linux' });
      plugin.onload();
      const menu = rightClick(new TFolder('src'));
      expect(menu.items).toHaveLength(1);
      expect(menu.items[0].title).toBe('Open Terminal here');
      expect(menu.items[0].icon).toBe('terminal');
    });

    it('adds menu item for a TFile (targeting parent folder)', () => {
      const plugin = makePlugin({ platform: 'linux' });
      plugin.onload();
      const parent = new TFolder('src/utils');
      const file = new TFile('src/utils/helper.ts', parent);
      const menu = rightClick(file);
      expect(menu.items).toHaveLength(1);
      expect(menu.items[0].title).toBe('Open Terminal here');
    });

    it('does not add menu item on unsupported platforms', () => {
      const plugin = makePlugin({ platform: 'darwin' });
      plugin.onload();
      const menu = rightClick(new TFolder('src'));
      expect(menu.items).toHaveLength(0);
    });

    it('does not add menu item for non-filesystem adapters', () => {
      const plugin = makePlugin({ platform: 'linux' });
      setMockAdapter(plugin, {});
      plugin.onload();
      const menu = rightClick(new TFolder('src'));
      expect(menu.items).toHaveLength(0);
    });
  });

  describe('notices and error reporting', () => {
    it('notifies on unsupported platform launch', async () => {
      const plugin = makePlugin({ platform: 'darwin' });
      await plugin.openTerminal('/some/path');
      expect(state.notices).toContain(NOTICE_UNSUPPORTED_PLATFORM);
    });

    it('notifies when vault path cannot be resolved', async () => {
      const plugin = makePlugin();
      await plugin.openTerminal(null);
      expect(state.notices).toContain(NOTICE_NO_VAULT_PATH);
    });

    it('notifies on Windows semicolon path refusal', async () => {
      const plugin = makePlugin({ platform: 'win32' });
      await plugin.openTerminal('C:\\Odd;Path');
      expect(state.notices).toContain(NOTICE_SEMICOLON);
    });

    it('notifies when PowerShell is not found on Windows', async () => {
      const finder = makeMockFinder(null);
      const manager = new TerminalManager({ platform: 'win32', finder });
      const plugin = makePlugin({ platform: 'win32', terminalManager: manager });
      await plugin.openTerminal('C:\\Vault');
      expect(state.notices).toContain(NOTICE_NOT_FOUND_WINDOWS);
    });

    it('notifies when no terminal is found on Linux', async () => {
      const finder = makeMockFinder(null);
      const manager = new TerminalManager({ platform: 'linux', finder });
      const plugin = makePlugin({ platform: 'linux', terminalManager: manager });
      await plugin.openTerminal('/home/user/vault');
      expect(state.notices).toContain(NOTICE_NOT_FOUND_LINUX);
    });

    it('notifies when launch fails with generic error', async () => {
      const finder = makeMockFinder({ id: 'ghostty', displayName: 'Ghostty', binaryPath: '/usr/bin/ghostty' });
      const launch = vi.fn().mockResolvedValue({ ok: false, code: 'UNKNOWN', error: new Error('Permission denied') });
      const manager = new TerminalManager({ platform: 'linux', finder, launch });
      const plugin = makePlugin({ platform: 'linux', terminalManager: manager });
      await plugin.openTerminal('/home/user/vault');
      expect(state.notices).toContain(NOTICE_START_FAILED);
    });
  });
});
