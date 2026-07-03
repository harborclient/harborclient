import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Collection, Folder } from '#/shared/types';
import { searchSidebar, type SidebarSearchFilter } from '#/shared/search/sidebar';
import { useSearchIndexes } from '#/renderer/src/search/useSearchIndexes';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { refreshCollectionContents } from '#/renderer/src/store/thunks';

interface ExpansionSnapshot {
  /**
   * Whether the Collections section was expanded before search started.
   */
  collectionsSectionExpanded: boolean;

  /**
   * Whether the Environments section was expanded before search started.
   */
  environmentsSectionExpanded: boolean;

  /**
   * Collection ids expanded before search started.
   */
  expandedCollectionIds: Set<number>;

  /**
   * Folder ids expanded before search started.
   */
  expandedFolderIds: Set<number>;
}

interface Options {
  /**
   * Collections in sidebar display order.
   */
  collections: Collection[];

  /**
   * Folders grouped by collection id.
   */
  foldersByCollection: Record<number, Folder[]>;

  /**
   * Whether the Collections section body is visible.
   */
  collectionsSectionExpanded: boolean;

  /**
   * Whether the Environments section body is visible.
   */
  environmentsSectionExpanded: boolean;

  /**
   * Sets the Collections section expanded state.
   */
  setCollectionsSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Environments section expanded state.
   */
  setEnvironmentsSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Collections section visibility.
   */
  setCollectionsSectionVisible: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Environments section visibility.
   */
  setEnvironmentsSectionVisible: Dispatch<SetStateAction<boolean>>;

  /**
   * Collection ids whose request trees are expanded.
   */
  expandedCollectionIds: Set<number>;

  /**
   * Folder ids whose request lists are expanded.
   */
  expandedFolderIds: Set<number>;

  /**
   * Updates expanded collection ids.
   */
  setExpandedCollectionIds: Dispatch<SetStateAction<Set<number>>>;

  /**
   * Updates expanded folder ids.
   */
  setExpandedFolderIds: Dispatch<SetStateAction<Set<number>>>;
}

interface Result {
  /**
   * Raw search text from the sidebar search field.
   */
  searchQuery: string;

  /**
   * Updates the sidebar search query.
   */
  setSearchQuery: Dispatch<SetStateAction<string>>;

  /**
   * Visibility sets for filtering sidebar rows, or null when search is inactive.
   */
  searchFilter: SidebarSearchFilter | null;

  /**
   * True while a non-empty query is active and some collection contents are still loading.
   */
  searchLoading: boolean;
}

/**
 * Adds ids from `source` into `target` and reports whether `target` changed.
 *
 * @param target - Expansion set to mutate.
 * @param source - Ids that should be present in the target set.
 */
function addIdsToSet(target: Set<number>, source: ReadonlySet<number>): boolean {
  let changed = false;
  for (const id of source) {
    if (!target.has(id)) {
      target.add(id);
      changed = true;
    }
  }
  return changed;
}

/**
 * Manages sidebar search state, indexing, prefetch, and temporary expansion overrides.
 *
 * @param options - Sidebar data and expansion helpers from the parent component.
 */
export function useSidebarSearch({
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
}: Options): Result {
  const dispatch = useAppDispatch();
  const { sidebarInput, sidebarIndex } = useSearchIndexes();
  const [searchQuery, setSearchQuery] = useState('');
  const expansionSnapshotRef = useRef<ExpansionSnapshot | null>(null);
  const expansionStateRef = useRef({
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    expandedCollectionIds,
    expandedFolderIds
  });

  /**
   * Keeps the latest expansion state available for snapshotting on search start.
   */
  useEffect(() => {
    expansionStateRef.current = {
      collectionsSectionExpanded,
      environmentsSectionExpanded,
      expandedCollectionIds,
      expandedFolderIds
    };
  }, [
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    expandedCollectionIds,
    expandedFolderIds
  ]);

  /**
   * Derives visibility sets from the current query and warm sidebar search index.
   */
  const searchFilter = useMemo(
    () => (sidebarIndex == null ? null : searchSidebar(sidebarInput, sidebarIndex, searchQuery)),
    [sidebarInput, sidebarIndex, searchQuery]
  );

  /**
   * True when search is active but at least one collection's contents have not loaded yet.
   */
  const searchLoading = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return false;
    }
    return collections.some((collection) => foldersByCollection[collection.id] === undefined);
  }, [collections, foldersByCollection, searchQuery]);

  /**
   * Loads collection folders and requests needed for complete sidebar search results.
   */
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }

    for (const collection of collections) {
      if (foldersByCollection[collection.id] === undefined) {
        void dispatch(refreshCollectionContents(collection.id));
      }
    }
  }, [collections, dispatch, foldersByCollection, searchQuery]);

  /**
   * Snapshots expansion when search starts and restores it when the query is cleared.
   */
  useEffect(() => {
    const isSearching = searchQuery.trim().length > 0;

    if (!isSearching) {
      const snapshot = expansionSnapshotRef.current;
      if (snapshot == null) {
        return;
      }

      setCollectionsSectionExpanded(snapshot.collectionsSectionExpanded);
      setEnvironmentsSectionExpanded(snapshot.environmentsSectionExpanded);
      setExpandedCollectionIds(new Set(snapshot.expandedCollectionIds));
      setExpandedFolderIds(new Set(snapshot.expandedFolderIds));
      expansionSnapshotRef.current = null;
      return;
    }

    if (expansionSnapshotRef.current != null) {
      return;
    }

    const current = expansionStateRef.current;
    expansionSnapshotRef.current = {
      collectionsSectionExpanded: current.collectionsSectionExpanded,
      environmentsSectionExpanded: current.environmentsSectionExpanded,
      expandedCollectionIds: new Set(current.expandedCollectionIds),
      expandedFolderIds: new Set(current.expandedFolderIds)
    };
  }, [
    searchQuery,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    setExpandedCollectionIds,
    setExpandedFolderIds
  ]);

  /**
   * Opens both sidebar sections and expands rows that match the active search filter.
   */
  useEffect(() => {
    if (searchFilter == null) {
      return;
    }

    setCollectionsSectionExpanded((current) => (current ? current : true));
    setEnvironmentsSectionExpanded((current) => (current ? current : true));

    if (
      searchFilter.collectionIds.size > 0 ||
      searchFilter.folderIds.size > 0 ||
      searchFilter.requestIds.size > 0
    ) {
      setCollectionsSectionVisible(true);
    }

    if (searchFilter.environmentIds.size > 0) {
      setEnvironmentsSectionVisible(true);
    }

    setExpandedCollectionIds((current) => {
      const next = new Set(current);
      return addIdsToSet(next, searchFilter.collectionIds) ? next : current;
    });

    setExpandedFolderIds((current) => {
      const next = new Set(current);
      return addIdsToSet(next, searchFilter.folderIds) ? next : current;
    });
  }, [
    searchFilter,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    setCollectionsSectionVisible,
    setEnvironmentsSectionVisible,
    setExpandedCollectionIds,
    setExpandedFolderIds
  ]);

  return {
    searchQuery,
    setSearchQuery,
    searchFilter,
    searchLoading
  };
}
