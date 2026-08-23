import { describe, expect, it } from 'vitest';
import { buildCandidates, dedupeCandidates, PATH_CANDIDATE } from '../src/terminals/windows/candidates';

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
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
    expect(candidates.map((c) => c.source)).toEqual([
      'PATH',
      'ProgramFiles',
      'UserProfileDotnetTools',
    ]);
  });

  it('omits Program Files candidate when env var is missing or empty', () => {
    const withoutPf = buildCandidates(env({ ProgramFiles: undefined }));
    expect(withoutPf.map((c) => c.source)).toEqual(['PATH', 'UserProfileDotnetTools']);

    const emptyPf = buildCandidates(env({ ProgramFiles: '' }));
    expect(emptyPf.map((c) => c.source)).toEqual(['PATH', 'UserProfileDotnetTools']);
  });

  it('omits dotnet tools candidate when USERPROFILE is missing or empty', () => {
    const withoutUp = buildCandidates(env({ USERPROFILE: undefined }));
    expect(withoutUp.map((c) => c.source)).toEqual(['PATH', 'ProgramFiles']);

    const emptyUp = buildCandidates(env({ USERPROFILE: '' }));
    expect(emptyUp.map((c) => c.source)).toEqual(['PATH', 'ProgramFiles']);
  });

  it('returns only the PATH candidate when no relevant env vars are present', () => {
    const candidates = buildCandidates({});
    expect(candidates).toEqual([{ path: PATH_CANDIDATE, source: 'PATH' }]);
  });
});

describe('dedupeCandidates', () => {
  it('preserves the first occurrence and removes case-insensitive duplicates', () => {
    const input = [
      { path: 'pwsh.exe', source: 'PATH' as const },
      { path: 'PWSH.EXE', source: 'ProgramFiles' as const },
      { path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', source: 'ProgramFiles' as const },
      {
        path: 'c:\\program files\\powershell\\7\\pwsh.exe',
        source: 'UserProfileDotnetTools' as const,
      },
    ];
    const output = dedupeCandidates(input);
    expect(output).toEqual([
      { path: 'pwsh.exe', source: 'PATH' },
      { path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', source: 'ProgramFiles' },
    ]);
  });
});
