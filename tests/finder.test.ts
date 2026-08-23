import { describe, expect, it, vi } from 'vitest';
import { PowerShellFinder } from '../src/terminals/windows/finder';
import type { Candidate } from '../src/terminals/windows/candidates';

function candidatesOf(...paths: string[]): Candidate[] {
  return paths.map((path, i) => ({ path, source: `source-${i}` as Candidate['source'] }));
}

type Probe = (exePath: string) => Promise<number | null>;

describe('PowerShellFinder', () => {
  it('tries the next candidate when the first one does not exist', async () => {
    const probe: Probe = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(7);
    const finder = new PowerShellFinder({
      buildCandidates: () => candidatesOf('C:\\missing\\pwsh.exe', 'C:\\ok\\pwsh.exe'),
      probeMajorVersion: probe,
    });
    await expect(finder.resolve()).resolves.toEqual({
      id: 'powershell',
      displayName: 'PowerShell',
      binaryPath: 'C:\\ok\\pwsh.exe',
      extra: { majorVersion: 7 },
    });
    expect(probe).toHaveBeenCalledTimes(2);
    expect(probe).toHaveBeenNthCalledWith(1, 'C:\\missing\\pwsh.exe');
    expect(probe).toHaveBeenNthCalledWith(2, 'C:\\ok\\pwsh.exe');
  });

  it('rejects a PowerShell 6 first candidate and accepts the second', async () => {
    const probe: Probe = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(7);
    const finder = new PowerShellFinder({
      buildCandidates: () => candidatesOf('C:\\ps6\\pwsh.exe', 'C:\\ps7\\pwsh.exe'),
      probeMajorVersion: probe,
    });
    await expect(finder.resolve()).resolves.toEqual({
      id: 'powershell',
      displayName: 'PowerShell',
      binaryPath: 'C:\\ps7\\pwsh.exe',
      extra: { majorVersion: 7 },
    });
  });

  it('returns null when all candidates fail', async () => {
    const probe: Probe = vi.fn().mockResolvedValue(null);
    const finder = new PowerShellFinder({
      buildCandidates: () => candidatesOf('a.exe', 'b.exe', 'c.exe'),
      probeMajorVersion: probe,
    });
    await expect(finder.resolve()).resolves.toBeNull();
    expect(probe).toHaveBeenCalledTimes(3);
  });

  it('caches the verified executable for the rest of the run', async () => {
    const probe: Probe = vi.fn().mockResolvedValue(7);
    const finder = new PowerShellFinder({
      buildCandidates: () => candidatesOf('C:\\pwsh.exe'),
      probeMajorVersion: probe,
    });
    const first = await finder.resolve();
    const second = await finder.resolve();
    expect(second).toEqual(first);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(finder.cached).toEqual({
      id: 'powershell',
      displayName: 'PowerShell',
      binaryPath: 'C:\\pwsh.exe',
      extra: { majorVersion: 7 },
    });
    expect(finder.verifiedPowerShell).toEqual({ path: 'C:\\pwsh.exe', majorVersion: 7 });
  });

  it('re-verifies after invalidation (stale cache on ENOENT)', async () => {
    const probe: Probe = vi.fn().mockResolvedValue(7);
    const finder = new PowerShellFinder({
      buildCandidates: () => candidatesOf('C:\\pwsh.exe'),
      probeMajorVersion: probe,
    });
    await finder.resolve();
    expect(finder.cached).not.toBeNull();
    finder.invalidate();
    expect(finder.cached).toBeNull();
    await finder.resolve();
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('shares one probe chain across rapid concurrent clicks', async () => {
    let releaseProbe: (value: number | null) => void = () => {};
    const probe: Probe = vi.fn().mockImplementation(
      () =>
        new Promise<number | null>((resolve) => {
          releaseProbe = resolve;
        }),
    );
    const finder = new PowerShellFinder({
      buildCandidates: () => candidatesOf('C:\\pwsh.exe'),
      probeMajorVersion: probe,
    });
    const first = finder.resolve();
    const second = finder.resolve();
    const third = finder.resolve();
    releaseProbe(7);
    const results = await Promise.all([first, second, third]);
    for (const result of results) {
      expect(result).toEqual({
        id: 'powershell',
        displayName: 'PowerShell',
        binaryPath: 'C:\\pwsh.exe',
        extra: { majorVersion: 7 },
      });
    }
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('unlocks immediately after resolution so later clicks resolve again', async () => {
    const probe: Probe = vi.fn().mockResolvedValue(7);
    const finder = new PowerShellFinder({
      buildCandidates: () => candidatesOf('C:\\pwsh.exe'),
      probeMajorVersion: probe,
    });
    await finder.resolve();
    const again = finder.resolve();
    await expect(again).resolves.toEqual({
      id: 'powershell',
      displayName: 'PowerShell',
      binaryPath: 'C:\\pwsh.exe',
      extra: { majorVersion: 7 },
    });
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('passes the environment through to candidate building', async () => {
    const env = { PATH: 'C:\\bin' };
    const build = vi.fn().mockReturnValue(candidatesOf('C:\\pwsh.exe'));
    const probe: Probe = vi.fn().mockResolvedValue(7);
    const finder = new PowerShellFinder({
      buildCandidates: build,
      probeMajorVersion: probe,
      env,
    });
    await finder.resolve();
    expect(build).toHaveBeenCalledWith(env);
  });
});
