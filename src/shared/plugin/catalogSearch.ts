import MiniSearch from 'minisearch';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';

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

/**
 * Builds a MiniSearch index over marketplace plugin metadata.
 *
 * @param plugins - Catalog rows to index.
 * @returns Search index keyed by plugin id.
 */
export function buildPluginCatalogSearchIndex(
  plugins: PluginCatalogEntry[]
): MiniSearch<PluginCatalogSearchDocument> {
  const index = new MiniSearch<PluginCatalogSearchDocument>({
    fields: ['name', 'summary', 'author', 'categoriesText'],
    storeFields: ['id'],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2
    }
  });

  index.addAll(
    plugins.map((entry) => ({
      id: entry.id,
      name: entry.name,
      summary: entry.summary,
      author: entry.author,
      categoriesText: entry.categories.join(' ')
    }))
  );

  return index;
}

/**
 * Filters catalog plugins by a user query using the prebuilt search index.
 *
 * @param plugins - Full catalog listing in display order.
 * @param index - MiniSearch index built from the same plugin rows.
 * @param query - Raw search text from the marketplace filter field.
 * @returns Matching plugins in relevance order, or the original list when the query is empty.
 */
export function searchPluginCatalog(
  plugins: PluginCatalogEntry[],
  index: MiniSearch<PluginCatalogSearchDocument>,
  query: string
): PluginCatalogEntry[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return plugins;
  }

  const byId = new Map(plugins.map((entry) => [entry.id, entry]));
  return index
    .search(trimmed)
    .map((hit) => byId.get(String(hit.id)))
    .filter((entry): entry is PluginCatalogEntry => entry !== undefined);
}
