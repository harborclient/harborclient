import { createContext } from 'react';
import type { PluginCatalog } from '#/shared/plugin/catalog';
import type { SearchAllContext, SidebarSearchInput } from '#/shared/search';
import type {
  buildPluginCatalogSearchIndex,
  buildSettingsSearchIndex,
  buildSidebarSearchIndex
} from '#/shared/search';

/**
 * Readiness flags for each search domain warmed by the provider.
 */
export interface SearchIndexReady {
  /** True once collections have been listed at least once. */
  sidebar: boolean;
  /** Settings catalog is static and always ready after first render. */
  settings: boolean;
  /** True once the marketplace catalog fetch completes (success or failure). */
  plugins: boolean;
}

/**
 * Value exposed by {@link SearchIndexProvider} for domain and unified search.
 */
export interface SearchIndexContextValue {
  /** Sidebar entity data used to build and query the sidebar index. */
  sidebarInput: SidebarSearchInput;
  /** MiniSearch index over collections, folders, requests, and environments. */
  sidebarIndex: ReturnType<typeof buildSidebarSearchIndex> | null;
  /** MiniSearch index over the settings catalog manifest. */
  settingsIndex: ReturnType<typeof buildSettingsSearchIndex>;
  /** MiniSearch index over marketplace plugin metadata, when catalog is loaded. */
  pluginsIndex: ReturnType<typeof buildPluginCatalogSearchIndex> | null;
  /** Loaded marketplace catalog rows (empty when unavailable). */
  plugins: PluginCatalog['plugins'];
  /** Per-domain readiness for UI feedback. */
  ready: SearchIndexReady;
  /** Prebuilt context object for {@link searchAll}. */
  searchContext: SearchAllContext;
}

/**
 * React context for warm search indexes shared across the app shell.
 */
export const SearchIndexContext = createContext<SearchIndexContextValue | null>(null);
