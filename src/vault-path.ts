import {
  FileSystemAdapter,
  TFile,
  TFolder,
  type TAbstractFile,
  type Vault,
} from 'obsidian';

/**
 * The vault's adapter when it is a local `FileSystemAdapter`, otherwise
 * `null`. The runtime `instanceof` check is mandatory: a type assertion
 * alone would let non-local adapters (e.g. remote vaults) through. We never
 * derive paths from note content and never write anything into the vault.
 */
function getLocalAdapter(vault: Vault | null | undefined): FileSystemAdapter | null {
  if (vault === null || vault === undefined) {
    return null;
  }
  const adapter = vault.adapter;
  return adapter instanceof FileSystemAdapter ? adapter : null;
}

/**
 * Resolve the vault root path through Obsidian's local file system adapter.
 *
 * Returns the vault root directory, or `null` when the adapter is not a
 * local file system adapter.
 */
export function getVaultRootPath(vault: Vault | null | undefined): string | null {
  const adapter = getLocalAdapter(vault);
  if (adapter === null) {
    return null;
  }
  return adapter.getBasePath();
}

/**
 * Resolve the absolute path of a folder. The path is resolved through
 * `FileSystemAdapter.getFullPath()` so it is never assembled by
 * string-concatenating the vault root.
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
  if (folder === null || folder === undefined || !(folder instanceof TFolder)) {
    return null;
  }
  const adapter = getLocalAdapter(vault);
  if (adapter === null) {
    return null;
  }
  const normalized = folder.path.replace(/^\/+|\/+$/g, '');
  if (normalized === '') {
    return adapter.getBasePath();
  }
  return adapter.getFullPath(normalized);
}

/**
 * Resolve the target directory for any abstract file (folder or file).
 * - For a `TFolder`: returns that folder's absolute path.
 * - For a `TFile`: returns the absolute path of the file's parent folder.
 * - For null or non-filesystem targets: returns `null`.
 */
export function getTargetPath(
  vault: Vault | null | undefined,
  target: TAbstractFile | null | undefined,
): string | null {
  if (target === null || target === undefined) {
    return null;
  }

  if (target instanceof TFolder) {
    return getFolderPath(vault, target);
  }

  if (target instanceof TFile) {
    if (target.parent instanceof TFolder) {
      return getFolderPath(vault, target.parent);
    }
    // Fallback if parent reference is not populated
    const adapter = getLocalAdapter(vault);
    if (adapter === null) {
      return null;
    }
    const lastSlash = target.path.lastIndexOf('/');
    if (lastSlash === -1) {
      return adapter.getBasePath();
    }
    const parentDir = target.path.substring(0, lastSlash).replace(/^\/+|\/+$/g, '');
    if (parentDir === '') {
      return adapter.getBasePath();
    }
    return adapter.getFullPath(parentDir);
  }

  return null;
}
