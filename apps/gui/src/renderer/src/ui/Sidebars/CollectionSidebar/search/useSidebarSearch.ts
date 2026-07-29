import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react';
import type { Collection, Folder, SidebarMode } from '@harborclient/core/types';
import {
  partitionSidebarSearchFilter,
  searchSidebar,
  type SidebarSearchFilter
} from '@harborclient/core/search/sidebar';
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
   * Whether the Archive section was expanded before search started.
   */
  archiveSectionExpanded: boolean;

  /**
   * Activity-rail mode before search started.
   */
  activeSidebarMode: SidebarMode;

  /**
   * Collection ids expanded before search started.
   */
  expandedCollectionIds: Set<number>;

  /**
   * Folder ids expanded before search started.
   */
  expandedFolderIds: Set<number>;

  /**
   * Environment ids expanded before search started.
   */
  expandedEnvironmentIds: Set<number>;
}

interface Options {
  /**
   * Collections in sidebar display order (active and archived).
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
   * Whether the Archive section body is visible.
   */
  archiveSectionExpanded: boolean;

  /**
   * Sets the Collections section expanded state.
   */
  setCollectionsSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Environments section expanded state.
   */
  setEnvironmentsSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Archive section expanded state.
   */
  setArchiveSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Active activity-rail mode (snapshotted/restored around search).
   */
  activeSidebarMode: SidebarMode;

  /**
   * Sets the active activity-rail mode.
   */
  setActiveSidebarMode: Dispatch<SetStateAction<SidebarMode>>;

  /**
   * Collection ids whose request trees are expanded.
   */
  expandedCollectionIds: Set<number>;

  /**
   * Folder ids whose request lists are expanded.
   */
  expandedFolderIds: Set<number>;

  /**
   * Environment ids whose child environments are expanded.
   */
  expandedEnvironmentIds: Set<number>;

  /**
   * Updates expanded collection ids.
   */
  setExpandedCollectionIds: Dispatch<SetStateAction<Set<number>>>;

  /**
   * Updates expanded folder ids.
   */
  setExpandedFolderIds: Dispatch<SetStateAction<Set<number>>>;

  /**
   * Updates expanded environment ids.
   */
  setExpandedEnvironmentIds: Dispatch<SetStateAction<Set<number>>>;
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
   * Archived half of the search filter, or null when search is inactive.
   */
  archivedSearchFilter: SidebarSearchFilter | null;

  /**
   * Active (non-archived) half of the search filter, or null when search is inactive.
   */
  activeSearchFilter: SidebarSearchFilter | null;

  /**
   * True while a non-empty query is active and some collection contents are still loading.
   */
  searchLoading: boolean;

