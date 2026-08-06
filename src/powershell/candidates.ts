import { join } from 'node:path';

/** The PATH-resolved candidate: Windows resolves this via the current PATH. */
export const PATH_CANDIDATE = 'pwsh.exe';

const PROGRAM_FILES_RELATIVE = ['PowerShell', '7', 'pwsh.exe'];
const DOTNET_TOOLS_RELATIVE = ['.dotnet', 'tools', 'pwsh.exe'];

/** A single candidate with its origin, for readable diagnostics. */
export interface Candidate {
  readonly path: string;
  readonly source: 'PATH' | 'ProgramFiles' | 'UserProfileDotnetTools';
}

/**
 * Build the ordered candidate list:
 *   1. `pwsh.exe` — resolved by Windows against the PATH inherited by Obsidian.
 *   2. `%ProgramFiles%\PowerShell\7\pwsh.exe`
 *   3. `%USERPROFILE%\.dotnet\tools\pwsh.exe`
 *
 * Missing environment variables are skipped; the list is deduplicated
 * case-insensitively (Windows paths are case-insensitive).
 * The PATH candidate always keeps priority over fixed install locations.
 */
export function buildCandidates(env: NodeJS.ProcessEnv = process.env): Candidate[] {
  const raw: Candidate[] = [{ path: PATH_CANDIDATE, source: 'PATH' }];

  const programFiles = env.ProgramFiles;
  if (programFiles !== undefined && programFiles !== '') {
    raw.push({ path: join(programFiles, ...PROGRAM_FILES_RELATIVE), source: 'ProgramFiles' });
  }

  const userProfile = env.USERPROFILE;
  if (userProfile !== undefined && userProfile !== '') {
    raw.push({
      path: join(userProfile, ...DOTNET_TOOLS_RELATIVE),
      source: 'UserProfileDotnetTools',
    });
  }

  return dedupeCandidates(raw);
}

/** Remove duplicate candidates, treating paths case-insensitively. */
export function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const candidate of candidates) {
    const key = candidate.path.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(candidate);
  }
  return out;
}
