import { describe, expect, it, vi } from 'vitest';
import { LinuxTerminalFinder } from '../src/terminals/linux/finder';
import type { LinuxTerminalSpec } from '../src/terminals/linux/types';

const TEST_SPECS: LinuxTerminalSpec[] = [
  { id: 'ghostty', displayName: 'Ghostty', binary: 'ghostty', buildArgs: (d) => [d] },
  { id: 'konsole', displayName: 'Konsole', binary: 'konsole', buildArgs: (d) => [d] },
  { id: 'alacritty', displayName: 'Alacritty', binary: 'alacritty', buildArgs: (d) => [d] },
];

describe('LinuxTerminalFinder', () => {
  it('resolves the first available terminal in spec priority order by default', async () => {
    const checkExecutable = vi.fn().mockImplementation(async (path: string) => {
      return path === '/usr/bin/ghostty' || path === '/usr/bin/konsole';
    });

    const finder = new LinuxTerminalFinder({
      specs: TEST_SPECS,
      checkExecutable,
      env: { PATH: '/usr/local/bin:/usr/bin' },
    });

    const resolved = await finder.resolve();
    expect(resolved).toEqual({
      id: 'ghostty',
      displayName: 'Ghostty',
      binaryPath: '/usr/bin/ghostty',
      extra: { spec: TEST_SPECS[0] },
    });
  });

  it('prefers a user-selected terminal over the default priority order', async () => {
    const checkExecutable = vi.fn().mockImplementation(async (path: string) => {
      return path === '/usr/bin/ghostty' || path === '/usr/bin/konsole';
    });

    const finder = new LinuxTerminalFinder({
      specs: TEST_SPECS,
      checkExecutable,
      env: { PATH: '/usr/bin' },
    });

    // User chooses 'konsole' via Style Settings
    finder.setPreferredTerminal('konsole');
    const resolved = await finder.resolve();
    expect(resolved?.id).toBe('konsole');
    expect(resolved?.binaryPath).toBe('/usr/bin/konsole');
  });

  it('falls back to default priority order when preferred terminal is not installed', async () => {
    const checkExecutable = vi.fn().mockImplementation(async (path: string) => {
      return path === '/usr/bin/ghostty';
    });

    const finder = new LinuxTerminalFinder({
      specs: TEST_SPECS,
      checkExecutable,
      env: { PATH: '/usr/bin' },
    });

    // User chooses 'alacritty', which is not installed
    finder.setPreferredTerminal('alacritty');
    const resolved = await finder.resolve();
    expect(resolved?.id).toBe('ghostty');
    expect(resolved?.binaryPath).toBe('/usr/bin/ghostty');
  });

  it('lists all installed terminals on the system', async () => {
    const checkExecutable = vi.fn().mockImplementation(async (path: string) => {
      return path === '/usr/bin/ghostty' || path === '/usr/bin/konsole';
    });

    const finder = new LinuxTerminalFinder({
      specs: TEST_SPECS,
      checkExecutable,
      env: { PATH: '/usr/bin' },
    });

    const installed = await finder.listInstalledTerminals();
    expect(installed.map((i) => i.spec.id)).toEqual(['ghostty', 'konsole']);
  });

  it('caches the resolved terminal and does not re-scan until invalidated', async () => {
    const checkExecutable = vi.fn().mockImplementation(async (path: string) => {
      return path === '/usr/bin/ghostty';
    });

    const finder = new LinuxTerminalFinder({
      specs: TEST_SPECS,
      checkExecutable,
      env: { PATH: '/usr/bin' },
    });

    const first = await finder.resolve();
    const second = await finder.resolve();
    expect(first).toEqual(second);
    expect(finder.cached).toEqual(first);
    expect(checkExecutable).toHaveBeenCalledTimes(1);

    finder.invalidate();
    expect(finder.cached).toBeNull();

    await finder.resolve();
    expect(checkExecutable).toHaveBeenCalledTimes(2);
  });
});
