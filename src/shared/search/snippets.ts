import {
  PLUGIN_CATALOG_CATEGORIES,
  PLUGIN_CATALOG_CATEGORY_LABELS
} from '#/shared/plugin/catalogCategories';
import type { SnippetCatalogEntry } from '#/shared/snippet/catalog';
import {
  createTextSearchIndex,
  searchTextIndex,
  type HarborSearchIndex
} from '#/shared/search/oramaIndex';

/**
 * Indexed fields for snippet marketplace catalog search.
 */
type SnippetCatalogSearchDocument = {
  id: string;
  name: string;
  summary: string;
  author: string;
  description: string;
  categoriesText: string;
};

const SNIPPET_CATALOG_SEARCH_SCHEMA = {
  id: 'string',
  name: 'string',
  summary: 'string',
  author: 'string',
  description: 'string',
  categoriesText: 'string'
} as const;

const SNIPPET_CATALOG_UI_PROPERTIES = ['name', 'summary', 'author', 'description'];
const SNIPPET_CATALOG_SEARCH_PROPERTIES = [
  'name',
  'summary',
  'author',
  'description',
  'categoriesText'
];

/**
 * Maps a snippet catalog row to searchable document fields for the UI catalog index.
 *
 * @param entry - Marketplace snippet bundle row.
 */
function snippetCatalogUiDocument(entry: SnippetCatalogEntry): SnippetCatalogSearchDocument {
  return {
    id: entry.id,
    name: entry.name,
    summary: entry.summary,
    author: entry.author,
    description: entry.description ?? '',
    categoriesText: entry.categories.join(' ')
  };
}

/**
 * Maps a snippet catalog row to searchable document fields for global search.
 *
 * @param entry - Marketplace snippet bundle row.
 */
function snippetCatalogSearchDocument(entry: SnippetCatalogEntry): SnippetCatalogSearchDocument {
  return snippetCatalogUiDocument(entry);
}

/**
 * Builds an Orama index for snippet marketplace catalog entries.
 *
 * @param entries - Catalog entries to index.
 * @returns Search index keyed by bundle id.
 */
export function buildSnippetCatalogSearchIndex(entries: SnippetCatalogEntry[]): HarborSearchIndex {
  return createTextSearchIndex(
    SNIPPET_CATALOG_SEARCH_SCHEMA,
    entries.map(snippetCatalogUiDocument)
  );
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
  index: HarborSearchIndex,
  entries: SnippetCatalogEntry[],
  query: string
): SnippetCatalogEntry[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return entries;
  }

  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return searchTextIndex<SnippetCatalogSearchDocument>(index, trimmed, {
    properties: SNIPPET_CATALOG_UI_PROPERTIES
  })
    .map((hit) => byId.get(hit.id))
    .filter((entry): entry is SnippetCatalogEntry => entry !== undefined);
}

/**
 * Builds an Orama index over marketplace snippet bundle metadata.
 *
 * @param entries - Catalog rows to index.
 * @returns Search index keyed by bundle id.
 */
export function buildSnippetCatalogSearchIndexForSearch(
  entries: SnippetCatalogEntry[]
): HarborSearchIndex {
  return createTextSearchIndex(
    SNIPPET_CATALOG_SEARCH_SCHEMA,
    entries.map(snippetCatalogSearchDocument)
  );
}

/**
 * Returns snippet marketplace hits with scores for unified global search.
 *
 * @param index - Orama index built from marketplace catalog rows.
 * @param query - Raw search text.
 */
export function searchSnippetHits(
  index: HarborSearchIndex,
  query: string
): Array<{ id: string; score: number; name: string; summary: string }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  return searchTextIndex<SnippetCatalogSearchDocument>(index, trimmed, {
    properties: SNIPPET_CATALOG_SEARCH_PROPERTIES
  }).map((hit) => ({
    id: hit.document.id,
    score: hit.score,
    name: hit.document.name,
    summary: hit.document.summary
  }));
}

export { PLUGIN_CATALOG_CATEGORIES, PLUGIN_CATALOG_CATEGORY_LABELS };
