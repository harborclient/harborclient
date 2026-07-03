import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react';
import { defaultSidebarExpansion } from '#/shared/sidebarExpansion';
import type { SidebarExpansionState } from '#/shared/types';

interface Options {
  /**
   * Loads requests and folders when a collection is expanded.
   */
  onExpandCollection: (id: number) => void;

  /**
   * Global collection ids that still exist after the latest sidebar refresh.
   */
  validCollectionIds: ReadonlySet<number>;

  /**
   * True after the first collections list has been loaded from the main process.
   */
  collectionsListed: boolean;
}

interface Result {
  /**
   * Whether persisted expansion state has been loaded from disk.
   */
  loaded: boolean;

  /**
   * Whether the Collections section body is visible.
   */
  collectionsSectionExpanded: boolean;

  /**
   * Whether the Environments section body is visible.
   */
  environmentsSectionExpanded: boolean;

  /**
   * Toggles the Collections section expanded state.
   */
  toggleCollectionsSection: () => void;

  /**
   * Toggles the Environments section expanded state.
   */
  toggleEnvironmentsSection: () => void;

  /**
   * Sets the Collections section expanded state explicitly.
   */
  setCollectionsSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Environments section expanded state explicitly.
   */
  setEnvironmentsSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Whether the Collections section is rendered in the sidebar.
   */
  collectionsSectionVisible: boolean;

  /**
   * Whether the Environments section is rendered in the sidebar.
   */
  environmentsSectionVisible: boolean;

  /**
   * Toggles the Collections section visibility.
   */
  toggleCollectionsSectionVisible: () => void;

  /**
   * Toggles the Environments section visibility.
   */
  toggleEnvironmentsSectionVisible: () => void;

  /**
   * Sets the Collections section visibility explicitly.
   */
  setCollectionsSectionVisible: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Environments section visibility explicitly.
   */
  setEnvironmentsSectionVisible: Dispatch<SetStateAction<boolean>>;

  /**
   * Whether storage location name badges appear next to collection names.
   */
  showStorageLocationBadges: boolean;

  /**
   * Toggles storage location badge visibility in the collections list.
   */
  toggleStorageLocationBadges: () => void;

  /**
   * Sets storage location badge visibility explicitly.
   */
  setShowStorageLocationBadges: Dispatch<SetStateAction<boolean>>;

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

  /**
   * Expands the Collections section and a collection tree for user navigation.
   */
  revealCollection: (collectionId: number) => void;

  /**
   * Expands the Collections section, parent collection, and folder for user navigation.
   */
  revealFolder: (collectionId: number, folderId: number) => void;
}

/**
 * Builds a snapshot for electron-store from in-memory expansion state.
 *
 * @param sections - Section expanded flags.
 * @param sectionVisibility - Section show/hide flags.
 * @param expandedCollectionIds - Expanded collection ids in memory.
 * @param expandedFolderIds - Expanded folder ids in memory.
 * @param showStorageLocationBadges - Whether storage location badges are shown.
 */
export function serializeSidebarExpansion(
  sections: SidebarExpansionState['sections'],
  sectionVisibility: SidebarExpansionState['sectionVisibility'],
  expandedCollectionIds: Set<number>,
  expandedFolderIds: Set<number>,
  showStorageLocationBadges: boolean
): SidebarExpansionState {
  return {
    sections,
    sectionVisibility,
    collectionIds: [...expandedCollectionIds],
    folderIds: [...expandedFolderIds],
    showStorageLocationBadges
  };
}

/**
 * Returns whether a persist write should run after hydration.
 *
 * @param loaded - Whether persisted state has been read from disk.
 * @param skipPersist - Whether the next persist cycle should be skipped.
 */
export function shouldPersistSidebarExpansion(loaded: boolean, skipPersist: boolean): boolean {
  return loaded && !skipPersist;
}

/**
 * Advances the post-hydration persist gate and reports whether a write should run.
 *
 * @param loaded - Whether persisted state has been read from disk.
 * @param skipPersistRef - Ref that skips the first persist cycle after hydration.
 */
export function advanceSidebarExpansionPersistGate(
  loaded: boolean,
  skipPersistRef: { current: boolean }
): boolean {
  if (!shouldPersistSidebarExpansion(loaded, skipPersistRef.current)) {
    if (loaded) {
      skipPersistRef.current = false;
    }
    return false;
  }

  return true;
}

/**
 * Loads and persists sidebar section, collection, and folder expansion via electron-store.
 */
