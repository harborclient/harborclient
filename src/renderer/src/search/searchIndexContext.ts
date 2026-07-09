import { createContext } from 'react';
import type { PluginCatalog } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';
import type { SnippetCatalog } from '#/shared/snippet/catalog';
import type { SearchAllContext, SidebarSearchInput } from '#/shared/search';
import type {
  buildInstalledPluginSearchIndex,
  buildPluginCatalogSearchIndex,
  buildSettingsSearchIndex,
  buildSidebarSearchIndex,
  buildSnippetCatalogSearchIndexForSearch
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
  /** True once the installed plugin list fetch completes (success or failure). */
  installedPlugins: boolean;
  /** True once the snippet marketplace catalog fetch completes (success or failure). */
  snippets: boolean;
}

/**
 * Value exposed by {@link SearchIndexProvider} for domain and unified search.
 */
export interface SearchIndexContextValue {
  /** Sidebar entity data used to build and query the sidebar index. */
  sidebarInput: SidebarSearchInput;
  /** Orama index over collections, folders, requests, and environments. */
  sidebarIndex: ReturnType<typeof buildSidebarSearchIndex> | null;
  /** Orama index over the settings catalog manifest. */
  settingsIndex: ReturnType<typeof buildSettingsSearchIndex>;
  /** Orama index over marketplace plugin metadata, when catalog is loaded. */
  pluginsIndex: ReturnType<typeof buildPluginCatalogSearchIndex> | null;
  /** Orama index over installed plugin metadata, when the list is loaded. */
  installedPluginsIndex: ReturnType<typeof buildInstalledPluginSearchIndex> | null;
  /** Loaded marketplace catalog rows (empty when unavailable). */
  plugins: PluginCatalog['plugins'];
  /** Installed plugin rows from the main process. */
  installedPlugins: PluginInfo[];
  /** Orama index over marketplace snippet bundle metadata, when catalog is loaded. */
  snippetsIndex: ReturnType<typeof buildSnippetCatalogSearchIndexForSearch> | null;
  /** Loaded marketplace snippet catalog rows (empty when unavailable). */
  snippets: SnippetCatalog['snippets'];
  /** Per-domain readiness for UI feedback. */
  ready: SearchIndexReady;
  /** Prebuilt context object for {@link searchAll}. */
  searchContext: SearchAllContext;
}

/**
 * React context for warm search indexes shared across the app shell.
 */
export const SearchIndexContext = createContext<SearchIndexContextValue | null>(null);
