import { FileSystemAdapter, type TFolder, type Vault } from 'obsidian';

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

/**
 * Resolve the absolute Windows path of a folder (used by the single-folder
 * file-menu entry). Same runtime `instanceof FileSystemAdapter` guard as
 * `getVaultRootPath`; the path is resolved through
 * `FileSystemAdapter.getFullPath()` so the folder path is never assembled
 * by string-concatenating the vault root.
 *
 * The vault root folder (Obsidian path `''`) is handled explicitly via
 * `getBasePath()`.
 *
 * Returns the folder's absolute path, or `null` when the vault/folder is
 * missing or the adapter is not a local file system adapter.
 */
export function getFolderPath(
  vault: Vault | null | undefined,
  folder: TFolder | null | undefined,
): string | null {
  if (vault === null || vault === undefined || folder === null || folder === undefined) {
    return null;
  }
  const adapter = vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) {
    return null;
  }
  // Obsidian folder paths use forward slashes and no trailing slash; trim
  // defensively so the vault root folder (path '') is detected reliably.
  const normalized = folder.path.replace(/^\/+|\/+$/g, '');
  if (normalized === '') {
    return adapter.getBasePath();
  }
  return adapter.getFullPath(normalized);
}
