import type { PluginInfo } from '#/shared/plugin/types';
import {
  createTextSearchIndex,
  searchTextIndex,
  type HarborSearchIndex
} from '#/shared/search/oramaIndex';

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

const INSTALLED_PLUGIN_SEARCH_SCHEMA = {
  id: 'string',
  name: 'string',
  summary: 'string',
  author: 'string',
  categoriesText: 'string'
} as const;

const INSTALLED_PLUGIN_SEARCH_PROPERTIES = ['name', 'summary', 'author', 'categoriesText'];

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
 * Builds an Orama index over installed plugin metadata.
 *
 * @param plugins - Installed plugin rows to index.
 * @returns Search index keyed by plugin id.
 */
export function buildInstalledPluginSearchIndex(plugins: PluginInfo[]): HarborSearchIndex {
  return createTextSearchIndex(
    INSTALLED_PLUGIN_SEARCH_SCHEMA,
    plugins.map(installedPluginSearchDocument)
  );
}

/**
 * Filters installed plugins by a user query using the prebuilt search index.
 *
 * @param plugins - Full installed listing in display order.
 * @param index - Orama index built from the same plugin rows.
 * @param query - Raw search text from the installed filter field.
 * @returns Matching plugins in relevance order, or the original list when the query is empty.
 */
export function searchInstalledPlugins(
  plugins: PluginInfo[],
  index: HarborSearchIndex,
  query: string
): PluginInfo[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return plugins;
  }

  const byId = new Map(plugins.map((plugin) => [plugin.id, plugin]));
  return searchTextIndex<InstalledPluginSearchDocument>(index, trimmed, {
    properties: INSTALLED_PLUGIN_SEARCH_PROPERTIES
  })
    .map((hit) => byId.get(hit.id))
    .filter((plugin): plugin is PluginInfo => plugin !== undefined);
}

/**
 * Returns installed plugin hits with scores for unified global search.
 *
 * @param index - Orama index built from installed plugin rows.
 * @param query - Raw search text.
 */
export function searchInstalledPluginHits(
  index: HarborSearchIndex,
  query: string
): Array<{ id: string; score: number; name: string; summary: string }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  return searchTextIndex<InstalledPluginSearchDocument>(index, trimmed, {
    properties: INSTALLED_PLUGIN_SEARCH_PROPERTIES
  }).map((hit) => ({
    id: hit.document.id,
    score: hit.score,
    name: hit.document.name,
    summary: hit.document.summary
  }));
}
