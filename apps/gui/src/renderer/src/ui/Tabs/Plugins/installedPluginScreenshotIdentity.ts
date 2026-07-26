import type { PluginCatalogEntry } from '@harborclient/core/plugin/catalog';
import type { PluginInfo } from '@harborclient/core/plugin/types';

/**
 * Builds a stable identity string for installed-plugin screenshot sources.
 *
 * Toggle/reload refreshes produce new `plugin` object references even when the
 * preview assets are unchanged. Cards key screenshot loading on this string so
 * previews are not cleared and re-fetched for enablement-only updates.
 *
 * @param plugin - Installed plugin row.
 * @param catalogEntry - Optional marketplace catalog entry for screenshot URLs.
 * @returns Stable key derived from screenshot-relevant fields only.
 */
export function installedPluginScreenshotIdentity(
  plugin: PluginInfo,
  catalogEntry?: PluginCatalogEntry
): string {
  const manifestScreenshots = plugin.manifest.screenshots ?? [];
  const manifestPaths = manifestScreenshots.map((entry) =>
    typeof entry === 'string' ? entry : entry.path
  );

  return JSON.stringify({
    id: plugin.id,
    version: plugin.version,
    repoUrl: plugin.repoUrl ?? null,
    repoRef: plugin.repoRef ?? null,
    manifestScreenshots: manifestPaths,
    catalogScreenshots: catalogEntry?.screenshots ?? null,
    catalogScreenshot: catalogEntry?.screenshot ?? null
  });
}
