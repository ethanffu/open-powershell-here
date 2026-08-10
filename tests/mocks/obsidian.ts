/**
 * Test stand-in for the `obsidian` package, which is types-only (it has no
 * runtime entry, so Vite/Vitest cannot resolve it). vitest.config.ts aliases
 * `obsidian` to this file for tests; the real plugin build keeps `obsidian`
 * external (see esbuild.config.mjs).
 *
 * The classes mirror the small surface the plugin uses, and `state` records
 * observable side effects (notices, ribbon registrations, workspace event
 * registrations) for assertions. `Menu`/`MenuItem`/`TFolder`/`TFile` back
 * the single-folder file-menu entry; `Workspace.on` returns an unregister
 * function that `Plugin.onunload()` calls, mirroring Obsidian's
 * `registerEvent` lifecycle so reloads never leave duplicate handlers.
 */

export class FileSystemAdapter {
  constructor(private readonly basePath = '') {}
  getBasePath(): string {
    return this.basePath;
  }
  getFullPath(path: string): string {
    // Mirror the real adapter: join the base path with the (normalized)
    // folder path; the empty path resolves to the base path itself.
    const normalized = path.replace(/[\\/]+/g, '\\').replace(/\\+$/, '');
    return normalized === '' ? this.basePath : `${this.basePath}\\${normalized}`;
  }
}

export class TFolder {
  constructor(public path: string) {}
}

export class TFile {
  constructor(public path: string) {}
}

export class MenuItem {
  title = '';
  icon = '';
  private handler: () => unknown = () => {};

  setTitle(title: string): this {
    this.title = title;
    return this;
  }

  setIcon(icon: string): this {
    this.icon = icon;
    return this;
  }

  onClick(handler: () => unknown): this {
    this.handler = handler;
    return this;
  }

  /** Invoke the click handler (simulates a user click). */
  click(): void {
    this.handler();
  }
}

export class Menu {
  readonly items: MenuItem[] = [];

  addItem(callback: (item: MenuItem) => void): this {
    const item = new MenuItem();
    callback(item);
    this.items.push(item);
    return this;
  }
}

export class Workspace {
  on(event: string, callback: (...args: unknown[]) => unknown): () => void {
    state.workspaceOnCalls.push([event, callback]);
    const handlers = state.workspaceHandlers.get(event) ?? [];
    handlers.push(callback);
    state.workspaceHandlers.set(event, handlers);
    return () => {
      const list = state.workspaceHandlers.get(event) ?? [];
      const index = list.indexOf(callback);
      if (index >= 0) {
        list.splice(index, 1);
      }
    };
  }
}

export class Plugin {
  app: unknown;
  manifest: unknown;

  constructor(app: unknown, manifest: unknown) {
    this.app = app;
    this.manifest = manifest;
  }

  addRibbonIcon(
    icon: string,
    tooltip: string,
    callback: () => void,
  ): { addClass: (cls: string) => void; style: { display: string } } {
    state.ribbonCalls.push([icon, tooltip, callback]);
    const el = {
      addClass: (cls: string) => {
        state.ribbonClasses.push(cls);
      },
      style: { display: '' },
    };
    state.ribbonElements.push(el);
    return el;
  }

  registerEvent(ref: () => void): void {
    state.registerEventCalls.push(ref);
  }

  /** Mirrors Obsidian: unregister all registered event refs on unload. */
  onunload(): void {
    for (const ref of state.registerEventCalls) {
      ref();
    }
    state.registerEventCalls.length = 0;
  }
}

export class Notice {
  constructor(message: string) {
    state.notices.push(message);
  }
}

export const state = {
  notices: [] as string[],
  ribbonCalls: [] as Array<[string, string, () => void]>,
  /** CSS classes added to the ribbon element (Style Settings hook). */
  ribbonClasses: [] as string[],
  /** Fake ribbon elements returned by addRibbonIcon (for style assertions). */
  ribbonElements: [] as Array<{ style: { display: string } }>,
  registerEventCalls: [] as Array<() => void>,
  workspaceOnCalls: [] as Array<[string, (...args: unknown[]) => unknown]>,
  workspaceHandlers: new Map<string, Array<(...args: unknown[]) => unknown>>(),
};

export function resetState(): void {
  state.notices.length = 0;
  state.ribbonCalls.length = 0;
  state.ribbonClasses.length = 0;
  state.ribbonElements.length = 0;
  state.registerEventCalls.length = 0;
  state.workspaceOnCalls.length = 0;
  state.workspaceHandlers.clear();
}

/** Simulate Obsidian firing the `file-menu` event for every registered handler. */
export function emitFileMenu(menu: Menu, file: unknown): void {
  for (const handler of state.workspaceHandlers.get('file-menu') ?? []) {
    handler(menu, file);
  }
}
