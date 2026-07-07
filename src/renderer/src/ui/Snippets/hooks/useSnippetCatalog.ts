import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { SnippetCatalog, SnippetCatalogEntry } from '#/shared/snippet/catalog';
import type { PluginCatalogCategory } from '#/shared/plugin/catalogCategories';
import {
  buildSnippetCatalogSearchIndex,
  filterSnippetCatalogByCategory,
  searchSnippetCatalog
} from '#/shared/search/snippets';

interface UseSnippetCatalogResult {
  catalog: SnippetCatalog | null;
  setCatalog: Dispatch<SetStateAction<SnippetCatalog | null>>;
  catalogLoading: boolean;
  setCatalogLoading: Dispatch<SetStateAction<boolean>>;
  catalogError: string | null;
  setCatalogError: Dispatch<SetStateAction<string | null>>;
  catalogById: Map<string, SnippetCatalogEntry>;
  catalogSearchQuery: string;
  setCatalogSearchQuery: (query: string) => void;
  catalogCategoryFilter: PluginCatalogCategory | '';
  setCatalogCategoryFilter: (category: PluginCatalogCategory | '') => void;
  filteredCatalogSnippets: SnippetCatalogEntry[];
  loadCatalog: () => Promise<void>;
  resetCatalogFilters: () => void;
}

/**
 * Manages snippet marketplace catalog loading, search, and category filtering.
 */
export function useSnippetCatalog(): UseSnippetCatalogResult {
  const [catalog, setCatalog] = useState<SnippetCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<PluginCatalogCategory | ''>(
    ''
  );

  /**
   * Loads the marketplace catalog from configured sources.
   */
  const loadCatalog = useCallback(async (): Promise<void> => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const next = await window.api.getSnippetCatalog();
      setCatalog(next);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : String(err));
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  /**
   * Clears marketplace search and filter state when leaving the section.
   */
  const resetCatalogFilters = useCallback((): void => {
    setCatalogSearchQuery('');
    setCatalogCategoryFilter('');
  }, []);

  const catalogById = useMemo(
    () => new Map((catalog?.snippets ?? []).map((entry) => [entry.id, entry])),
    [catalog]
  );

  const filteredCatalogSnippets = useMemo(() => {
    const entries = catalog?.snippets ?? [];
    const byCategory = filterSnippetCatalogByCategory(entries, catalogCategoryFilter);
    if (!catalogSearchQuery.trim()) {
      return byCategory;
    }
    const index = buildSnippetCatalogSearchIndex(byCategory);
    return searchSnippetCatalog(index, byCategory, catalogSearchQuery);
  }, [catalog, catalogCategoryFilter, catalogSearchQuery]);

  return {
    catalog,
    setCatalog,
    catalogLoading,
    setCatalogLoading,
    catalogError,
    setCatalogError,
    catalogById,
    catalogSearchQuery,
    setCatalogSearchQuery,
    catalogCategoryFilter,
    setCatalogCategoryFilter,
    filteredCatalogSnippets,
    loadCatalog,
    resetCatalogFilters
  };
}
