import { describe, expect, it } from 'vitest';
import { FileSystemAdapter, TFolder } from '../tests/mocks/obsidian';
import { getFolderPath, getVaultRootPath } from '../src/vault-path';

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
    // A defensively trimmed slash-only path is also the vault root.
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
