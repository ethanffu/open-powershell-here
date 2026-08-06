/**
 * Test stand-in for the `obsidian` package, which is types-only (it has no
 * runtime entry, so Vite/Vitest cannot resolve it). vitest.config.ts aliases
 * `obsidian` to this file for tests; the real plugin build keeps `obsidian`
 * external (see esbuild.config.mjs).
 *
 * The classes mirror the small surface the plugin uses, and `state` records
 * observable side effects (notices, ribbon registrations) for assertions.
 */

export class FileSystemAdapter {
  constructor(private readonly basePath = '') {}
  getBasePath(): string {
    return this.basePath;
  }
}

export class Plugin {
  app: unknown;
  manifest: unknown;
  constructor(app: unknown, manifest: unknown) {
    this.app = app;
    this.manifest = manifest;
  }
  addRibbonIcon(icon: string, tooltip: string, callback: () => void): void {
    state.ribbonCalls.push([icon, tooltip, callback]);
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
};

export function resetState(): void {
  state.notices.length = 0;
  state.ribbonCalls.length = 0;
}
