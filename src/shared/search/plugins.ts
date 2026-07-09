import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginCatalogCategory } from '#/shared/plugin/catalogCategories';
import {
  createTextSearchIndex,
  searchTextIndex,
  type HarborSearchIndex
} from '#/shared/search/oramaIndex';

/**
 * Indexed fields for marketplace catalog search.
 */
type PluginCatalogSearchDocument = {
  id: string;
  name: string;
  summary: string;
  author: string;
  categoriesText: string;
};

const PLUGIN_SEARCH_SCHEMA = {
  id: 'string',
  name: 'string',
  summary: 'string',
  author: 'string',
  categoriesText: 'string'
} as const;

const PLUGIN_SEARCH_PROPERTIES = ['name', 'summary', 'author', 'categoriesText'];

/**
 * Builds an Orama index over marketplace plugin metadata.
 *
 * @param plugins - Catalog rows to index.
 * @returns Search index keyed by plugin id.
 */
export function buildPluginCatalogSearchIndex(plugins: PluginCatalogEntry[]): HarborSearchIndex {
  const documents: PluginCatalogSearchDocument[] = plugins.map((entry) => ({
    id: entry.id,
    name: entry.name,
    summary: entry.summary,
    author: entry.author,
    categoriesText: entry.categories.join(' ')
  }));

  return createTextSearchIndex(PLUGIN_SEARCH_SCHEMA, documents);
}

/**
 * Filters catalog plugins to those tagged with one predefined category slug.
 *
 * @param plugins - Full catalog listing in display order.
 * @param category - Selected category slug, or empty string to return all plugins.
 * @returns Plugins whose categories include the selected slug, or the original list when unset.
 */
export function filterPluginCatalogByCategory(
  plugins: PluginCatalogEntry[],
  category: PluginCatalogCategory | ''
): PluginCatalogEntry[] {
  if (!category) {
    return plugins;
  }

  return plugins.filter((entry) => entry.categories.includes(category));
}

/**
 * Filters catalog plugins by a user query using the prebuilt search index.
 *
 * @param plugins - Full catalog listing in display order.
 * @param index - Orama index built from the same plugin rows.
 * @param query - Raw search text from the marketplace filter field.
 * @returns Matching plugins in relevance order, or the original list when the query is empty.
 */
export function searchPluginCatalog(
  plugins: PluginCatalogEntry[],
  index: HarborSearchIndex,
  query: string
): PluginCatalogEntry[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return plugins;
  }

  const byId = new Map(plugins.map((entry) => [entry.id, entry]));
  return searchTextIndex<PluginCatalogSearchDocument>(index, trimmed, {
    properties: PLUGIN_SEARCH_PROPERTIES
  })
    .map((hit) => byId.get(hit.id))
    .filter((entry): entry is PluginCatalogEntry => entry !== undefined);
}

/**
 * Returns plugin hits with scores for unified global search.
 *
 * @param index - Orama index built from marketplace catalog rows.
 * @param query - Raw search text.
 */
export function searchPluginHits(
  index: HarborSearchIndex,
  query: string
): Array<{ id: string; score: number; name: string; summary: string }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  return searchTextIndex<PluginCatalogSearchDocument>(index, trimmed, {
    properties: PLUGIN_SEARCH_PROPERTIES
  }).map((hit) => ({
    id: hit.document.id,
    score: hit.score,
    name: hit.document.name,
    summary: hit.document.summary
  }));
}