export function usePersistedSidebarExpansion({
  onExpandCollection,
  validCollectionIds,
  collectionsListed
}: Options): Result {
  const defaults = defaultSidebarExpansion();
  const [loaded, setLoaded] = useState(false);
  const [collectionsSectionExpanded, setCollectionsSectionExpanded] = useState(
    defaults.sections.collections
  );
  const [environmentsSectionExpanded, setEnvironmentsSectionExpanded] = useState(
    defaults.sections.environments
  );
  const [collectionsSectionVisible, setCollectionsSectionVisible] = useState(
    defaults.sectionVisibility.collections
  );
  const [environmentsSectionVisible, setEnvironmentsSectionVisible] = useState(
    defaults.sectionVisibility.environments
  );
  const [showStorageLocationBadges, setShowStorageLocationBadges] = useState(
    defaults.showStorageLocationBadges
  );
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<Set<number>>(new Set());
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(new Set());
  const restoredRef = useRef(false);
  const skipPersistRef = useRef(true);

  /**
   * Restores persisted expansion after collections are listed so stale collection
   * ids are filtered before contents are loaded.
   */
  useEffect(() => {
    if (!collectionsListed || restoredRef.current) return;
    restoredRef.current = true;

    let cancelled = false;

    void window.api.getSidebarExpansion().then((stored) => {
      if (cancelled) return;

      const validExpanded = stored.collectionIds.filter((id) => validCollectionIds.has(id));
      setCollectionsSectionExpanded(stored.sections.collections);
      setEnvironmentsSectionExpanded(stored.sections.environments);
      setCollectionsSectionVisible(stored.sectionVisibility.collections);
      setEnvironmentsSectionVisible(stored.sectionVisibility.environments);
      setShowStorageLocationBadges(stored.showStorageLocationBadges);
      setExpandedCollectionIds(new Set(validExpanded));
      setExpandedFolderIds(new Set(stored.folderIds));
      setLoaded(true);

      for (const id of validExpanded) {
        onExpandCollection(id);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [collectionsListed, validCollectionIds, onExpandCollection]);

  /**
   * Persists expansion changes after the initial load completes.
   */
  useEffect(() => {
    if (!advanceSidebarExpansionPersistGate(loaded, skipPersistRef)) {
      return;
    }

    const snapshot = serializeSidebarExpansion(
      {
        collections: collectionsSectionExpanded,
        environments: environmentsSectionExpanded
      },
      {
        collections: collectionsSectionVisible,
        environments: environmentsSectionVisible
      },
      expandedCollectionIds,
      expandedFolderIds,
      showStorageLocationBadges
    );

    void window.api.setSidebarExpansion(snapshot);
  }, [
    loaded,
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    collectionsSectionVisible,
    environmentsSectionVisible,
    expandedCollectionIds,
    expandedFolderIds,
    showStorageLocationBadges
  ]);

  /**
   * Expands the Collections section and a collection tree for user navigation.
   */
  const revealCollection = useCallback(
    (collectionId: number) => {
      setCollectionsSectionVisible(true);
      setCollectionsSectionExpanded(true);
      setExpandedCollectionIds((prev) => {
        if (prev.has(collectionId)) return prev;
        const next = new Set(prev);
        next.add(collectionId);
        return next;
      });
      onExpandCollection(collectionId);
    },
    [onExpandCollection]
  );

  /**
   * Expands the Collections section, parent collection, and folder for user navigation.
   */
  const revealFolder = useCallback(
    (collectionId: number, folderId: number) => {
      setCollectionsSectionVisible(true);
      setCollectionsSectionExpanded(true);
      setExpandedCollectionIds((prev) => {
        if (prev.has(collectionId)) return prev;
        const next = new Set(prev);
        next.add(collectionId);
        return next;
      });
      setExpandedFolderIds((prev) => {
        if (prev.has(folderId)) return prev;
        const next = new Set(prev);
        next.add(folderId);
        return next;
      });
      onExpandCollection(collectionId);
      requestAnimationFrame(() => {
        const element = document.querySelector(`[data-sidebar-folder-id="${folderId}"]`);
        element?.scrollIntoView({ block: 'nearest' });
      });
    },
    [onExpandCollection]
  );

  /**
   * Toggles the Collections section expanded state.
   */
  const toggleCollectionsSection = useCallback(() => {
    setCollectionsSectionExpanded((open) => !open);
  }, []);

  /**
   * Toggles the Environments section expanded state.
   */
  const toggleEnvironmentsSection = useCallback(() => {
    setEnvironmentsSectionExpanded((open) => !open);
  }, []);

  /**
   * Toggles the Collections section visibility.
   */
  const toggleCollectionsSectionVisible = useCallback(() => {
    setCollectionsSectionVisible((visible) => !visible);
  }, []);

  /**
   * Toggles the Environments section visibility.
   */
  const toggleEnvironmentsSectionVisible = useCallback(() => {
    setEnvironmentsSectionVisible((visible) => !visible);
  }, []);

  /**
   * Toggles storage location badge visibility in the collections list.
   */
  const toggleStorageLocationBadges = useCallback(() => {
    setShowStorageLocationBadges((visible) => !visible);
  }, []);

  return {
    loaded,
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    toggleCollectionsSection,
    toggleEnvironmentsSection,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    collectionsSectionVisible,
    environmentsSectionVisible,
    toggleCollectionsSectionVisible,
    toggleEnvironmentsSectionVisible,
    setCollectionsSectionVisible,
    setEnvironmentsSectionVisible,
    showStorageLocationBadges,
    toggleStorageLocationBadges,
    setShowStorageLocationBadges,
    expandedCollectionIds,
    expandedFolderIds,
    setExpandedCollectionIds,
    setExpandedFolderIds,
    revealCollection,
    revealFolder
  };
}
