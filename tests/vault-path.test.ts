import { describe, expect, it } from 'vitest';
import { FileSystemAdapter } from '../tests/mocks/obsidian';
import { getVaultRootPath } from '../src/vault-path';

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
