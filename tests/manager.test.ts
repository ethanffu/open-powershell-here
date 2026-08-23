import { describe, expect, it, vi } from 'vitest';
import { TerminalManager } from '../src/terminals/manager';
import type { ResolvedTerminal, TerminalFinder } from '../src/terminals/types';

function mockFinder(resolved: ResolvedTerminal | null = null): TerminalFinder {
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

describe('TerminalManager', () => {
  it('supports win32 and linux, rejects other platforms', () => {
    expect(new TerminalManager({ platform: 'win32' }).isPlatformSupported()).toBe(true);
    expect(new TerminalManager({ platform: 'linux' }).isPlatformSupported()).toBe(true);
    expect(new TerminalManager({ platform: 'darwin' }).isPlatformSupported()).toBe(false);
  });

  describe('titles and tooltips', () => {
    it('returns unified Open Terminal titles across platforms', () => {
      const winManager = new TerminalManager({ platform: 'win32' });
      expect(winManager.getMenuTitle()).toBe('Open Terminal here');
      expect(winManager.getRibbonTooltip()).toBe('Open Terminal at vault root');

      const linuxManager = new TerminalManager({ platform: 'linux' });
      expect(linuxManager.getMenuTitle()).toBe('Open Terminal here');
      expect(linuxManager.getRibbonTooltip()).toBe('Open Terminal at vault root');
    });
  });

  describe('launch flow and guards', () => {
    it('returns unsupported_platform on unsupported OS', async () => {
      const manager = new TerminalManager({ platform: 'darwin' });
      const result = await manager.launch('/vault');
      expect(result).toEqual({ kind: 'unsupported_platform', platform: 'darwin' });
    });

    it('returns no_target_path when path is null', async () => {
      const manager = new TerminalManager({ platform: 'linux' });
      const result = await manager.launch(null);
      expect(result).toEqual({ kind: 'no_target_path' });
    });

    it('returns semicolon_in_path on Windows but allows semicolons on Linux', async () => {
      const winManager = new TerminalManager({ platform: 'win32' });
      expect(await winManager.launch('C:\\Odd;Vault')).toEqual({ kind: 'semicolon_in_path' });

      const linuxFinder = mockFinder({
        id: 'ghostty',
        displayName: 'Ghostty',
        binaryPath: '/usr/bin/ghostty',
      });
      const launch = vi.fn().mockResolvedValue({ ok: true, pid: 123 });
      const linuxManager = new TerminalManager({ platform: 'linux', finder: linuxFinder, launch });
      const res = await linuxManager.launch('/home/user/Odd;Vault');
      expect(res).toEqual({ kind: 'success' });
      expect(launch).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ghostty' }),
        '/home/user/Odd;Vault',
      );
    });

    it('returns not_found when finder cannot find any terminal', async () => {
      const finder = mockFinder(null);
      const manager = new TerminalManager({ platform: 'linux', finder });
      const res = await manager.launch('/vault');
      expect(res).toEqual({ kind: 'not_found', platform: 'linux' });
    });

    it('invalidates cache and retries once on ENOENT launch failure', async () => {
      const term: ResolvedTerminal = {
        id: 'ghostty',
        displayName: 'Ghostty',
        binaryPath: '/usr/bin/ghostty',
      };
      const finder: TerminalFinder = {
        cached: term,
        resolve: vi.fn().mockResolvedValue(term),
        invalidate: vi.fn(),
      };

      const launch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, code: 'ENOENT', error: new Error('missing') })
        .mockResolvedValueOnce({ ok: true, pid: 999 });

      const manager = new TerminalManager({ platform: 'linux', finder, launch });
      const res = await manager.launch('/vault');
      expect(res).toEqual({ kind: 'success' });
      expect(finder.invalidate).toHaveBeenCalledTimes(1);
      expect(launch).toHaveBeenCalledTimes(2);
    });
  });
});
