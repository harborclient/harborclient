import type { PluginCatalog, PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';

/**
 * Outcome of resolving a harborclient:// plugin install deep link.
 */
export type PendingPluginInstallDeepLinkResult =
  | { kind: 'cancelled' }
  | { kind: 'catalog-error'; message: string }
  | { kind: 'not-found' }
  | { kind: 'already-installed'; plugin: PluginInfo }
  | { kind: 'declined' }
  | { kind: 'installed'; plugin: PluginInfo }
  | { kind: 'install-error'; message: string };

/**
 * Resolves a queued plugin install deep link against the marketplace catalog.
 *
 * Confirmation and install side effects are delegated to callbacks so the caller
 * can keep Redux consume timing outside the async flow.
 *
 * @param pluginId - Marketplace manifest id from the deep link.
 * @param options - Catalog lookup, confirmation, and install callbacks.
 * @returns Structured result describing how the deep link was handled.
 */
export async function resolvePendingPluginInstallDeepLink(
  pluginId: string,
  options: {
    getPluginCatalog: () => Promise<PluginCatalog>;
    listPlugins: () => Promise<PluginInfo[]>;
    confirmInstall: (entry: PluginCatalogEntry) => Promise<boolean>;
    installFromGit: (entry: PluginCatalogEntry) => Promise<PluginInfo>;
    isCancelled: () => boolean;
  }
): Promise<PendingPluginInstallDeepLinkResult> {
  const { getPluginCatalog, listPlugins, confirmInstall, installFromGit, isCancelled } = options;

  let loadedCatalog: PluginCatalog;
  try {
    loadedCatalog = await getPluginCatalog();
  } catch (err) {
    return {
      kind: 'catalog-error',
      message: err instanceof Error ? err.message : String(err)
    };
  }

  if (isCancelled()) {
    return { kind: 'cancelled' };
  }

  const entry = loadedCatalog.plugins.find((candidate) => candidate.id === pluginId);
  if (!entry) {
    return { kind: 'not-found' };
  }

  const installedPlugins = await listPlugins();
  if (isCancelled()) {
    return { kind: 'cancelled' };
  }

  const installed = findInstalledCatalogPlugin(installedPlugins, entry.id);
  if (installed) {
    return { kind: 'already-installed', plugin: installed };
  }

  const confirmed = await confirmInstall(entry);
  if (!confirmed || isCancelled()) {
    return { kind: 'declined' };
  }

  try {
    const plugin = await installFromGit(entry);
    if (isCancelled()) {
      return { kind: 'cancelled' };
    }
    return { kind: 'installed', plugin };
  } catch (err) {
    return {
      kind: 'install-error',
      message: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Returns whether a plugin is installed under userData (file or git), not dev-unpacked.
 *
 * @param plugin - Plugin metadata row.
 */
export function isManagedInstall(plugin: PluginInfo): boolean {
  return plugin.source === 'installed' || plugin.source === 'git';
}

/**
 * Returns the installed plugin row matching a catalog entry id, if any.
 *
 * @param plugins - Installed plugin rows from the main process.
 * @param entryId - Catalog manifest id.
 */
export function findInstalledCatalogPlugin(
  plugins: PluginInfo[],
  entryId: string
): PluginInfo | undefined {
  return plugins.find((plugin) => plugin.id === entryId);
}

/**
 * Resolves the one-line summary shown under an installed plugin name in the table.
 *
 * Prefers the local manifest so the Installed tab does not depend on catalog fetch.
 *
 * @param plugin - Installed plugin row.
 * @param catalogEntry - Matching marketplace listing when the catalog is loaded.
 */
export function resolveInstalledPluginSummary(
  plugin: PluginInfo,
  catalogEntry?: PluginCatalogEntry
): string | undefined {
  return plugin.manifest.summary ?? catalogEntry?.summary;
}

/**
 * Stops row-level click handlers from firing when interacting with row action buttons.
 *
 * @param event - DOM event from an action control inside a table row.
 */
export function stopRowActivation(event: { stopPropagation(): void }): void {
  event.stopPropagation();
}

/**
 * Validates a plugin source URL before it is added to the draft settings.
 *
 * @param url - Raw URL from the add-endpoint input.
 * @returns Trimmed URL when valid.
 */
export function parseDraftPluginSourceUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('URL is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Enter a valid http:// or https:// URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Enter a valid http:// or https:// URL.');
  }

  return trimmed;
}
