import { useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';
import type { PluginCatalog } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';
import type { SnippetCatalog } from '#/shared/snippet/catalog';
import {
  buildInstalledPluginSearchIndex,
  buildPluginCatalogSearchIndex,
  buildSettingsSearchIndex,
  buildSidebarSearchIndex,
  buildSnippetCatalogSearchIndexForSearch,
  type SearchAllContext,
  type SidebarSearchInput
} from '#/shared/search';
import {
  selectCollections,
  selectCollectionsListed,
  selectEnvironments,
  selectFoldersByCollection,
  selectRequestsByCollection
} from '#/renderer/src/store/selectors';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { refreshCollectionContents } from '#/renderer/src/store/thunks';
import {
  SearchIndexContext,
  type SearchIndexContextValue,
  type SearchIndexReady
} from './searchIndexContext';

interface Props {
  /** Application subtree that consumes warm search indexes. */
  children: ReactNode;
}

/**
 * Warms Orama indexes for sidebar, settings, and plugins at app startup
 * and rebuilds them when underlying domain data changes.
 */
export function SearchIndexProvider({ children }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const collections = useAppSelector(selectCollections);
  const collectionsListed = useAppSelector(selectCollectionsListed);
  const environments = useAppSelector(selectEnvironments);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);

  const [pluginCatalog, setPluginCatalog] = useState<PluginCatalog | null>(null);
  const [pluginsFetchSettled, setPluginsFetchSettled] = useState(false);
  const [snippetCatalog, setSnippetCatalog] = useState<SnippetCatalog | null>(null);
  const [snippetsFetchSettled, setSnippetsFetchSettled] = useState(false);
  const [installedPlugins, setInstalledPlugins] = useState<PluginInfo[]>([]);
  const [installedPluginsFetchSettled, setInstalledPluginsFetchSettled] = useState(false);

  /**
   * Plain sidebar data shape shared with search index builders.
   */
  const sidebarInput = useMemo<SidebarSearchInput>(
    () => ({
      collections,
      foldersByCollection,
      requestsByCollection,
      environments
    }),
    [collections, foldersByCollection, requestsByCollection, environments]
  );

  /**
   * Static settings catalog index built once per provider mount.
   */
  const settingsIndex = useMemo(() => buildSettingsSearchIndex(), []);

  /**
   * Sidebar index rebuilt whenever sidebar entity data changes.
   */
  const sidebarIndex = useMemo(() => {
    if (!collectionsListed) {
      return null;
    }
    return buildSidebarSearchIndex(sidebarInput);
  }, [collectionsListed, sidebarInput]);

  /**
   * Plugin catalog index rebuilt when catalog data changes.
   */
  const pluginsIndex = useMemo(() => {
    if (pluginCatalog == null || pluginCatalog.plugins.length === 0) {
      return null;
    }
    return buildPluginCatalogSearchIndex(pluginCatalog.plugins);
  }, [pluginCatalog]);

  /**
   * Installed plugins index rebuilt when the main-process list changes.
   */
  const installedPluginsIndex = useMemo(() => {
    if (installedPlugins.length === 0) {
      return null;
    }
    return buildInstalledPluginSearchIndex(installedPlugins);
  }, [installedPlugins]);

  /**
   * Snippet catalog index rebuilt when catalog data changes.
   */
  const snippetsIndex = useMemo(() => {
    if (snippetCatalog == null || snippetCatalog.snippets.length === 0) {
      return null;
    }
    return buildSnippetCatalogSearchIndexForSearch(snippetCatalog.snippets);
  }, [snippetCatalog]);

  const ready = useMemo<SearchIndexReady>(
    () => ({
      sidebar: collectionsListed,
      settings: true,
      plugins: pluginsFetchSettled,
      installedPlugins: installedPluginsFetchSettled,
      snippets: snippetsFetchSettled
    }),
    [collectionsListed, pluginsFetchSettled, installedPluginsFetchSettled, snippetsFetchSettled]
  );

  /**
   * Aggregated indexes and lookup data for unified search.
   */
  const searchContext = useMemo<SearchAllContext>(
    () => ({
      sidebarIndex,
      settingsIndex,
      pluginsIndex,
      installedPluginsIndex,
      snippetsIndex,
      sidebarInput,
      plugins: pluginCatalog?.plugins ?? [],
      installedPlugins,
      snippets: snippetCatalog?.snippets ?? []
    }),
    [
      sidebarIndex,
      settingsIndex,
      pluginsIndex,
      installedPluginsIndex,
      snippetsIndex,
      sidebarInput,
      pluginCatalog,
      installedPlugins,
      snippetCatalog
    ]
  );

  const value = useMemo<SearchIndexContextValue>(
    () => ({
      sidebarInput,
      sidebarIndex,
      settingsIndex,
      pluginsIndex,
      installedPluginsIndex,
      snippetsIndex,
      plugins: pluginCatalog?.plugins ?? [],
      installedPlugins,
      snippets: snippetCatalog?.snippets ?? [],
      ready,
      searchContext
    }),
    [
      sidebarInput,
      sidebarIndex,
      settingsIndex,
      pluginsIndex,
      installedPluginsIndex,
      snippetsIndex,
      pluginCatalog,
      installedPlugins,
      snippetCatalog,
      ready,
      searchContext
    ]
  );

  /**
   * Prefetches all collection folders and requests so the sidebar index is complete.
   */
  useEffect(() => {
    if (!collectionsListed) {
      return;
    }
    for (const collection of collections) {
      if (foldersByCollection[collection.id] === undefined) {
        void dispatch(refreshCollectionContents(collection.id));
      }
    }
  }, [collections, collectionsListed, dispatch, foldersByCollection]);

  /**
   * Loads the marketplace plugin catalog on startup for global search readiness.
   */
  useEffect(() => {
    let active = true;
    void window.api
      .getPluginCatalog()
      .then((catalog) => {
        if (active) {
          setPluginCatalog(catalog);
        }
      })
      .catch(() => {
        // Global search degrades gracefully when the catalog is unavailable.
      })
      .finally(() => {
        if (active) {
          setPluginsFetchSettled(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  /**
   * Loads the marketplace snippet catalog on startup for global search readiness.
   */
  useEffect(() => {
    let active = true;
    void window.api
      .getSnippetCatalog()
      .then((catalog) => {
        if (active) {
          setSnippetCatalog(catalog);
        }
      })
      .catch(() => {
        // Global search degrades gracefully when the catalog is unavailable.
      })
      .finally(() => {
        if (active) {
          setSnippetsFetchSettled(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  /**
   * Loads installed plugins on startup and rebuilds the index when the list changes.
   */
  useEffect(() => {
    let active = true;

    /**
     * Refreshes installed plugin rows from the main process.
     */
    const refreshInstalledPlugins = async (): Promise<void> => {
      try {
        const next = await window.api.listPlugins();
        if (active) {
          setInstalledPlugins(next);
        }
      } catch {
        // Global search degrades gracefully when the plugin list is unavailable.
      } finally {
        if (active) {
          setInstalledPluginsFetchSettled(true);
        }
      }
    };

    void refreshInstalledPlugins();
    const unsubscribe = window.api.onPluginsChanged(() => {
      void refreshInstalledPlugins();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return <SearchIndexContext.Provider value={value}>{children}</SearchIndexContext.Provider>;
}
