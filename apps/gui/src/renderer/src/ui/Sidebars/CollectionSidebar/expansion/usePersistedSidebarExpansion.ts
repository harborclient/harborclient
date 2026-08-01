import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react';
import { defaultSidebarExpansion } from '@harborclient/core/sidebarExpansion';
import type {
  SidebarExpansionState,
  SidebarMode,
  SidebarSectionKey,
  SidebarSortMode
} from '@harborclient/core/types';
import { consumePrefetchedSidebarExpansion } from '#/renderer/src/store/sidebarExpansionPrefetch';
import { clearRegisteredSectionFilters } from '../filter/clearRegisteredSectionFilters';
import { scrollSidebarFolderRowIntoView } from '../navigation/sidebarListNavigation';
import { registerSidebarExpansionApplier } from './sidebarExpansionBridge';

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
   * Whether the Run Results section body is visible.
   */
  runResultsSectionExpanded: boolean;

  /**
   * Whether the History section body is visible.
   */
  historySectionExpanded: boolean;

  /**
   * Whether the Workspaces section body is visible.
   */
  workspacesSectionExpanded: boolean;

  /**
   * Whether the Workflows section body is visible.
   */
  workflowsSectionExpanded: boolean;

  /**
   * Whether the Websites section body is visible.
   */
  websitesSectionExpanded: boolean;

  /**
   * Whether the saved Live Servers section body is visible.
   */
  liveServersSectionExpanded: boolean;

  /**
   * Whether the Server Logs section body is visible.
   */
  liveServerLogsSectionExpanded: boolean;

  /**
   * Whether the Trash section body is visible.
   */
  trashSectionExpanded: boolean;

  /**
   * Whether the Archive section body is visible.
   */
  archiveSectionExpanded: boolean;

  /**
   * Toggles the Collections section expanded state.
   */
  toggleCollectionsSection: () => void;

  /**
   * Toggles the Environments section expanded state.
   */
  toggleEnvironmentsSection: () => void;

  /**
   * Toggles the Run Results section expanded state.
   */
  toggleRunResultsSection: () => void;

  /**
   * Toggles the History section expanded state.
   */
  toggleHistorySection: () => void;

  /**
   * Toggles the Workspaces section expanded state.
   */
  toggleWorkspacesSection: () => void;

  /**
   * Toggles the Workflows section expanded state.
   */
  toggleWorkflowsSection: () => void;

  /**
   * Toggles the Websites section expanded state.
   */
  toggleWebsitesSection: () => void;

  /**
   * Toggles the saved Live Servers section expanded state.
   */
  toggleLiveServersSection: () => void;

  /**
   * Toggles the Server Logs section expanded state.
   */
  toggleLiveServerLogsSection: () => void;

  /**
   * Toggles the Trash section expanded state.
   */
  toggleTrashSection: () => void;

  /**
   * Toggles the Archive section expanded state.
   */
  toggleArchiveSection: () => void;

  /**
   * Sets the Collections section expanded state explicitly.
   */
  setCollectionsSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Environments section expanded state explicitly.
   */
  setEnvironmentsSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Run Results section expanded state explicitly.
   */
  setRunResultsSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the History section expanded state explicitly.
   */
  setHistorySectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Workspaces section expanded state explicitly.
   */
  setWorkspacesSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Workflows section expanded state explicitly.
   */
  setWorkflowsSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Websites section expanded state explicitly.
   */
  setWebsitesSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the saved Live Servers section expanded state explicitly.
   */
  setLiveServersSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Server Logs section expanded state explicitly.
   */
  setLiveServerLogsSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Trash section expanded state explicitly.
   */
  setTrashSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets the Archive section expanded state explicitly.
   */
  setArchiveSectionExpanded: Dispatch<SetStateAction<boolean>>;

  /**
   * Active activity-rail mode that selects which section set is mounted.
   */
  activeSidebarMode: SidebarMode;

  /**
   * Sets the active activity-rail mode.
   */
  setActiveSidebarMode: Dispatch<SetStateAction<SidebarMode>>;

  /**
   * Whether the activity rail shows labels beside icons.
   */
  sidebarRailExpanded: boolean;

  /**
   * Sets whether the activity rail is expanded.
   */
  setSidebarRailExpanded: Dispatch<SetStateAction<boolean>>;

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
   * Whether user-assigned color marker dots appear beside sidebar row names.
   */
  showMarkers: boolean;

  /**
   * Toggles color marker dot visibility in the sidebar.
   */
  toggleMarkers: () => void;

  /**
   * Sets color marker dot visibility explicitly.
   */
  setShowMarkers: Dispatch<SetStateAction<boolean>>;

  /**
   * Whether HTTP method badges use per-method colors in the sidebar.
   */
  showMethodColors: boolean;

  /**
   * Toggles method color usage in the sidebar.
   */
  toggleMethodColors: () => void;

  /**
   * Sets method color usage explicitly.
   */
  setShowMethodColors: Dispatch<SetStateAction<boolean>>;

  /**
   * Whether HTTP/run status indicator dots appear on History and Runs rows.
   */
  showIndicators: boolean;

  /**
   * Toggles status indicator visibility in the sidebar.
   */
  toggleIndicators: () => void;

  /**
   * Sets status indicator visibility explicitly.
   */
  setShowIndicators: Dispatch<SetStateAction<boolean>>;

  /**
   * Whether section-header filter controls appear in the collections sidebar.
   */
  showFilters: boolean;

  /**
   * Toggles section-header filter control visibility. Turning off also clears
   * every applied section filter.
   */
  toggleFilters: () => void;

  /**
   * Sets section-header filter control visibility explicitly.
   */
  setShowFilters: Dispatch<SetStateAction<boolean>>;

  /**
   * Whether section-header sort controls appear in the collections sidebar.
   */
  showSorting: boolean;

  /**
   * Toggles section-header sort control visibility. Turning off also resets
   * every section sort mode to default.
   */
  toggleSorting: () => void;

  /**
   * Sets section-header sort control visibility explicitly.
   */
  setShowSorting: Dispatch<SetStateAction<boolean>>;

  /**
   * Per-section sort mode for the collections sidebar lists.
   */
  sectionSort: Record<SidebarSectionKey, SidebarSortMode>;

  /**
   * Updates the sort mode for one sidebar section.
   *
   * @param key - Built-in section key.
   * @param mode - Sort mode to apply.
   */
  setSectionSort: (key: SidebarSectionKey, mode: SidebarSortMode) => void;

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

  /**
   * Toggles whether an environment's children are visible in the sidebar tree.
   *
   * @param id - Environment database id.
   */
  toggleEnvironment: (id: number) => void;

  /**
   * Expands the Collections section and a collection tree for user navigation.
   */
  revealCollection: (collectionId: number) => void;

  /**
   * Expands the Archive section for navigating to an archived collection.
   */
  revealArchivedCollection: (collectionId: number) => void;

  /**
   * Expands the Collections section, parent collection, and folder for user navigation.
   */
  revealFolder: (collectionId: number, folderId: number) => void;
}

