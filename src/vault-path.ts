import { FileSystemAdapter, type Vault } from 'obsidian';

/**
 * Resolve the vault root path through Obsidian's local file system adapter.
 *
 * A runtime `instanceof FileSystemAdapter` check is mandatory: a type
 * assertion alone would let non-local adapters (e.g. remote vaults) through.
 * We never derive the root from note paths, never read note content and
 * never write anything into the vault.
 *
 * Returns the vault root directory, or `null` when the adapter is not a
 * local file system adapter.
 */
export function getVaultRootPath(vault: Vault | null | undefined): string | null {
  if (vault === null || vault === undefined) {
    return null;
  }
  const adapter = vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) {
    return null;
  }
  return adapter.getBasePath();
}
