import { describe, expect, it } from 'vitest';
import { FileSystemAdapter, TFile, TFolder } from './mocks/obsidian';
import { getFolderPath, getTargetPath, getVaultRootPath } from '../src/vault-path';

interface FakeVault {
  adapter: unknown;
}

describe('getVaultRootPath', () => {
  it('returns the base path for a real FileSystemAdapter', () => {
    const adapter = new FileSystemAdapter('E:\\My Vault');
    expect(getVaultRootPath({ adapter } as FakeVault as never)).toBe('E:\\My Vault');
  });

  it('returns null for a duck-typed adapter that is not a FileSystemAdapter', () => {
    const adapter = { getBasePath: () => 'E:\\Fake' };
    expect(getVaultRootPath({ adapter } as FakeVault as never)).toBeNull();
  });

  it('returns null for a plain object adapter', () => {
    expect(getVaultRootPath({ adapter: {} } as FakeVault as never)).toBeNull();
  });

  it('returns null when the vault has no adapter', () => {
    expect(getVaultRootPath({ adapter: undefined } as FakeVault as never)).toBeNull();
  });

  it('returns null when the vault is nullish', () => {
    expect(getVaultRootPath(null as never)).toBeNull();
    expect(getVaultRootPath(undefined as never)).toBeNull();
  });
});

describe('getFolderPath', () => {
  const VAULT = 'E:\\My Vault';

  it('returns the joined absolute path for a nested folder', () => {
    const adapter = new FileSystemAdapter(VAULT);
    expect(getFolderPath({ adapter } as never, new TFolder('Notes/Deep') as never)).toBe(
      'E:\\My Vault\\Notes\\Deep',
    );
  });

  it('handles folders with special characters', () => {
    const adapter = new FileSystemAdapter(VAULT);
    const folder = new TFolder("Notes/It's (x) & 中文/子目录") as never;
    expect(getFolderPath({ adapter } as never, folder)).toBe(
      "E:\\My Vault\\Notes\\It's (x) & 中文\\子目录",
    );
  });

  it('returns the base path for the vault root folder (empty path)', () => {
    const adapter = new FileSystemAdapter(VAULT);
    expect(getFolderPath({ adapter } as never, new TFolder('') as never)).toBe(VAULT);
    expect(getFolderPath({ adapter } as never, new TFolder('/') as never)).toBe(VAULT);
  });

  it('returns null for a duck-typed adapter that is not a FileSystemAdapter', () => {
    const adapter = { getFullPath: () => 'E:\\Fake' };
    expect(getFolderPath({ adapter } as never, new TFolder('Notes') as never)).toBeNull();
  });

  it('returns null when the vault has no adapter', () => {
    expect(getFolderPath({ adapter: undefined } as never, new TFolder('Notes') as never)).toBeNull();
  });

  it('returns null when the vault or folder is nullish', () => {
    const adapter = new FileSystemAdapter(VAULT);
    expect(getFolderPath(null as never, new TFolder('Notes') as never)).toBeNull();
    expect(getFolderPath({ adapter } as never, null as never)).toBeNull();
    expect(getFolderPath(undefined as never, undefined as never)).toBeNull();
  });
});

describe('getTargetPath', () => {
  const VAULT = 'E:\\My Vault';

  it('resolves the directory of a TFolder directly', () => {
    const adapter = new FileSystemAdapter(VAULT);
    const folder = new TFolder('Work/Projects');
    expect(getTargetPath({ adapter } as never, folder as never)).toBe(
      'E:\\My Vault\\Work\\Projects',
    );
  });

  it('resolves the parent folder path for a TFile with parent', () => {
    const adapter = new FileSystemAdapter(VAULT);
    const parent = new TFolder('Work/Projects');
    const file = new TFile('Work/Projects/todo.md', parent);
    expect(getTargetPath({ adapter } as never, file as never)).toBe(
      'E:\\My Vault\\Work\\Projects',
    );
  });

  it('resolves the parent folder path for a TFile without parent reference using path parsing', () => {
    const adapter = new FileSystemAdapter(VAULT);
    const file = new TFile('Notes/Personal/diary.md');
    expect(getTargetPath({ adapter } as never, file as never)).toBe(
      'E:\\My Vault\\Notes\\Personal',
    );
  });

  it('resolves the vault root for a root-level TFile', () => {
    const adapter = new FileSystemAdapter(VAULT);
    const file = new TFile('root-note.md');
    expect(getTargetPath({ adapter } as never, file as never)).toBe(VAULT);
  });

  it('returns null for nullish or invalid targets', () => {
    const adapter = new FileSystemAdapter(VAULT);
    expect(getTargetPath({ adapter } as never, null)).toBeNull();
    expect(getTargetPath({ adapter } as never, undefined)).toBeNull();
    expect(getTargetPath({ adapter } as never, {} as never)).toBeNull();
  });
});
