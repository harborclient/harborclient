import { useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';
import type { PluginCatalog } from '#/shared/plugin/catalog';
import {
  buildPluginCatalogSearchIndex,
  buildSettingsSearchIndex,
  buildSidebarSearchIndex,
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
} from '#/renderer/src/search/searchIndexContext';

interface Props {
  /** Application subtree that consumes warm search indexes. */
  children: ReactNode;
}

/**
 * Warms MiniSearch indexes for sidebar, settings, and plugins at app startup
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

  const ready = useMemo<SearchIndexReady>(
    () => ({
      sidebar: collectionsListed,
      settings: true,
      plugins: pluginsFetchSettled
    }),
    [collectionsListed, pluginsFetchSettled]
  );

  /**
   * Aggregated indexes and lookup data for unified search.
   */
  const searchContext = useMemo<SearchAllContext>(
    () => ({
      sidebarIndex,
      settingsIndex,
      pluginsIndex,
      sidebarInput,
      plugins: pluginCatalog?.plugins ?? []
    }),
    [sidebarIndex, settingsIndex, pluginsIndex, sidebarInput, pluginCatalog]
  );

  const value = useMemo<SearchIndexContextValue>(
    () => ({
      sidebarInput,
      sidebarIndex,
      settingsIndex,
      pluginsIndex,
      plugins: pluginCatalog?.plugins ?? [],
      ready,
      searchContext
    }),
    [sidebarInput, sidebarIndex, settingsIndex, pluginsIndex, pluginCatalog, ready, searchContext]
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

  return <SearchIndexContext.Provider value={value}>{children}</SearchIndexContext.Provider>;
}
