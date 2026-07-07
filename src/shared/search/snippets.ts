import {
  PLUGIN_CATALOG_CATEGORIES,
  PLUGIN_CATALOG_CATEGORY_LABELS
} from '#/shared/plugin/catalogCategories';
import type { SnippetCatalogEntry } from '#/shared/snippet/catalog';
import { DEFAULT_SEARCH_OPTIONS } from '#/shared/search/types';
import MiniSearch from 'minisearch';

/**
 * Builds a MiniSearch index for snippet marketplace catalog entries.
 *
 * @param entries - Catalog entries to index.
 * @returns Search index keyed by bundle id.
 */
export function buildSnippetCatalogSearchIndex(
  entries: SnippetCatalogEntry[]
): MiniSearch<SnippetCatalogEntry> {
  const index = new MiniSearch<SnippetCatalogEntry>({
    idField: 'id',
    fields: ['name', 'summary', 'author', 'description'],
    storeFields: ['id', 'name', 'summary', 'author'],
    searchOptions: DEFAULT_SEARCH_OPTIONS
  });
  index.addAll(entries);
  return index;
}

/**
 * Filters catalog entries by category slug.
 *
 * @param entries - Catalog entries to filter.
 * @param category - Category slug, or empty for all entries.
 * @returns Entries matching the category filter.
 */
export function filterSnippetCatalogByCategory(
  entries: SnippetCatalogEntry[],
  category: string
): SnippetCatalogEntry[] {
  if (!category) {
    return entries;
  }
  return entries.filter((entry) => entry.categories.includes(category as never));
}

/**
 * Searches snippet catalog entries by query text.
 *
 * @param index - Warm catalog search index.
 * @param entries - Full catalog entry list for result lookup.
 * @param query - Raw user search text.
 * @returns Matching catalog entries in relevance order.
 */
export function searchSnippetCatalog(
  index: MiniSearch<SnippetCatalogEntry>,
  entries: SnippetCatalogEntry[],
  query: string
): SnippetCatalogEntry[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return entries;
  }

  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return index
    .search(trimmed)
    .map((result) => byId.get(String(result.id)))
    .filter((entry): entry is SnippetCatalogEntry => entry !== undefined);
}

/**
 * Indexed fields for snippet marketplace catalog search.
 */
type SnippetCatalogSearchDocument = {
  id: string;
  name: string;
  summary: string;
  author: string;
  categoriesText: string;
};

/**
 * Builds a MiniSearch index over marketplace snippet bundle metadata.
 *
 * @param entries - Catalog rows to index.
 * @returns Search index keyed by bundle id.
 */
export function buildSnippetCatalogSearchIndexForSearch(
  entries: SnippetCatalogEntry[]
): MiniSearch<SnippetCatalogSearchDocument> {
  const index = new MiniSearch<SnippetCatalogSearchDocument>({
    fields: ['name', 'summary', 'author', 'categoriesText'],
    storeFields: ['id', 'name', 'summary'],
    searchOptions: DEFAULT_SEARCH_OPTIONS
  });

  index.addAll(
    entries.map((entry) => ({
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
 * Returns snippet marketplace hits with scores for unified global search.
 *
 * @param index - MiniSearch index built from marketplace catalog rows.
 * @param query - Raw search text.
 */
export function searchSnippetHits(
  index: MiniSearch<SnippetCatalogSearchDocument>,
  query: string
): Array<{ id: string; score: number; name: string; summary: string }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  return index.search(trimmed).map((result) => {
    const stored = result as unknown as SnippetCatalogSearchDocument;
    return {
      id: String(stored.id),
      score: result.score,
      name: stored.name,
      summary: stored.summary
    };
  });
}

export { PLUGIN_CATALOG_CATEGORIES, PLUGIN_CATALOG_CATEGORY_LABELS };
