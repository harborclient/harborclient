import { useMemo, type JSX, type ReactNode } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectCollections, selectFoldersByCollection } from '#/renderer/src/store/selectors';
import { useSidebarExpansion } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarExpansion';
import { useSidebarSearch } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarSearch';
import {
  SidebarSearchContext,
  type SidebarSearchContextValue
} from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarSearchContext';

interface ProviderProps {
  /**
   * Sidebar subtree that reads search state.
   */
  children: ReactNode;
}

/**
 * Owns sidebar search state and shares it with the search field, toolbar, and
 * collection/environment sections so they no longer receive it via props.
 */
export function SidebarSearchProvider({ children }: ProviderProps): JSX.Element {
  const collections = useAppSelector(selectCollections);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const {
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    setCollectionsSectionVisible,
    setEnvironmentsSectionVisible,
    expandedCollectionIds,
    expandedFolderIds,
    setExpandedCollectionIds,
    setExpandedFolderIds
  } = useSidebarExpansion();

  const { searchQuery, setSearchQuery, searchFilter, searchLoading, collapseAllSidebarTrees } =
    useSidebarSearch({
      collections,
      foldersByCollection,
      collectionsSectionExpanded,
      environmentsSectionExpanded,
      setCollectionsSectionExpanded,
      setEnvironmentsSectionExpanded,
      setCollectionsSectionVisible,
      setEnvironmentsSectionVisible,
      expandedCollectionIds,
      expandedFolderIds,
      setExpandedCollectionIds,
      setExpandedFolderIds
    });

  const value = useMemo<SidebarSearchContextValue>(
    () => ({
      searchQuery,
      setSearchQuery,
      searchFilter,
      searchActive: searchFilter != null,
      searchLoading,
      collapseAllSidebarTrees
    }),
    [searchQuery, setSearchQuery, searchFilter, searchLoading, collapseAllSidebarTrees]
  );

  return <SidebarSearchContext.Provider value={value}>{children}</SidebarSearchContext.Provider>;
}
