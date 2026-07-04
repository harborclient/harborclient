import MiniSearch from 'minisearch';
import type { PluginInfo } from '#/shared/plugin/types';
import { DEFAULT_SEARCH_OPTIONS } from '#/shared/search/types';

/**
 * Indexed fields for installed plugin search.
 */
type InstalledPluginSearchDocument = {
  id: string;
  name: string;
  summary: string;
  author: string;
  categoriesText: string;
};

/**
 * Maps an installed plugin row to searchable document fields.
 *
 * @param plugin - Installed plugin metadata from the main process.
 */
function installedPluginSearchDocument(plugin: PluginInfo): InstalledPluginSearchDocument {
  return {
    id: plugin.id,
    name: plugin.name,
    summary: plugin.manifest.summary ?? '',
    author: plugin.manifest.author ?? '',
    categoriesText: (plugin.manifest.categories ?? []).join(' ')
  };
}

/**
 * Builds a MiniSearch index over installed plugin metadata.
 *
 * @param plugins - Installed plugin rows to index.
 * @returns Search index keyed by plugin id.
 */
export function buildInstalledPluginSearchIndex(
  plugins: PluginInfo[]
): MiniSearch<InstalledPluginSearchDocument> {
  const index = new MiniSearch<InstalledPluginSearchDocument>({
    fields: ['name', 'summary', 'author', 'categoriesText'],
    storeFields: ['id', 'name', 'summary'],
    searchOptions: DEFAULT_SEARCH_OPTIONS
  });

  index.addAll(plugins.map(installedPluginSearchDocument));

  return index;
}

/**
 * Filters installed plugins by a user query using the prebuilt search index.
 *
 * @param plugins - Full installed listing in display order.
 * @param index - MiniSearch index built from the same plugin rows.
 * @param query - Raw search text from the installed filter field.
 * @returns Matching plugins in relevance order, or the original list when the query is empty.
 */
export function searchInstalledPlugins(
  plugins: PluginInfo[],
  index: MiniSearch<InstalledPluginSearchDocument>,
  query: string
): PluginInfo[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return plugins;
  }

  const byId = new Map(plugins.map((plugin) => [plugin.id, plugin]));
  return index
    .search(trimmed)
    .map((hit) => byId.get(String(hit.id)))
    .filter((plugin): plugin is PluginInfo => plugin !== undefined);
}

/**
 * Returns installed plugin hits with scores for unified global search.
 *
 * @param index - MiniSearch index built from installed plugin rows.
 * @param query - Raw search text.
 */
export function searchInstalledPluginHits(
  index: MiniSearch<InstalledPluginSearchDocument>,
  query: string
): Array<{ id: string; score: number; name: string; summary: string }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  return index.search(trimmed).map((result) => {
    const stored = result as unknown as InstalledPluginSearchDocument;
    return {
      id: String(stored.id),
      score: result.score,
      name: stored.name,
      summary: stored.summary
    };
  });
}
