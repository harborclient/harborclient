import { useMemo, type JSX, type ReactNode } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectCollections, selectCollectionsListed } from '#/renderer/src/store/selectors';
import { SidebarExpansionContext } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarExpansionContext';
import { usePersistedSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/usePersistedSidebarExpansion';
import { SidebarSectionMenuSync } from './SidebarSectionMenuSync';

interface Props {
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
 * Keeps sidebar expansion state alive across sidebar mount/unmount cycles.
 */
export function SidebarExpansionProvider({ onExpandCollection, children }: Props): JSX.Element {
  const collections = useAppSelector(selectCollections);
  const collectionsListed = useAppSelector(selectCollectionsListed);

  /**
   * Collection ids currently present in the store, used to prune stale expansion keys.
   */
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
