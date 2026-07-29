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
 * Owns sidebar search state and shares it with the search field, rail, and
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
    activeSidebarMode,
    setActiveSidebarMode,
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
    activeSearchFilter,
    searchLoading,
    collapseSidebarTreesForMode
  } = useSidebarSearch({
    collections,
    foldersByCollection,
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    archiveSectionExpanded,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    setArchiveSectionExpanded,
    activeSidebarMode,
    setActiveSidebarMode,
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
      activeSearchFilter,
      searchActive: searchFilter != null,
      searchLoading,
      collapseSidebarTreesForMode
    }),
    [
      searchQuery,
      setSearchQuery,
      searchFilter,
      archivedSearchFilter,
      activeSearchFilter,
      searchLoading,
      collapseSidebarTreesForMode
    ]
  );

  return <SidebarSearchContext.Provider value={value}>{children}</SidebarSearchContext.Provider>;
}
