import { useMemo, type JSX, type ReactNode } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectCollections, selectFoldersByCollection } from '#/renderer/src/store/selectors';
import { useSidebarExpansion } from '../expansion/useSidebarExpansion';
import { useSidebarSearch } from './useSidebarSearch';
import { SidebarSearchContext, type SidebarSearchContextValue } from './sidebarSearchContext';

interface ProviderProps {
  /**
   * Sidebar subtree that reads search state.
   */
  children: ReactNode;
}

/**
 * Owns sidebar search state and shares it with the search field, toolbar, and
 * collection/environment/archive sections so they no longer receive it via props.
 */
export function SidebarSearchProvider({ children }: ProviderProps): JSX.Element {
  const collections = useAppSelector(selectCollections);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const {
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    archiveSectionExpanded,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    setArchiveSectionExpanded,
    setCollectionsSectionVisible,
    setEnvironmentsSectionVisible,
    setArchiveSectionVisible,
    expandedCollectionIds,
    expandedFolderIds,
    expandedEnvironmentIds,
    setExpandedCollectionIds,
    setExpandedFolderIds,
    setExpandedEnvironmentIds
  } = useSidebarExpansion();

  const {
    searchQuery,
    setSearchQuery,
    searchFilter,
    archivedSearchFilter,
    searchLoading,
    collapseAllSidebarTrees
  } = useSidebarSearch({
    collections,
    foldersByCollection,
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    archiveSectionExpanded,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    setArchiveSectionExpanded,
    setCollectionsSectionVisible,
    setEnvironmentsSectionVisible,
    setArchiveSectionVisible,
    expandedCollectionIds,
    expandedFolderIds,
    expandedEnvironmentIds,
    setExpandedCollectionIds,
    setExpandedFolderIds,
    setExpandedEnvironmentIds
  });

  const value = useMemo<SidebarSearchContextValue>(
    () => ({
      searchQuery,
      setSearchQuery,
      searchFilter,
      archivedSearchFilter,
      searchActive: searchFilter != null,
      searchLoading,
      collapseAllSidebarTrees
    }),
    [
      searchQuery,
      setSearchQuery,
      searchFilter,
      archivedSearchFilter,
      searchLoading,
      collapseAllSidebarTrees
    ]
  );

  return <SidebarSearchContext.Provider value={value}>{children}</SidebarSearchContext.Provider>;
}
