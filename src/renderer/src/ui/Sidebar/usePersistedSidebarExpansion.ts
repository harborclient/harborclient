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

/**
 * Builds a snapshot for electron-store from in-memory expansion state.
 *
 * @param sections - Section expanded flags.
 * @param expandedCollectionIds - Expanded collection ids in memory.
 * @param expandedFolderIds - Expanded folder ids in memory.
 */
function serializeSidebarExpansion(
  sections: SidebarExpansionState['sections'],
  expandedCollectionIds: Set<number>,
  expandedFolderIds: Set<number>
): SidebarExpansionState {
  return {
    sections,
    collectionIds: [...expandedCollectionIds],
    folderIds: [...expandedFolderIds]
  };
}

/**
 * Loads and persists sidebar section, collection, and folder expansion via electron-store.
 */
export function usePersistedSidebarExpansion({ onExpandCollection }: Options): Result {
  const defaults = defaultSidebarExpansion();
  const [loaded, setLoaded] = useState(false);
  const [collectionsSectionExpanded, setCollectionsSectionExpanded] = useState(
    defaults.sections.collections
  );
  const [environmentsSectionExpanded, setEnvironmentsSectionExpanded] = useState(
    defaults.sections.environments
  );
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<Set<number>>(new Set());
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(new Set());
  const hydratedRef = useRef(false);

  /**
   * Loads persisted expansion once on mount.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api.getSidebarExpansion().then((stored) => {
      if (cancelled) return;

      setCollectionsSectionExpanded(stored.sections.collections);
      setEnvironmentsSectionExpanded(stored.sections.environments);
      setExpandedCollectionIds(new Set(stored.collectionIds));
      setExpandedFolderIds(new Set(stored.folderIds));
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Loads collection contents once for restored expanded collections.
   */
  useEffect(() => {
    if (!loaded || hydratedRef.current) return;
    hydratedRef.current = true;

    for (const id of expandedCollectionIds) {
      onExpandCollection(id);
    }
  }, [loaded, expandedCollectionIds, onExpandCollection]);

  /**
   * Persists expansion changes after the initial load completes.
   */
  useEffect(() => {
    if (!loaded) return;

    const snapshot = serializeSidebarExpansion(
      {
        collections: collectionsSectionExpanded,
        environments: environmentsSectionExpanded
      },
      expandedCollectionIds,
      expandedFolderIds
    );

    void window.api.setSidebarExpansion(snapshot);
  }, [
    loaded,
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    expandedCollectionIds,
    expandedFolderIds
  ]);

  const toggleCollectionsSection = useCallback(() => {
    setCollectionsSectionExpanded((open) => !open);
  }, []);

  const toggleEnvironmentsSection = useCallback(() => {
    setEnvironmentsSectionExpanded((open) => !open);
  }, []);

  return {
    loaded,
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    toggleCollectionsSection,
    toggleEnvironmentsSection,
    expandedCollectionIds,
    expandedFolderIds,
    setExpandedCollectionIds,
    setExpandedFolderIds
  };
}
