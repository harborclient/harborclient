import { useMemo, type JSX, type ReactNode } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectCollections, selectCollectionsListed } from '#/renderer/src/store/selectors';
import { SidebarExpansionContext } from '#/renderer/src/ui/Sidebar/sidebarExpansionContext';
import { usePersistedSidebarExpansion } from '#/renderer/src/ui/Sidebar/usePersistedSidebarExpansion';
import { useSidebarSectionMenuSync } from '#/renderer/src/hooks/useSidebarSectionMenuSync';

interface ProviderProps {
  /**
   * Loads requests and folders when a collection is expanded.
   */
  onExpandCollection: (id: number) => void;

  /**
   * Application subtree that reads or updates sidebar expansion state.
   */
  children: ReactNode;
}

/**
 * Syncs View menu section visibility inside the expansion provider tree.
 */
function SidebarSectionMenuSync(): null {
  useSidebarSectionMenuSync();
  return null;
}

/**
 * Keeps sidebar expansion state alive across sidebar mount/unmount cycles.
 */
export function SidebarExpansionProvider({
  onExpandCollection,
  children
}: ProviderProps): JSX.Element {
  const collections = useAppSelector(selectCollections);
  const collectionsListed = useAppSelector(selectCollectionsListed);
  const validCollectionIds = useMemo(
    () => new Set(collections.map((collection) => collection.id)),
    [collections]
  );

  const value = usePersistedSidebarExpansion({
    onExpandCollection,
    validCollectionIds,
    collectionsListed
  });

  return (
    <SidebarExpansionContext.Provider value={value}>
      <SidebarSectionMenuSync />
      {children}
    </SidebarExpansionContext.Provider>
  );
}