/**
 * Builds a snapshot for electron-store from in-memory expansion state.
 *
 * @param sections - Section expanded flags.
 * @param activeSidebarMode - Active activity-rail mode.
 * @param sidebarRailExpanded - Whether the rail shows labels.
 * @param sectionSort - Per-section sort modes.
 * @param expandedCollectionIds - Expanded collection ids in memory.
 * @param expandedFolderIds - Expanded folder ids in memory.
 * @param expandedEnvironmentIds - Expanded environment ids in memory.
 * @param showStorageLocationBadges - Whether storage location badges are shown.
 * @param showMarkers - Whether user-assigned color marker dots are shown.
 * @param showMethodColors - Whether HTTP method badges use per-method colors.
 * @param showIndicators - Whether HTTP/run status indicator dots are shown.
 * @param showFilters - Whether section-header filter controls are shown.
 * @param showSorting - Whether section-header sort controls are shown.
 */
export function serializeSidebarExpansion(
  sections: SidebarExpansionState['sections'],
  activeSidebarMode: SidebarMode,
  sidebarRailExpanded: boolean,
  sectionSort: SidebarExpansionState['sectionSort'],
  expandedCollectionIds: Set<number>,
  expandedFolderIds: Set<number>,
  expandedEnvironmentIds: Set<number>,
  showStorageLocationBadges: boolean,
  showMarkers: boolean,
  showMethodColors: boolean,
  showIndicators: boolean,
  showFilters: boolean,
  showSorting: boolean
): SidebarExpansionState {
  return {
    sections,
    activeSidebarMode,
    sidebarRailExpanded,
    sectionSort,
    collectionIds: [...expandedCollectionIds],
    folderIds: [...expandedFolderIds],
    environmentIds: [...expandedEnvironmentIds],
    showStorageLocationBadges,
    showMarkers,
    showMethodColors,
    showIndicators,
    showFilters,
    showSorting
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
  const [runResultsSectionExpanded, setRunResultsSectionExpanded] = useState(
    defaults.sections.runResults
  );
  const [historySectionExpanded, setHistorySectionExpanded] = useState(defaults.sections.history);
  const [workspacesSectionExpanded, setWorkspacesSectionExpanded] = useState(
    defaults.sections.workspaces
  );
  const [workflowsSectionExpanded, setWorkflowsSectionExpanded] = useState(
    defaults.sections.workflows
  );
  const [websitesSectionExpanded, setWebsitesSectionExpanded] = useState(
    defaults.sections.websites
  );
  const [liveServersSectionExpanded, setLiveServersSectionExpanded] = useState(
    defaults.sections.liveServers
  );
  const [liveServerLogsSectionExpanded, setLiveServerLogsSectionExpanded] = useState(
    defaults.sections.liveServerLogs
  );
  const [trashSectionExpanded, setTrashSectionExpanded] = useState(defaults.sections.trash);
  const [archiveSectionExpanded, setArchiveSectionExpanded] = useState(defaults.sections.archive);
  const [activeSidebarMode, setActiveSidebarMode] = useState<SidebarMode>(
    defaults.activeSidebarMode
  );
  const [sidebarRailExpanded, setSidebarRailExpanded] = useState(defaults.sidebarRailExpanded);
  const [showStorageLocationBadges, setShowStorageLocationBadges] = useState(
    defaults.showStorageLocationBadges
  );
  const [showMarkers, setShowMarkers] = useState(defaults.showMarkers);
  const [showMethodColors, setShowMethodColors] = useState(defaults.showMethodColors);
  const [showIndicators, setShowIndicators] = useState(defaults.showIndicators);
  const [showFilters, setShowFilters] = useState(defaults.showFilters);
  const [showSorting, setShowSorting] = useState(defaults.showSorting);
  const [sectionSort, setSectionSortState] = useState<Record<SidebarSectionKey, SidebarSortMode>>(
    defaults.sectionSort
  );
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<Set<number>>(new Set());
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(new Set());
  const [expandedEnvironmentIds, setExpandedEnvironmentIds] = useState<Set<number>>(new Set());
  const restoredRef = useRef(false);
  const skipPersistRef = useRef(true);
  const showFiltersRef = useRef(showFilters);

  /**
   * Keeps a ref of filter-control visibility for toggle handlers that clear
   * session filters when hiding.
   */
  useEffect(() => {
    showFiltersRef.current = showFilters;
  }, [showFilters]);

  /**
   * Applies a full sidebar expansion snapshot into local React state.
   *
   * Filters collection ids against the current registry and loads expanded
   * collection contents. Used for first hydration and workspace layout restore.
   *
   * @param stored - Expansion snapshot to apply.
   */
  const applyExpansionSnapshot = useCallback(
    (stored: SidebarExpansionState): void => {
      const validExpanded = stored.collectionIds.filter((id) => validCollectionIds.has(id));
      setCollectionsSectionExpanded(stored.sections.collections);
      setEnvironmentsSectionExpanded(stored.sections.environments);
      setRunResultsSectionExpanded(stored.sections.runResults);
      setHistorySectionExpanded(stored.sections.history);
      setWorkspacesSectionExpanded(stored.sections.workspaces);
      setWorkflowsSectionExpanded(stored.sections.workflows);
      setWebsitesSectionExpanded(stored.sections.websites);
      setLiveServersSectionExpanded(stored.sections.liveServers);
      setLiveServerLogsSectionExpanded(stored.sections.liveServerLogs);
      setTrashSectionExpanded(stored.sections.trash);
      setArchiveSectionExpanded(stored.sections.archive);
      setActiveSidebarMode(stored.activeSidebarMode);
      setSidebarRailExpanded(stored.sidebarRailExpanded);
      setShowStorageLocationBadges(stored.showStorageLocationBadges);
      setShowMarkers(stored.showMarkers);
      setShowMethodColors(stored.showMethodColors);
      setShowIndicators(stored.showIndicators);
      setShowFilters(stored.showFilters);
      setShowSorting(stored.showSorting);
      setSectionSortState(stored.sectionSort);
      setExpandedCollectionIds(new Set(validExpanded));
      setExpandedFolderIds(new Set(stored.folderIds));
      setExpandedEnvironmentIds(new Set(stored.environmentIds));

      for (const id of validExpanded) {
        onExpandCollection(id);
      }
    },
    [onExpandCollection, validCollectionIds]
  );

  /**
   * Restores persisted expansion after collections are listed so stale collection
   * ids are filtered before contents are loaded. Prefers a snapshot prefetched
   * during shell bootstrap to avoid a second IPC round-trip and post-reveal jump.
   */
  useEffect(() => {
    if (!collectionsListed || restoredRef.current) return;
    restoredRef.current = true;

    let cancelled = false;

    const prefetched = consumePrefetchedSidebarExpansion();
    if (prefetched != null) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        applyExpansionSnapshot(prefetched);
        setLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    }

    void window.api.getSidebarExpansion().then((stored) => {
      if (cancelled) return;

      applyExpansionSnapshot(stored);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [applyExpansionSnapshot, collectionsListed]);

  /**
   * Registers a workspace-restore applier that pushes layout into this hook's state.
   */
  useEffect(() => {
    return registerSidebarExpansionApplier((stored) => {
      applyExpansionSnapshot(stored);
    });
  }, [applyExpansionSnapshot]);

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
        environments: environmentsSectionExpanded,
        runResults: runResultsSectionExpanded,
        history: historySectionExpanded,
        workspaces: workspacesSectionExpanded,
        workflows: workflowsSectionExpanded,
        websites: websitesSectionExpanded,
        liveServers: liveServersSectionExpanded,
        liveServerLogs: liveServerLogsSectionExpanded,
        archive: archiveSectionExpanded,
        trash: trashSectionExpanded
      },
      activeSidebarMode,
      sidebarRailExpanded,
      sectionSort,
      expandedCollectionIds,
      expandedFolderIds,
      expandedEnvironmentIds,
      showStorageLocationBadges,
      showMarkers,
      showMethodColors,
      showIndicators,
      showFilters,
      showSorting
    );

    void window.api.setSidebarExpansion(snapshot);
  }, [
    loaded,
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    runResultsSectionExpanded,
    historySectionExpanded,
    workspacesSectionExpanded,
    workflowsSectionExpanded,
    websitesSectionExpanded,
    liveServersSectionExpanded,
    liveServerLogsSectionExpanded,
    archiveSectionExpanded,
    trashSectionExpanded,
    activeSidebarMode,
    sidebarRailExpanded,
    sectionSort,
    expandedCollectionIds,
    expandedFolderIds,
    expandedEnvironmentIds,
    showStorageLocationBadges,
    showMarkers,
    showMethodColors,
    showIndicators,
    showFilters,
    showSorting
  ]);

  /**
   * Expands the Collections section and a collection tree for user navigation.
   */
  const revealCollection = useCallback(
    (collectionId: number) => {
      setActiveSidebarMode('collections');
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
   * Shows and expands the Archive section for an archived collection hit.
   *
   * @param collectionId - Archived collection to reveal in the Archive list.
   */
  const revealArchivedCollection = useCallback((collectionId: number) => {
    setActiveSidebarMode('collections');
    setArchiveSectionExpanded(true);
    setExpandedCollectionIds((prev) => {
      if (prev.has(collectionId)) return prev;
      const next = new Set(prev);
      next.add(collectionId);
      return next;
    });
    requestAnimationFrame(() => {
      const row = document.querySelector(`[data-sidebar-archive-id="${collectionId}"]`);
      row?.scrollIntoView({ block: 'nearest' });
    });
  }, []);

  /**
   * Expands the Collections section, parent collection, and folder for user navigation.
   */
  const revealFolder = useCallback(
    (collectionId: number, folderId: number) => {
      setActiveSidebarMode('collections');
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
      scrollSidebarFolderRowIntoView(folderId);
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
   * Toggles the Run Results section expanded state.
   */
  const toggleRunResultsSection = useCallback(() => {
    setRunResultsSectionExpanded((open) => !open);
  }, []);

  /**
   * Toggles the History section expanded state.
   */
  const toggleHistorySection = useCallback(() => {
    setHistorySectionExpanded((open) => !open);
  }, []);

  /**
   * Toggles the Workspaces section expanded state.
   */
  const toggleWorkspacesSection = useCallback(() => {
    setWorkspacesSectionExpanded((open) => !open);
  }, []);

  /**
   * Toggles the Workflows section expanded state.
   */
  const toggleWorkflowsSection = useCallback(() => {
    setWorkflowsSectionExpanded((open) => !open);
  }, []);

  /**
   * Toggles the Websites section expanded state.
   */
  const toggleWebsitesSection = useCallback(() => {
    setWebsitesSectionExpanded((open) => !open);
  }, []);

  /**
   * Toggles the saved Live Servers section expanded state.
   */
  const toggleLiveServersSection = useCallback(() => {
    setLiveServersSectionExpanded((open) => !open);
  }, []);

  /**
   * Toggles the Server Logs section expanded state.
   */
  const toggleLiveServerLogsSection = useCallback(() => {
    setLiveServerLogsSectionExpanded((open) => !open);
  }, []);

  /**
   * Toggles the Trash section expanded state.
   */
  const toggleTrashSection = useCallback(() => {
    setTrashSectionExpanded((open) => !open);
  }, []);

  /**
   * Toggles the Archive section expanded state.
   */
  const toggleArchiveSection = useCallback(() => {
    setArchiveSectionExpanded((open) => !open);
  }, []);

  /**
   * Toggles storage location badge visibility in the collections list.
   */
  const toggleStorageLocationBadges = useCallback(() => {
    setShowStorageLocationBadges((visible) => !visible);
  }, []);

  /**
   * Toggles color marker dot visibility in the sidebar.
   */
  const toggleMarkers = useCallback(() => {
    setShowMarkers((visible) => !visible);
  }, []);

  /**
   * Toggles method color usage in the sidebar.
   */
  const toggleMethodColors = useCallback(() => {
    setShowMethodColors((visible) => !visible);
  }, []);

  /**
   * Toggles status indicator visibility in the sidebar.
   */
  const toggleIndicators = useCallback(() => {
    setShowIndicators((visible) => !visible);
  }, []);

  /**
   * Toggles section-header filter control visibility. Turning off clears every
   * session section filter so lists are not left filtered without UI.
   */
  const toggleFilters = useCallback(() => {
    if (showFiltersRef.current) {
      clearRegisteredSectionFilters();
    }
    setShowFilters((visible) => !visible);
  }, []);

  /**
   * Toggles section-header sort control visibility. Turning off resets every
   * section sort mode to default so lists are no longer sorted without UI.
   */
  const toggleSorting = useCallback(() => {
    setShowSorting((visible) => {
      const next = !visible;
      if (!next) {
        setSectionSortState({ ...defaultSidebarExpansion().sectionSort });
      }
      return next;
    });
  }, []);

  /**
   * Updates the sort mode for one sidebar section.
   *
   * @param key - Built-in section key.
   * @param mode - Sort mode to apply.
   */
  const setSectionSort = useCallback((key: SidebarSectionKey, mode: SidebarSortMode): void => {
    setSectionSortState((prev) => {
      if (prev[key] === mode) {
        return prev;
      }
      return { ...prev, [key]: mode };
    });
  }, []);

  /**
   * Toggles whether an environment's children are visible in the sidebar tree.
   *
   * @param id - Environment database id.
   */
  const toggleEnvironment = useCallback((id: number): void => {
    setExpandedEnvironmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return {
    loaded,
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    runResultsSectionExpanded,
    historySectionExpanded,
    workspacesSectionExpanded,
    workflowsSectionExpanded,
    websitesSectionExpanded,
    liveServersSectionExpanded,
    liveServerLogsSectionExpanded,
    trashSectionExpanded,
    archiveSectionExpanded,
    toggleCollectionsSection,
    toggleEnvironmentsSection,
    toggleRunResultsSection,
    toggleHistorySection,
    toggleWorkspacesSection,
    toggleWorkflowsSection,
    toggleWebsitesSection,
    toggleLiveServersSection,
    toggleLiveServerLogsSection,
    toggleTrashSection,
    toggleArchiveSection,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    setRunResultsSectionExpanded,
    setHistorySectionExpanded,
    setWorkspacesSectionExpanded,
    setWorkflowsSectionExpanded,
    setWebsitesSectionExpanded,
    setLiveServersSectionExpanded,
    setLiveServerLogsSectionExpanded,
    setTrashSectionExpanded,
    setArchiveSectionExpanded,
    activeSidebarMode,
    setActiveSidebarMode,
    sidebarRailExpanded,
    setSidebarRailExpanded,
    showStorageLocationBadges,
    toggleStorageLocationBadges,
    setShowStorageLocationBadges,
    showMarkers,
    toggleMarkers,
    setShowMarkers,
    showMethodColors,
    toggleMethodColors,
    setShowMethodColors,
    showIndicators,
    toggleIndicators,
    setShowIndicators,
    showFilters,
    toggleFilters,
    setShowFilters,
    showSorting,
    toggleSorting,
    setShowSorting,
    sectionSort,
    setSectionSort,
    expandedCollectionIds,
    expandedFolderIds,
    expandedEnvironmentIds,
    setExpandedCollectionIds,
    setExpandedFolderIds,
    setExpandedEnvironmentIds,
    toggleEnvironment,
    revealCollection,
    revealArchivedCollection,
    revealFolder
  };
}