  /**
   * Collapses trees relevant to the given activity-rail mode, clears active search,
   * and persists collapsed state for the cleared expansion sets.
   *
   * @param mode - Active activity-rail sidebar mode.
   */
  collapseSidebarTreesForMode: (mode: SidebarMode) => void;
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
 * Clears tree expansion on a search snapshot so collapse survives search exit.
 *
 * @param snapshot - Expansion state captured when sidebar search started.
 */
export function clearExpansionSnapshot(snapshot: ExpansionSnapshot): ExpansionSnapshot {
  return {
    ...snapshot,
    expandedCollectionIds: new Set(),
    expandedFolderIds: new Set(),
    expandedEnvironmentIds: new Set()
  };
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
}: Options): Result {
  const dispatch = useAppDispatch();
  const { sidebarInput, sidebarIndex } = useSearchIndexes();
  const [searchQuery, setSearchQuery] = useState('');
  const expansionSnapshotRef = useRef<ExpansionSnapshot | null>(null);
  const expansionStateRef = useRef({
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    archiveSectionExpanded,
    activeSidebarMode,
    expandedCollectionIds,
    expandedFolderIds,
    expandedEnvironmentIds
  });

  /**
   * Keeps the latest expansion state available for snapshotting on search start.
   */
  useEffect(() => {
    expansionStateRef.current = {
      collectionsSectionExpanded,
      environmentsSectionExpanded,
      archiveSectionExpanded,
      activeSidebarMode,
      expandedCollectionIds,
      expandedFolderIds,
      expandedEnvironmentIds
    };
  }, [
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    archiveSectionExpanded,
    activeSidebarMode,
    expandedCollectionIds,
    expandedFolderIds,
    expandedEnvironmentIds
  ]);

  /**
   * Derives visibility sets from the current query and warm sidebar search index.
   */
  const searchFilter = useMemo(
    () => (sidebarIndex == null ? null : searchSidebar(sidebarInput, sidebarIndex, searchQuery)),
    [sidebarInput, sidebarIndex, searchQuery]
  );

  /**
   * Active and archived halves of the current search filter.
   */
  const partitionedSearchFilter = useMemo(() => {
    if (searchFilter == null) {
      return null;
    }
    return partitionSidebarSearchFilter(sidebarInput, searchFilter);
  }, [searchFilter, sidebarInput]);

  /**
   * Archived collection matches partitioned from the active search filter.
   */
  const archivedSearchFilter = partitionedSearchFilter?.archived ?? null;

  /**
   * Active (non-archived) collection matches partitioned from the search filter.
   */
  const activeSearchFilter = partitionedSearchFilter?.active ?? null;

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
   * Snapshots expansion and rail mode when search starts; restores them when cleared.
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
      setArchiveSectionExpanded(snapshot.archiveSectionExpanded);
      setActiveSidebarMode(snapshot.activeSidebarMode);
      setExpandedCollectionIds(new Set(snapshot.expandedCollectionIds));
      setExpandedFolderIds(new Set(snapshot.expandedFolderIds));
      setExpandedEnvironmentIds(new Set(snapshot.expandedEnvironmentIds));
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
      archiveSectionExpanded: current.archiveSectionExpanded,
      activeSidebarMode: current.activeSidebarMode,
      expandedCollectionIds: new Set(current.expandedCollectionIds),
      expandedFolderIds: new Set(current.expandedFolderIds),
      expandedEnvironmentIds: new Set(current.expandedEnvironmentIds)
    };
  }, [
    searchQuery,
    setActiveSidebarMode,
    setArchiveSectionExpanded,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    setExpandedCollectionIds,
    setExpandedFolderIds,
    setExpandedEnvironmentIds
  ]);

  /**
   * Opens matching sidebar sections and expands rows that match the active search filter.
   */
  useEffect(() => {
    if (searchFilter == null || activeSearchFilter == null || archivedSearchFilter == null) {
      return;
    }

    if (
      activeSearchFilter.collectionIds.size > 0 ||
      activeSearchFilter.folderIds.size > 0 ||
      activeSearchFilter.requestIds.size > 0
    ) {
      setCollectionsSectionExpanded((current) => (current ? current : true));
    }

    if (activeSearchFilter.environmentIds.size > 0) {
      setEnvironmentsSectionExpanded((current) => (current ? current : true));
    }

    if (archivedSearchFilter.collectionIds.size > 0) {
      setArchiveSectionExpanded((current) => (current ? current : true));
    }

    setExpandedCollectionIds((current) => {
      const next = new Set(current);
      return addIdsToSet(next, activeSearchFilter.collectionIds) ? next : current;
    });

    setExpandedFolderIds((current) => {
      const next = new Set(current);
      return addIdsToSet(next, activeSearchFilter.folderIds) ? next : current;
    });
  }, [
    activeSearchFilter,
    archivedSearchFilter,
    searchFilter,
    setArchiveSectionExpanded,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    setExpandedCollectionIds,
    setExpandedFolderIds
  ]);

  /**
   * Collapses trees for the active rail mode, clears search when active, and keeps the collapsed
   * state when search snapshots are restored.
   *
   * Collections mode clears collection and folder trees; environments mode clears environment
   * trees. Other modes skip tree clearing but still clear an active search query.
   *
   * @param mode - Active activity-rail sidebar mode.
   */
  const collapseSidebarTreesForMode = useCallback(
    (mode: SidebarMode): void => {
      if (mode === 'collections') {
        setExpandedCollectionIds(new Set());
        setExpandedFolderIds(new Set());

        if (expansionSnapshotRef.current != null) {
          expansionSnapshotRef.current = {
            ...expansionSnapshotRef.current,
            expandedCollectionIds: new Set(),
            expandedFolderIds: new Set()
          };
        }
      } else if (mode === 'environments') {
        setExpandedEnvironmentIds(new Set());

        if (expansionSnapshotRef.current != null) {
          expansionSnapshotRef.current = {
            ...expansionSnapshotRef.current,
            expandedEnvironmentIds: new Set()
          };
        }
      }

      setSearchQuery((current) => (current.trim().length > 0 ? '' : current));
    },
    [setExpandedCollectionIds, setExpandedEnvironmentIds, setExpandedFolderIds]
  );

  return {
    searchQuery,
    setSearchQuery,
    searchFilter,
    archivedSearchFilter,
    activeSearchFilter,
    searchLoading,
    collapseSidebarTreesForMode
  };
}
