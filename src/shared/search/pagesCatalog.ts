/**
 * Stable identifiers for top-level page tabs surfaced in Search Anything.
 */
export type PageId = 'snippets';

/**
 * Catalog entry for a top-level configuration page tab.
 */
export interface PageCatalogEntry {
  /** Stable page identifier used for navigation. */
  id: PageId;
  /** Tab title shown in the tab bar and search results. */
  label: string;
  /** Summary text indexed for search and shown as a subtitle. */
  description: string;
  /** Optional search synonyms beyond label and description text. */
  keywords: string[];
}

/**
 * Top-level page tabs indexed by Search Anything.
 */
export const PAGES_CATALOG: PageCatalogEntry[] = [
  {
    id: 'snippets',
    label: 'Snippets',
    description: 'Manage reusable JavaScript snippets for pre-request and post-request scripts.',
    keywords: ['scripts', 'library', 'javascript']
  }
];

/**
 * Returns page tab hits whose label, description, or keywords match the query.
 *
 * @param query - Raw user search text.
 * @returns Matching page entries with a fixed relevance score for ordering.
 */
export function searchPageHits(
  query: string
): Array<{ id: PageId; score: number; label: string; description: string }> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }

  const results: Array<{ id: PageId; score: number; label: string; description: string }> = [];
  for (const entry of PAGES_CATALOG) {
    const haystack = [entry.label, entry.description, ...entry.keywords].join(' ').toLowerCase();
    if (haystack.includes(trimmed)) {
      results.push({
        id: entry.id,
        score: 1,
        label: entry.label,
        description: entry.description
      });
    }
  }
  return results;
}
