import { useContext, useMemo } from 'react';
import { searchAll } from '#/shared/search';
import { SearchIndexContext } from '#/renderer/src/search/searchIndexContext';
import type { SearchIndexContextValue } from '#/renderer/src/search/searchIndexContext';

/**
 * Returns warm search indexes and lookup data from {@link SearchIndexProvider}.
 *
 * @returns Context value with indexes, data, and readiness flags.
 * @throws When called outside {@link SearchIndexProvider}.
 */
export function useSearchIndexes(): SearchIndexContextValue {
  const context = useContext(SearchIndexContext);
  if (context == null) {
    throw new Error('useSearchIndexes must be used within SearchIndexProvider');
  }
  return context;
}

/**
 * Runs unified search against the warm indexes from {@link SearchIndexProvider}.
 *
 * @param query - Raw user search text.
 * @returns Normalized hits capped for the command palette.
 */
export function useUnifiedSearch(query: string): ReturnType<typeof searchAll> {
  const { searchContext } = useSearchIndexes();
  return useMemo(() => searchAll(query, searchContext), [query, searchContext]);
}
