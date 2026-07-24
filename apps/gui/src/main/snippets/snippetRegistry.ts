import Store from 'electron-store';
import type { GitSnippetOrigin, InstalledSnippetPackage } from '#/shared/snippet/types';

const GIT_KEY = 'snippets.git';
const PACKAGES_KEY = 'snippets.packages';

interface SnippetStoreShape {
  [GIT_KEY]: Record<string, GitSnippetOrigin>;
  [PACKAGES_KEY]: Record<string, InstalledSnippetPackage>;
}

let store: Store<SnippetStoreShape> | null = null;

/**
 * Returns the lazy electron-store instance for snippet marketplace metadata.
 */
function getStore(): Store<SnippetStoreShape> {
  if (!store) {
    store = new Store<SnippetStoreShape>({
      name: 'settings',
      defaults: {
        [GIT_KEY]: {},
        [PACKAGES_KEY]: {}
      }
    });
  }
  return store;
}

/**
 * Returns persisted git snippet bundle origins keyed by catalog id.
 */
export function getGitSnippetOrigins(): Record<string, GitSnippetOrigin> {
  return { ...getStore().get(GIT_KEY, {}) };
}

/**
 * Persists the git origin for one installed snippet bundle.
 *
 * @param catalogId - Snippet bundle id from snippets.json.
 * @param origin - Public repository URL and optional ref.
 */
export function setGitSnippetOrigin(catalogId: string, origin: GitSnippetOrigin): void {
  const current = getGitSnippetOrigins();
  current[catalogId] = origin;
  getStore().set(GIT_KEY, current);
}

/**
 * Removes git origin metadata for one snippet bundle.
 *
 * @param catalogId - Snippet bundle id from snippets.json.
 */
export function removeGitSnippetOrigin(catalogId: string): void {
  const current = getGitSnippetOrigins();
  delete current[catalogId];
  getStore().set(GIT_KEY, current);
}

/**
 * Returns persisted installed snippet bundle summaries keyed by catalog id.
 */
export function getInstalledSnippetPackages(): Record<string, InstalledSnippetPackage> {
  return { ...getStore().get(PACKAGES_KEY, {}) };
}

/**
 * Persists summary metadata for one installed snippet bundle.
 *
 * @param catalogId - Snippet bundle id from snippets.json.
 * @param summary - Installed bundle summary for UI display.
 */
export function setInstalledSnippetPackage(
  catalogId: string,
  summary: InstalledSnippetPackage
): void {
  const current = getInstalledSnippetPackages();
  current[catalogId] = summary;
  getStore().set(PACKAGES_KEY, current);
}

/**
 * Removes installed bundle summary metadata.
 *
 * @param catalogId - Snippet bundle id from snippets.json.
 */
export function removeInstalledSnippetPackage(catalogId: string): void {
  const current = getInstalledSnippetPackages();
  delete current[catalogId];
  getStore().set(PACKAGES_KEY, current);
}

/**
 * Resets snippet git origins and installed package metadata (for unit tests).
 */
export function clearSnippetRegistryForTesting(): void {
  getStore().set(GIT_KEY, {});
  getStore().set(PACKAGES_KEY, {});
}
