import type { SnippetCatalog, SnippetCatalogEntry } from '#/shared/snippet/catalog';
import type { InstalledSnippetPackage } from '#/shared/snippet/types';

/**
 * Outcome of resolving a harborclient:// snippet install deep link.
 */
export type PendingSnippetInstallDeepLinkResult =
  | { kind: 'cancelled' }
  | { kind: 'catalog-error'; message: string }
  | { kind: 'not-found' }
  | { kind: 'already-installed'; package: InstalledSnippetPackage }
  | { kind: 'declined' }
  | { kind: 'installed'; package: InstalledSnippetPackage }
  | { kind: 'install-error'; message: string };

/**
 * Resolves a queued snippet install deep link against the marketplace catalog.
 *
 * Confirmation and install side effects are delegated to callbacks so the caller
 * can keep Redux consume timing outside the async flow.
 *
 * @param snippetId - Marketplace bundle id from the deep link.
 * @param options - Catalog lookup, confirmation, and install callbacks.
 * @returns Structured result describing how the deep link was handled.
 */
export async function resolvePendingSnippetInstallDeepLink(
  snippetId: string,
  options: {
    getSnippetCatalog: () => Promise<SnippetCatalog>;
    listInstalledPackages: () => Promise<InstalledSnippetPackage[]>;
    confirmInstall: (entry: SnippetCatalogEntry) => Promise<boolean>;
    installFromGit: (entry: SnippetCatalogEntry) => Promise<InstalledSnippetPackage>;
    isCancelled: () => boolean;
  }
): Promise<PendingSnippetInstallDeepLinkResult> {
  const { getSnippetCatalog, listInstalledPackages, confirmInstall, installFromGit, isCancelled } =
    options;

  let loadedCatalog: SnippetCatalog;
  try {
    loadedCatalog = await getSnippetCatalog();
  } catch (err) {
    return {
      kind: 'catalog-error',
      message: err instanceof Error ? err.message : String(err)
    };
  }

  if (isCancelled()) {
    return { kind: 'cancelled' };
  }

  const entry = loadedCatalog.snippets.find((candidate) => candidate.id === snippetId);
  if (!entry) {
    return { kind: 'not-found' };
  }

  const installedPackages = await listInstalledPackages();
  if (isCancelled()) {
    return { kind: 'cancelled' };
  }

  const installed = installedPackages.find((pkg) => pkg.catalogId === entry.id);
  if (installed) {
    return { kind: 'already-installed', package: installed };
  }

  const confirmed = await confirmInstall(entry);
  if (!confirmed || isCancelled()) {
    return { kind: 'declined' };
  }

  try {
    const installedPackage = await installFromGit(entry);
    if (isCancelled()) {
      return { kind: 'cancelled' };
    }
    return { kind: 'installed', package: installedPackage };
  } catch (err) {
    return {
      kind: 'install-error',
      message: err instanceof Error ? err.message : String(err)
    };
  }
}
