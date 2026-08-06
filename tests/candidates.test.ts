import { describe, expect, it } from 'vitest';
import { buildCandidates, dedupeCandidates } from '../src/powershell/candidates';

function env(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    PATH: 'C:\\bin',
    ProgramFiles: 'C:\\Program Files',
    USERPROFILE: 'C:\\Users\\alice',
    ...overrides,
  };
}

describe('buildCandidates', () => {
  it('orders PATH first, Program Files second, dotnet tools third', () => {
    const candidates = buildCandidates(env());
    expect(candidates.map((c) => c.path)).toEqual([
      'pwsh.exe',
      'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      'C:\\Users\\alice\\.dotnet\\tools\\pwsh.exe',
    ]);
  });

  it('keeps the PATH candidate on top even when env vars are set', () => {
    const candidates = buildCandidates(env());
    expect(candidates[0].path).toBe('pwsh.exe');
    expect(candidates[0].source).toBe('PATH');
  });

  it('labels the fixed install candidates with their source', () => {
    const candidates = buildCandidates(env());
    expect(candidates[1].source).toBe('ProgramFiles');
    expect(candidates[2].source).toBe('UserProfileDotnetTools');
  });

  it('does not crash when environment variables are missing', () => {
    expect(buildCandidates({ PATH: 'C:\\bin' }).map((c) => c.path)).toEqual(['pwsh.exe']);
    expect(buildCandidates({}).map((c) => c.path)).toEqual(['pwsh.exe']);
    expect(buildCandidates(undefined).length).toBeGreaterThanOrEqual(1);
  });

  it('skips empty environment variables', () => {
    const candidates = buildCandidates({ PATH: 'C:\\bin', ProgramFiles: '', USERPROFILE: '' });
    expect(candidates.map((c) => c.path)).toEqual(['pwsh.exe']);
  });

  it('never yields forbidden executables', () => {
    const forbidden = ['powershell.exe', 'cmd.exe', 'wt.exe', 'conhost.exe', 'bash.exe', 'wsl.exe'];
    for (const candidate of buildCandidates(env())) {
      const base = candidate.path.toLowerCase().split(/[\\/]/).pop() ?? '';
      expect(forbidden).not.toContain(base);
      expect(base).toBe('pwsh.exe');
    }
  });
});

describe('dedupeCandidates', () => {
  it('removes duplicate paths case-insensitively', () => {
    const out = dedupeCandidates([
      { path: 'C:\\Tools\\pwsh.exe', source: 'PATH' },
      { path: 'c:\\tools\\pwsh.exe', source: 'ProgramFiles' },
      { path: 'pwsh.exe', source: 'PATH' },
    ]);
    expect(out.map((c) => c.path)).toEqual(['C:\\Tools\\pwsh.exe', 'pwsh.exe']);
  });

  it('keeps the first occurrence of a duplicate', () => {
    const out = dedupeCandidates([
      { path: 'pwsh.exe', source: 'PATH' },
      { path: 'PWSH.EXE', source: 'ProgramFiles' },
    ]);
    expect(out).toEqual([{ path: 'pwsh.exe', source: 'PATH' }]);
  });
});
