import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { PluginCatalog, PluginCatalogEntry } from '#/shared/plugin/catalog';
import {
  buildPluginCatalogSearchIndex,
  filterPluginCatalogByCategory,
  searchPluginCatalog
} from '#/shared/search/plugins';
import type { PluginCatalogCategory } from '#/shared/plugin/catalogCategories';
import { catalogEntryIsTheme } from '#/shared/plugin/themeCategory';
import type { PluginManagementKind } from '#/renderer/src/ui/Plugins/constants';
import { useSearchIndexes } from '#/renderer/src/search/useSearchIndexes';

interface UsePluginCatalogResult {
  /**
   * Loaded marketplace catalog, if available.
   */
  catalog: PluginCatalog | null;

  /**
   * Replaces the loaded catalog (used by deep links and source saves).
   */
  setCatalog: Dispatch<SetStateAction<PluginCatalog | null>>;

  /**
   * Whether the catalog is loading.
   */
  catalogLoading: boolean;

  /**
   * Sets catalog loading state (used by deep links).
   */
  setCatalogLoading: Dispatch<SetStateAction<boolean>>;

  /**
   * Catalog load error message, if any.
   */
  catalogError: string | null;

  /**
   * Sets catalog error state (used by deep links and detail open).
   */
  setCatalogError: Dispatch<SetStateAction<string | null>>;

  /**
   * Marketplace catalog entries keyed by plugin id.
   */
  catalogById: Map<string, PluginCatalogEntry>;

  /**
   * Current search query for filtering catalog entries.
   */
  catalogSearchQuery: string;

  /**
   * Updates the catalog search query.
   */
  setCatalogSearchQuery: Dispatch<SetStateAction<string>>;

  /**
   * Current category filter, or empty for all categories.
   */
  catalogCategoryFilter: PluginCatalogCategory | '';

  /**
   * Updates the catalog category filter.
   */
  setCatalogCategoryFilter: Dispatch<SetStateAction<PluginCatalogCategory | ''>>;

  /**
   * Catalog entries after category and search filtering.
   */
  filteredCatalogPlugins: PluginCatalogEntry[];

  /**
   * Loads the marketplace catalog from configured sources.
   */
  loadCatalog: () => Promise<void>;

  /**
   * Clears marketplace search/filter state when leaving the Marketplace section.
   */
  resetCatalogFilters: () => void;
}

/**
 * Manages marketplace catalog loading, search, and category filtering.
 *
 * @param kind - When "themes", only theme catalog entries are shown; otherwise themes are excluded.
 */
export function usePluginCatalog(kind: PluginManagementKind = 'plugins'): UsePluginCatalogResult {
  const { pluginsIndex: warmPluginsIndex, plugins: warmPlugins } = useSearchIndexes();
  const [catalog, setCatalog] = useState<PluginCatalog | null>(null);
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
    if (warmPlugins.length > 0 && catalog == null) {
      setCatalog({ schemaVersion: 1, plugins: warmPlugins });
      return;
    }
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const next = await window.api.getPluginCatalog();
      setCatalog(next);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : String(err));
    } finally {
      setCatalogLoading(false);
    }
  }, [catalog, warmPlugins]);

  /**
   * Clears marketplace search/filter state when leaving the Marketplace section.
   */
  const resetCatalogFilters = useCallback((): void => {
    setCatalogSearchQuery('');
    setCatalogCategoryFilter('');
  }, []);

  /**
   * Keeps catalog entries that match the active management kind (plugins vs themes).
   */
  const partitionCatalogByKind = useCallback(
    (entries: PluginCatalogEntry[]): PluginCatalogEntry[] => {
      if (kind === 'themes') {
        return entries.filter(catalogEntryIsTheme);
      }
      return entries.filter((entry) => !catalogEntryIsTheme(entry));
    },
    [kind]
  );

  /**
   * Maps loaded marketplace catalog entries by plugin id for screenshot lookup.
   */
  const catalogById = useMemo(() => {
    if (!catalog?.plugins.length) {
      return new Map<string, PluginCatalogEntry>();
    }
    return new Map(catalog.plugins.map((entry) => [entry.id, entry]));
  }, [catalog]);

  /**
   * Builds a searchable index over the loaded marketplace catalog, falling back to the warm index.
   */
  const catalogSearchIndex = useMemo(() => {
    const base = catalog?.plugins.length ? catalog.plugins : warmPlugins;
    const partitioned = partitionCatalogByKind(base);
    if (partitioned.length) {
      return buildPluginCatalogSearchIndex(partitioned);
    }
    if (kind === 'plugins') {
      return warmPluginsIndex;
    }
    return null;
  }, [catalog, warmPlugins, warmPluginsIndex, kind, partitionCatalogByKind]);

  /**
   * Filters marketplace catalog rows by kind, category, and search query.
   */
  const filteredCatalogPlugins = useMemo(() => {
    const plugins = partitionCatalogByKind(catalog?.plugins ?? warmPlugins);
    if (!plugins.length) {
      return [];
    }

    const byCategory = filterPluginCatalogByCategory(plugins, catalogCategoryFilter);
    const trimmed = catalogSearchQuery.trim();
    if (!catalogSearchIndex) {
      return trimmed ? [] : byCategory;
    }

    const searched = searchPluginCatalog(plugins, catalogSearchIndex, catalogSearchQuery);
    if (!catalogCategoryFilter) {
      return searched;
    }

    const categoryIds = new Set(byCategory.map((entry) => entry.id));
    return searched.filter((entry) => categoryIds.has(entry.id));
  }, [
    catalog,
    warmPlugins,
    catalogSearchIndex,
    catalogSearchQuery,
    catalogCategoryFilter,
    partitionCatalogByKind
  ]);

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
    filteredCatalogPlugins,
    loadCatalog,
    resetCatalogFilters
  };
}
