import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useCallback, useEffect, useMemo, useState, type JSX, type MouseEvent } from 'react';
import { toContainerItemRefs } from '@harborclient/core/collectionContainerOrder';
import {
  getFolderAncestors,
  getFolderDescendants,
  wouldCreateFolderCycle,
  type FolderTreeNode
} from '@harborclient/core/folderTree';
import type {
  Collection,
  CollectionDocument,
  Folder,
  SavedRequest
} from '@harborclient/core/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveCollections,
  selectActiveDocumentId,
  selectDocumentsByCollection,
  selectDraft,
  selectFoldersByCollection,
  selectOpenDocumentIds,
  selectOpenRequestIds,
  selectRequestsByCollection,
  selectSelectedCollectionId,
  selectSelectedFolderId
} from '#/renderer/src/store/selectors';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { useSidebarProviders } from '#/renderer/src/ui/Sidebars/CollectionSidebar/providers/sidebarProvidersContext';
import { useSidebarGit } from '#/renderer/src/ui/Sidebars/CollectionSidebar/git/sidebarGitContext';
import { countUntrackedCollectionItems } from '#/renderer/src/ui/Sidebars/CollectionSidebar/git/countUntrackedCollectionItems';
import { useSidebarSearchContext } from '#/renderer/src/ui/Sidebars/CollectionSidebar/search/sidebarSearchContext';
import { useCollectionActions } from '#/renderer/src/ui/Sidebars/CollectionSidebar/actions/useCollectionActions';
import { closeSidebarContentTabs } from '#/renderer/src/store/thunks/sidebarDeselect';
import {
  EmptySectionLabel,
  FaIcon,
  SIDEBAR_CHEVRON_BUTTON_CLASS,
  SIDEBAR_CHEVRON_ICON_CLASS,
  SIDEBAR_CHEVRON_LABEL_OFFSET_CLASS,
  SidebarBadge,
  SidebarFolderItem,
  SidebarTree,
  SidebarTreeGroup
} from '@harborclient/sdk/components';
import { SidebarMarkerDot } from '#/renderer/src/ui/Sidebars/CollectionSidebar/markers/SidebarMarkerDot';
import { buildCopyIdMenuItem } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/copyEntityId';
import { SidebarRowActionsMenu } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/SidebarRowActionsMenu';
import { buildReorderMenuGroup } from '@harborclient/sdk/components';
import { usePluginContextMenuItems } from '#/renderer/src/plugins/pluginHooks';
import { buildPluginContextMenuGroups } from '#/renderer/src/plugins/pluginContextMenuHelpers';
import { useCopyToChat } from '#/renderer/src/hooks/useCopyToChat';
import { faChevronDown, faChevronRight } from '#/renderer/src/fontawesome';
import { methodBadgeClass, sourceRow } from '#/renderer/src/ui/Shared/classes';
import { AnimatedCollapse } from '#/renderer/src/ui/Shared/Animated/AnimatedCollapse';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/Shared/devInspectContextMenu';
import { ActionsMenu } from './ActionsMenu';
import { DropZone } from './DropZone';
import { focusCollectionSettings } from '#/renderer/src/ui/Tabs/CollectionSettings/focusCollectionSettings';
import { focusFolderSettings } from '#/renderer/src/ui/Tabs/FolderSettings/focusFolderSettings';
import { DocumentRow } from './DocumentRow';
import { RequestRow } from './RequestRow';
import { SortableRow } from './SortableRow';
import { stopSortableDragPointerDown } from './SortableRow/sortableRowUtils';
import {
  collectionHasDeselectableSelection,
  removeCollectionRequestSelection
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/selection/collectionSidebarSelection';
import { useSidebarSelectionCoordinator } from '#/renderer/src/ui/Sidebars/CollectionSidebar/selection/sidebarSelectionContext';
import {
  applySidebarSelectionClick,
  orderSelectedIds
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/selection/sidebarSelectionUtils';
import {
  mergeContainerItems,
  collectionCollisionDetectionWithDragKind,
  collectionDragId,
  containerItemDragId,
  dropFolderId,
  dropRootId,
  dropTargetHighlightClass,
  findUnifiedIndex,
  folderDragId,
  parseCollectionDragId,
  parseDragId,
  parseDropTarget,
  resolveRequestDropTarget,
  setCollectionSidebarDragKind,
  sortContainerDocuments,
  type ContainerItem,
  type ContainerItemRef,
  type DragKind
} from './utils';
import { useSidebarSectionFilter } from '../filter/sidebarSectionFilterContext';
import { buildCollectionsTreeFilter, isCollectionsFilterActive } from './collectionsFilter';
import { sortSidebarItems, toSortTimestamp } from '../sort/sidebarSort';
import { buildCollectionTree } from './buildCollectionTree';

export { CollectionsHeaderActions } from './CollectionsHeaderActions';

/**
 * Collections list with expandable folders and drag-and-drop organization.
 *
 * Sources its data from the store, expansion state from the sidebar expansion
 * context, provider/git metadata from their contexts, and its actions from
 * {@link useCollectionActions}, so the sidebar shell no longer threads dozens
 * of props through this component.
 */
export function Collections(): JSX.Element {
  const dispatch = useAppDispatch();
  const collections = useAppSelector(selectActiveCollections);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const documentsByCollection = useAppSelector(selectDocumentsByCollection);
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const selectedFolderId = useAppSelector(selectSelectedFolderId);
  const draft = useAppSelector(selectDraft);
  const activeRequestId = draft.id;
  const activeDocumentId = useAppSelector(selectActiveDocumentId);
  const openRequestIds = useAppSelector(selectOpenRequestIds);
  const openDocumentIds = useAppSelector(selectOpenDocumentIds);
  const {
    expandedCollectionIds,
    expandedFolderIds,
    setExpandedCollectionIds,
    setExpandedFolderIds,
    showStorageLocationBadges,
    showMarkers,
    showMethodColors,
    sectionSort
  } = useSidebarExpansion();
  const { primaryConnectionId, connectionNamesById, connectionTypesById } = useSidebarProviders();
  const {
    gitStatusesByConnectionId,
    itemGitStatusByUuid,
    changedItemCountByCollectionUuid,
    stageItem: onGitStageItem,
    unstageItem: onGitUnstageItem,
    openSourceControl: onOpenSourceControl,
    openSwitchBranch: onOpenSwitchBranch
  } = useSidebarGit();
  const { searchFilter, searchActive, archivedSearchFilter } = useSidebarSearchContext();
  const { collectionsFilter } = useSidebarSectionFilter();
  const {
    onExpandCollection,
    onSelectCollection,
    onClearCollectionSelection,
    onSelectFolder,
    onConfigureCollection,
    onConfigureFolder,
    onRunFolder,
    onRunRequest,
    onSaveAllInFolder,
    onImportRequest,
    onNewRequestInFolder,
    onNewDocumentInFolder,
    onNewFolder,
    onRenameFolder,
    onDeleteFolder,
    onReorderCollections,
    onReorderFolders,
    onMoveFolder,
    onMoveRequest,
    onLoadRequest,
    onLoadDocument,
    onRenameDocument,
    onDeleteDocument,
    onReorderContainerItems,
    onDeleteRequest,
    onDuplicateRequest,
    onExportRequest,
    onOpenSelectedRequests,
    onCreateWorkspaceFromSelection,
    onDeleteSelectedRequests,
    onRunSelectedRequests
  } = useCollectionActions();
  const { aiAvailable, copyToChat } = useCopyToChat();
  const pluginContextMenuItems = usePluginContextMenuItems();
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const sidebarSelectionCoordinator = useSidebarSelectionCoordinator();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<number>>(() => new Set());
  const [selectionAnchorId, setSelectionAnchorId] = useState<number | null>(null);
  const [inspectPointsByMenuId, setInspectPointsByMenuId] = useState<Record<string, InspectPoint>>(
    {}
  );
  const [activeDragKind, setActiveDragKind] = useState<DragKind | null>(null);
  const [activeDragRequest, setActiveDragRequest] = useState<SavedRequest | null>(null);
  const [activeDragFolder, setActiveDragFolder] = useState<Folder | null>(null);
  const [activeDragCollection, setActiveDragCollection] = useState<Collection | null>(null);
  const [dragCollectionId, setDragCollectionId] = useState<number | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<number | null | undefined>(
    undefined
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /**
   * Clears drag state for collection item dragging.
   */
  const clearDragState = (): void => {
    setCollectionSidebarDragKind(null);
    setActiveDragKind(null);
    setActiveDragRequest(null);
    setActiveDragFolder(null);
    setDragCollectionId(null);
    setDropTargetFolderId(undefined);
  };

  /**
   * Clears drag state for collection-row reordering at the sidebar root.
   */
  const clearCollectionDragState = (): void => {
    setActiveDragCollection(null);
  };

  /**
   * Loads collection contents when the selected collection changes.
   */
  useEffect(() => {
    if (selectedCollectionId == null) return;
    onExpandCollection(selectedCollectionId);
  }, [selectedCollectionId, onExpandCollection]);

  /**
   * Expands every ancestor when navigation selects an item in a nested folder,
   * ensuring the selected row is visible after collection contents load.
   */
  useEffect(() => {
    if (selectedCollectionId == null || selectedFolderId == null) {
      return;
    }
    const folders = foldersByCollection[selectedCollectionId] ?? [];
    const ancestorIds = getFolderAncestors(selectedFolderId, folders).map((folder) => folder.id);
    if (ancestorIds.length === 0) {
      return;
    }
    setExpandedFolderIds((previous) => {
      if (ancestorIds.every((id) => previous.has(id))) {
        return previous;
      }
      return new Set([...previous, ...ancestorIds]);
    });
  }, [foldersByCollection, selectedCollectionId, selectedFolderId, setExpandedFolderIds]);

  /**
   * Toggles the expansion state of a collection.
   *
   * @param collectionId The collection id to toggle.
   */
  const toggleCollection = (collectionId: number): void => {
    const willExpand = !expandedCollectionIds.has(collectionId);
    setExpandedCollectionIds((prev) => {
      const next = new Set(prev);
      if (willExpand) next.add(collectionId);
      else next.delete(collectionId);
      return next;
    });
    if (willExpand) onExpandCollection(collectionId);
  };

  /**
   * Toggles the expansion state of a folder.
   *
   * @param folderId The folder id to toggle.
   */
  const toggleFolder = (folderId: number): void => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  /**
   * Selects a collection row and expands it on first click, or collapses it when
   * the row was already expanded (reveal helpers are expand-only).
   *
   * @param collectionId - Collection id for the clicked row.
   * @param wasExpanded - Whether the collection tree was expanded before selection.
   */
  const handleCollectionNameClick = (collectionId: number, wasExpanded: boolean): void => {
    clearRequestSelection();
    onSelectCollection(collectionId);
    if (wasExpanded) {
      toggleCollection(collectionId);
    }
  };

  /**
   * Selects a folder row and expands it on first click, or collapses it when the
   * folder was already expanded (reveal helpers are expand-only).
   *
   * @param collectionId - Parent collection id.
   * @param folderId - Folder id for the clicked row.
   * @param wasExpanded - Whether the folder tree was expanded before selection.
   */
  const handleFolderNameClick = (
    collectionId: number,
    folderId: number,
    wasExpanded: boolean
  ): void => {
    clearRequestSelection();
    onSelectFolder(collectionId, folderId);
    if (wasExpanded) {
      toggleFolder(folderId);
    }
  };

  /**
   * Visibility sets for the Collections section filter form, or null when inactive.
   */
  const treeFilter = useMemo(
    () =>
      buildCollectionsTreeFilter(
        {
          collections,
          foldersByCollection,
          requestsByCollection,
          documentsByCollection,
          primaryConnectionId
        },
        collectionsFilter
      ),
    [
      collections,
      collectionsFilter,
      documentsByCollection,
      foldersByCollection,
      primaryConnectionId,
      requestsByCollection
    ]
  );

  const collectionsFilterActive = isCollectionsFilterActive(collectionsFilter);
  const treeFilterActive = searchActive || collectionsFilterActive;
  const sortMode = sectionSort.collections;
  const sortActive = sortMode !== 'default';
  /** Disables drag reorder while search, filter, or a custom sort is active. */
  const reorderDisabled = treeFilterActive || sortActive;

  /**
   * Gets sortable sidebar items (requests only) for a collection root or folder container.
   *
   * @param collectionId The collection id to read items from.
   * @param folderId The folder id, or null for collection root.
   */
  const getContainerItems = useCallback(
    (collectionId: number, folderId: number | null): ContainerItem[] => {
      const requests = requestsByCollection[collectionId] ?? [];
      let items = mergeContainerItems(requests, [], folderId);

      if (searchFilter != null) {
        items = items.filter((item) => searchFilter.requestIds.has(item.id));
      }
      if (treeFilter != null) {
        items = items.filter((item) => treeFilter.requestIds.has(item.id));
      }

      return sortSidebarItems(items, sortMode, {
        name: (item) => item.name,
        createdAt: (item) => {
          const request = requests.find((entry) => entry.id === item.id);
          return toSortTimestamp(request?.created_at);
        },
        marker: (item) => requests.find((entry) => entry.id === item.id)?.marker,
        method: (item) => requests.find((entry) => entry.id === item.id)?.method
      });
    },
    [requestsByCollection, searchFilter, sortMode, treeFilter]
  );

  /**
   * Gets markdown documents for a collection root or folder, sorted by the
   * Collections section sort mode (falls back to alphabetical for default).
   * Documents are always shown during text search; the collections section filter may hide them.
   *
   * @param collectionId The collection id to read documents from.
   * @param folderId The folder id, or null for collection root.
   */
  const getContainerDocuments = useCallback(
    (collectionId: number, folderId: number | null): CollectionDocument[] => {
      const documents = documentsByCollection[collectionId] ?? [];
      const inContainer = documents.filter((document) => {
        if ((document.folder_id ?? null) !== folderId) {
          return false;
        }
        if (treeFilter != null && !treeFilter.documentIds.has(document.id)) {
          return false;
        }
        return true;
      });
      if (sortMode === 'default') {
        return sortContainerDocuments(inContainer);
      }
      return sortSidebarItems(inContainer, sortMode, {
        name: (document) => document.name,
        createdAt: (document) => toSortTimestamp(document.created_at),
        marker: (document) => document.marker
      });
    },
    [documentsByCollection, sortMode, treeFilter]
  );

  /**
   * Moves a collection one position up or down in the sidebar list.
   *
   * @param collectionId The collection to move.
   * @param direction Whether to move toward the top or bottom of the list.
   */
  const moveCollection = async (collectionId: number, direction: 'up' | 'down'): Promise<void> => {
    const ids = collections.map((collection) => collection.id);
    const index = ids.findIndex((id) => id === collectionId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ids.length) return;
    await onReorderCollections(arrayMove(ids, index, targetIndex));
  };

  /**
   * Moves a folder one position up or down within its collection.
   *
   * @param collectionId The owning collection id.
   * @param folderId The folder to move.
   * @param direction Whether to move toward the top or bottom of the list.
   */
  const moveFolder = async (
    collectionId: number,
    folderId: number,
    direction: 'up' | 'down'
  ): Promise<void> => {
    const folders = foldersByCollection[collectionId] ?? [];
    const movingFolder = folders.find((folder) => folder.id === folderId);
    if (!movingFolder) return;
    const parentFolderId = movingFolder.parent_folder_id ?? null;
    const siblings = folders.filter(
      (folder) => (folder.parent_folder_id ?? null) === parentFolderId
    );
    const ids = siblings.map((folder) => folder.id);
    const index = ids.findIndex((id) => id === folderId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ids.length) return;
    await onReorderFolders(collectionId, parentFolderId, arrayMove(ids, index, targetIndex));
  };

  /**
   * Moves a request one position up or down within its container.
   *
   * @param collectionId The owning collection id.
   * @param folderId The item's folder id, or null for collection root.
   * @param item The container item to move.
   * @param direction Whether to move toward the top or bottom of the list.
   */
  const moveContainerItemInList = async (
    collectionId: number,
    folderId: number | null,
    item: ContainerItemRef,
    direction: 'up' | 'down'
  ): Promise<void> => {
    const refs = toContainerItemRefs(getContainerItems(collectionId, folderId));
    const index = refs.findIndex((entry) => entry.kind === item.kind && entry.id === item.id);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= refs.length) return;
    await onReorderContainerItems(collectionId, folderId, arrayMove(refs, index, targetIndex));
  };

  /**
   * Clears the current request multi-selection.
   */
  const clearRequestSelection = useCallback((): void => {
    setSelectedRequestIds(new Set());
    setSelectionAnchorId(null);
  }, []);

  /**
   * Registers request multi-selection with the sidebar selection coordinator.
   */
  useEffect(() => {
    if (sidebarSelectionCoordinator == null) {
      return;
    }
    return sidebarSelectionCoordinator.registerClearHandler(
      'collections-requests',
      clearRequestSelection
    );
  }, [clearRequestSelection, sidebarSelectionCoordinator]);

  /**
   * Reports request multi-selection count to the sidebar selection coordinator.
   */
  useEffect(() => {
    if (sidebarSelectionCoordinator == null) {
      return;
    }
    sidebarSelectionCoordinator.reportSelectionCount(
      'collections-requests',
      selectedRequestIds.size
    );
  }, [selectedRequestIds.size, sidebarSelectionCoordinator]);

  /**
   * Clears folder/request selection scoped to one collection and deselects the
   * collection row when it is currently highlighted.
   *
   * @param collectionId - Collection whose child selections should be cleared.
   */
  const handleDeselectAllInCollection = (collectionId: number): void => {
    const nextSelection = removeCollectionRequestSelection(
      collectionId,
      selectedRequestIds,
      selectionAnchorId,
      requestsByCollection
    );
    setSelectedRequestIds(nextSelection.selectedRequestIds);
    setSelectionAnchorId(nextSelection.selectionAnchorId);

    if (selectedCollectionId === collectionId) {
      onClearCollectionSelection();
    }

    void dispatch(closeSidebarContentTabs({ collectionId }));
  };

  /**
   * Precomputes per-collection folder and root item groupings for rendering.
   * Applies sidebar text search, the Collections section filter, and section sort.
   */
  const collectionTrees = useMemo(() => {
    const trees = collections.map((collection) => {
      const folders = foldersByCollection[collection.id] ?? [];
      const requests = requestsByCollection[collection.id] ?? [];
      const rootItems = mergeContainerItems(requests, [], null).filter((item) => {
        if (searchFilter != null && !searchFilter.requestIds.has(item.id)) {
          return false;
        }
        if (treeFilter != null && !treeFilter.requestIds.has(item.id)) {
          return false;
        }
        return true;
      });
      const rootDocuments = (documentsByCollection[collection.id] ?? []).filter((document) => {
        if ((document.folder_id ?? null) !== null) {
          return false;
        }
        if (treeFilter != null && !treeFilter.documentIds.has(document.id)) {
          return false;
        }
        return true;
      });
      const visibleFolders = folders.filter((folder) => {
        if (searchFilter != null && !searchFilter.folderIds.has(folder.id)) {
          return false;
        }
        if (treeFilter != null && !treeFilter.folderIds.has(folder.id)) {
          return false;
        }
        return true;
      });
      const sortedFolders = sortSidebarItems(visibleFolders, sortMode, {
        name: (folder) => folder.name,
        createdAt: (folder) => toSortTimestamp(folder.created_at),
        marker: (folder) => folder.marker
      });
      const folderOrder = new Map(sortedFolders.map((folder, index) => [folder.id, index]));

      return {
        collection,
        folders: visibleFolders,
        folderTree: buildCollectionTree(
          visibleFolders,
          sortMode === 'default'
            ? undefined
            : (left, right) => (folderOrder.get(left.id) ?? 0) - (folderOrder.get(right.id) ?? 0)
        ),
        rootItems: sortSidebarItems(rootItems, sortMode, {
          name: (item) => item.name,
          createdAt: (item) => {
            const request = requests.find((entry) => entry.id === item.id);
            return toSortTimestamp(request?.created_at);
          },
          marker: (item) => requests.find((entry) => entry.id === item.id)?.marker,
          method: (item) => requests.find((entry) => entry.id === item.id)?.method
        }),
        rootDocuments:
          sortMode === 'default'
            ? sortContainerDocuments(rootDocuments)
            : sortSidebarItems(rootDocuments, sortMode, {
                name: (document) => document.name,
                createdAt: (document) => toSortTimestamp(document.created_at),
                marker: (document) => document.marker
              })
      };
    });

    const filtered = trees.filter(({ collection }) => {
      if (searchFilter != null && !searchFilter.collectionIds.has(collection.id)) {
        return false;
      }
      if (treeFilter != null && !treeFilter.collectionIds.has(collection.id)) {
        return false;
      }
      return true;
    });

    return sortSidebarItems(filtered, sortMode, {
      name: ({ collection }) => collection.name,
      createdAt: ({ collection }) => toSortTimestamp(collection.created_at),
      marker: ({ collection }) => collection.marker
    });
  }, [
    collections,
    foldersByCollection,
    requestsByCollection,
    documentsByCollection,
    searchFilter,
    sortMode,
    treeFilter
  ]);

  /**
   * Request ids in on-screen sidebar order for shift-click range selection.
   */
  const visibleRequestOrder = useMemo(() => {
    const ids: number[] = [];

    for (const { collection, folderTree, rootItems } of collectionTrees) {
      const expanded = treeFilterActive ? true : expandedCollectionIds.has(collection.id);
      if (!expanded) {
        continue;
      }

      for (const item of rootItems) {
        ids.push(item.id);
      }

      /**
       * Adds visible requests from expanded folders in depth-first tree order.
       *
       * @param nodes - Sibling folder nodes at the current level.
       */
      const appendVisibleFolderRequests = (nodes: readonly FolderTreeNode[]): void => {
        for (const node of nodes) {
          const folderExpanded = treeFilterActive ? true : expandedFolderIds.has(node.folder.id);
          if (!folderExpanded) {
            continue;
          }
          for (const item of getContainerItems(collection.id, node.folder.id)) {
            ids.push(item.id);
          }
          appendVisibleFolderRequests(node.children);
        }
      };
      appendVisibleFolderRequests(folderTree);
    }

    return ids;
  }, [
    collectionTrees,
    expandedCollectionIds,
    expandedFolderIds,
    getContainerItems,
    treeFilterActive
  ]);

  /**
   * Selected requests resolved from the store in visible sidebar order.
   */
  const selectedRequestsOrdered = useMemo(() => {
    const orderedIds = orderSelectedIds(selectedRequestIds, visibleRequestOrder);
    const byId = new Map<number, SavedRequest>();
    for (const requests of Object.values(requestsByCollection)) {
      for (const request of requests) {
        byId.set(request.id, request);
      }
    }
    return orderedIds
      .map((id) => byId.get(id))
      .filter((request): request is SavedRequest => request != null);
  }, [selectedRequestIds, visibleRequestOrder, requestsByCollection]);

  /**
   * Handles primary and modifier clicks on a saved request row.
   */
  const handleRequestRowClick = (req: SavedRequest, event: MouseEvent<HTMLElement>): void => {
    const result = applySidebarSelectionClick(
      selectedRequestIds,
      selectionAnchorId,
      visibleRequestOrder,
      req.id,
      {
        shiftKey: event.shiftKey,
        ctrlOrMetaKey: event.ctrlKey || event.metaKey
      }
    );

    setSelectedRequestIds(result.selectedIds);
    setSelectionAnchorId(result.anchorId);

    if (result.shouldOpen) {
      onLoadRequest(req);
    }
  };

  /**
   * Ensures the context menu targets the clicked row when it is not already selected.
   */
  const handleRequestBeforeContextMenu = (req: SavedRequest): void => {
    if (selectedRequestIds.has(req.id)) {
      return;
    }
    setSelectedRequestIds(new Set([req.id]));
    setSelectionAnchorId(req.id);
  };

  /**
   * Stable sortable ids for top-level collection rows.
   */
  const collectionIds = useMemo(
    () => collectionTrees.map(({ collection }) => collectionDragId(collection.id)),
    [collectionTrees]
  );

  /**
   * Handles the start of a collection drag-and-drop operation.
   *
   * @param event The drag start event.
   */
  const handleCollectionDragStart = (event: DragStartEvent): void => {
    const collectionId = parseCollectionDragId(String(event.active.id));
    if (collectionId == null) return;
    const collection = collections.find((item) => item.id === collectionId) ?? null;
    setActiveDragCollection(collection);
  };

  /**
   * Handles the end of a collection drag-and-drop operation.
   *
   * @param event The drag end event.
   */
  const handleCollectionDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event;
    if (!over) {
      clearCollectionDragState();
      return;
    }

    const activeId = parseCollectionDragId(String(active.id));
    const overId = parseCollectionDragId(String(over.id));
    if (activeId == null || overId == null || activeId === overId) {
      clearCollectionDragState();
      return;
    }

    const ids = collections.map((collection) => collection.id);
    const oldIndex = ids.findIndex((id) => id === activeId);
    const newIndex = ids.findIndex((id) => id === overId);
    if (oldIndex < 0 || newIndex < 0) {
      clearCollectionDragState();
      return;
    }

    const nextOrder = arrayMove(ids, oldIndex, newIndex);
    const persist = onReorderCollections(nextOrder);
    clearCollectionDragState();
    await persist;
  };

  /**
   * Handles the end of a request drag-and-drop operation.
   *
   * @param event The drag end event.
   * @param collectionId The collection id to handle the drag end for.
   */
  const handleDragEnd = async (event: DragEndEvent, collectionId: number): Promise<void> => {
    const { active, over } = event;
    if (!over) {
      clearDragState();
      return;
    }

    const activeParsed = parseDragId(String(active.id));
    if (!activeParsed) {
      clearDragState();
      return;
    }

    if (activeParsed.kind === 'folder') {
      const folders = foldersByCollection[collectionId] ?? [];
      const overId = String(over.id);
      const overParsed = parseDragId(overId);
      const overDrop = parseDropTarget(overId);
      const activeFolder = folders.find((folder) => folder.id === activeParsed.id);
      if (!activeFolder) {
        clearDragState();
        return;
      }

      if (overDrop != null) {
        const parentFolderId = overDrop.folderId;
        if (
          parentFolderId === (activeFolder.parent_folder_id ?? null) ||
          wouldCreateFolderCycle(activeFolder.id, parentFolderId, folders)
        ) {
          clearDragState();
          return;
        }
        const targetSiblings = folders.filter(
          (folder) => (folder.parent_folder_id ?? null) === parentFolderId
        );
        const persist = onMoveFolder(
          collectionId,
          activeFolder.id,
          parentFolderId,
          targetSiblings.length
        );
        clearDragState();
        await persist;
        return;
      }

      if (overParsed?.kind !== 'folder') {
        clearDragState();
        return;
      }

      const targetFolder = folders.find((folder) => folder.id === overParsed.id);
      if (!targetFolder || wouldCreateFolderCycle(activeFolder.id, targetFolder.id, folders)) {
        clearDragState();
        return;
      }

      const parentFolderId = targetFolder.parent_folder_id ?? null;
      const siblings = folders.filter(
        (folder) => (folder.parent_folder_id ?? null) === parentFolderId
      );
      const oldIndex = siblings.findIndex((folder) => folder.id === activeParsed.id);
      const newIndex = siblings.findIndex((folder) => folder.id === targetFolder.id);
      if (newIndex < 0) {
        clearDragState();
        return;
      }

      if ((activeFolder.parent_folder_id ?? null) !== parentFolderId) {
        const persist = onMoveFolder(collectionId, activeFolder.id, parentFolderId, newIndex);
        clearDragState();
        await persist;
        return;
      }

      if (oldIndex < 0 || oldIndex === newIndex) {
        clearDragState();
        return;
      }
      const nextOrder = arrayMove(
        siblings.map((folder) => folder.id),
        oldIndex,
        newIndex
      );
      const persist = onReorderFolders(collectionId, parentFolderId, nextOrder);
      clearDragState();
      await persist;
      return;
    }

    if (activeParsed.kind === 'request') {
      const allRequests = requestsByCollection[collectionId] ?? [];
      const sourceFolderId =
        allRequests.find((req) => req.id === activeParsed.id)?.folder_id ?? null;

      if (!allRequests.some((req) => req.id === activeParsed.id)) {
        clearDragState();
        return;
      }

      const resolvedTarget = resolveRequestDropTarget(String(over.id), allRequests);
      if (resolvedTarget === undefined) {
        clearDragState();
        return;
      }

      const targetFolderId = resolvedTarget;
      const targetRefs = toContainerItemRefs(getContainerItems(collectionId, targetFolderId));
      const targetIndex = findUnifiedIndex(targetRefs, String(over.id));
      if (targetIndex === undefined) {
        clearDragState();
        return;
      }

      if (sourceFolderId === targetFolderId) {
        const sourceRefs = toContainerItemRefs(getContainerItems(collectionId, sourceFolderId));
        const oldIndex = sourceRefs.findIndex(
          (item) => item.kind === activeParsed.kind && item.id === activeParsed.id
        );
        if (oldIndex < 0) {
          clearDragState();
          return;
        }
        const nextOrder = arrayMove(sourceRefs, oldIndex, targetIndex);
        const persist = onReorderContainerItems(collectionId, sourceFolderId, nextOrder);
        clearDragState();
        await persist;
        return;
      }

      const persist = onMoveRequest(collectionId, activeParsed.id, targetFolderId, targetIndex);
      clearDragState();
      await persist;
      return;
    }

    clearDragState();
  };

  /**
   * Handles the over of a sidebar item drag-and-drop operation.
   *
   * @param event The drag over event.
   * @param collectionId The collection id to handle the drag over for.
   */
  const handleDragOver = (event: DragOverEvent, collectionId: number): void => {
    if (dragCollectionId !== collectionId) {
      return;
    }

    const overId = event.over?.id;
    if (overId == null) {
      setDropTargetFolderId(undefined);
      return;
    }

    const overIdString = String(overId);
    const target =
      activeDragKind === 'folder'
        ? parseDropTarget(overIdString)?.folderId
        : resolveRequestDropTarget(overIdString, requestsByCollection[collectionId] ?? []);
    const activeFolderId = parseDragId(String(event.active.id))?.id;
    if (
      activeDragKind === 'folder' &&
      typeof target === 'number' &&
      activeFolderId != null &&
      wouldCreateFolderCycle(activeFolderId, target, foldersByCollection[collectionId] ?? [])
    ) {
      setDropTargetFolderId(undefined);
      return;
    }
    setDropTargetFolderId(target);

    if (typeof target === 'number' && !expandedFolderIds.has(target)) {
      setExpandedFolderIds((prev) => {
        const next = new Set(prev);
        next.add(target);
        return next;
      });
    }
  };

  /**
   * Handles the start of a sidebar item drag-and-drop operation.
   *
   * @param event The drag start event.
   * @param collectionId The collection id to handle the drag start for.
   */
  const handleDragStart = (event: DragStartEvent, collectionId: number): void => {
    const parsed = parseDragId(String(event.active.id));
    if (!parsed) return;

    setDragCollectionId(collectionId);
    setDropTargetFolderId(undefined);

    if (parsed.kind === 'folder') {
      const folder = (foldersByCollection[collectionId] ?? []).find(
        (item) => item.id === parsed.id
      );
      setCollectionSidebarDragKind('folder');
      setActiveDragKind('folder');
      setActiveDragFolder(folder ?? null);
      setActiveDragRequest(null);
      return;
    }

    const request = (requestsByCollection[collectionId] ?? []).find(
      (item) => item.id === parsed.id
    );
    setCollectionSidebarDragKind('request');
    setActiveDragKind('request');
    setActiveDragRequest(request ?? null);
    setActiveDragFolder(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleCollectionDragStart}
      onDragEnd={(event) => void handleCollectionDragEnd(event)}
      onDragCancel={clearCollectionDragState}
    >
      <div
        className="sidebar-source-list flex flex-col gap-0"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            clearRequestSelection();
          }
        }}
      >
        {collections.length === 0 && (
          <div className="px-2 py-1.5 text-muted">No collections yet</div>
        )}
        {treeFilterActive &&
          collections.length > 0 &&
          collectionTrees.length === 0 &&
          (archivedSearchFilter == null || archivedSearchFilter.collectionIds.size === 0) && (
            <div className="px-2 py-1.5 text-muted">No matching collections or items</div>
          )}

        <SortableContext items={collectionIds} strategy={verticalListSortingStrategy}>
          {collectionTrees.map(
            ({ collection, folders, folderTree, rootItems, rootDocuments }, collectionIndex) => {
              const expanded = treeFilterActive ? true : expandedCollectionIds.has(collection.id);
              const selected = selectedCollectionId === collection.id;
              const loaded =
                requestsByCollection[collection.id] != null &&
                foldersByCollection[collection.id] != null &&
                documentsByCollection[collection.id] != null;
              const collectionConnectionId = collection.connectionId ?? primaryConnectionId;
              const connectionName = connectionNamesById[collectionConnectionId];
              const connectionType = connectionTypesById[collectionConnectionId];
              const gitStatus = gitStatusesByConnectionId[collectionConnectionId];
              const collectionChangedCount = changedItemCountByCollectionUuid[collection.uuid] ?? 0;
              const untrackedItemCount =
                connectionType === 'git'
                  ? countUntrackedCollectionItems(
                      requestsByCollection[collection.id] ?? [],
                      documentsByCollection[collection.id] ?? [],
                      itemGitStatusByUuid
                    )
                  : 0;
              const canShare =
                connectionType != null && connectionType !== 'sqlite' && connectionType !== 'git';
              const rootItemIds = rootItems.map((item) => containerItemDragId(item));
              const isSidebarItemDragInCollection =
                activeDragKind != null &&
                dragCollectionId === collection.id &&
                dropTargetFolderId !== undefined;
              const isDraggingSidebarItemHere =
                activeDragKind === 'request' && dragCollectionId === collection.id;
              const rootDropHighlight =
                isSidebarItemDragInCollection && dropTargetFolderId === null
                  ? dropTargetHighlightClass
                  : undefined;

              return (
                <div key={collection.id}>
                  <SortableRow
                    id={collectionDragId(collection.id)}
                    className={sourceRow(selected, true)}
                    dragHandleLabel={`Reorder collection "${collection.name}"`}
                    disabled={reorderDisabled}
                    onRowContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const menuId = `collection-${collection.id}`;
                      setInspectPointsByMenuId((prev) => ({
                        ...prev,
                        [menuId]: { x: event.clientX, y: event.clientY }
                      }));
                      setOpenMenuId(menuId);
                    }}
                    trailing={
                      <div onPointerDown={stopSortableDragPointerDown}>
                        <ActionsMenu
                          collection={collection}
                          collectionIndex={collectionIndex}
                          collectionsCount={collections.length}
                          openMenuId={openMenuId}
                          onOpenChange={setOpenMenuId}
                          inspectPoint={inspectPointsByMenuId[`collection-${collection.id}`]}
                          connectionType={connectionType}
                          connectionName={connectionName}
                          collectionConnectionId={collectionConnectionId}
                          canShare={canShare}
                          reorderEnabled={!reorderDisabled}
                          onMove={(direction) => void moveCollection(collection.id, direction)}
                          hasDeselectableSelection={collectionHasDeselectableSelection(
                            collection.id,
                            {
                              selectedCollectionId,
                              selectedFolderId,
                              selectedRequestIds,
                              requestsByCollection,
                              documentsByCollection,
                              openRequestIds,
                              openDocumentIds
                            }
                          )}
                          onDeselectAll={() => handleDeselectAllInCollection(collection.id)}
                          untrackedItemCount={untrackedItemCount}
                        />
                      </div>
                    }
                  >
                    <button
                      type="button"
                      className={SIDEBAR_CHEVRON_BUTTON_CLASS}
                      onClick={() => toggleCollection(collection.id)}
                      onPointerDown={stopSortableDragPointerDown}
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Collapse' : 'Expand'}
                    >
                      <FaIcon
                        icon={expanded ? faChevronDown : faChevronRight}
                        className={SIDEBAR_CHEVRON_ICON_CLASS}
                      />
                    </button>
                    <button
                      type="button"
                      className={`${SIDEBAR_CHEVRON_LABEL_OFFSET_CLASS} min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent py-0 text-left leading-none text-inherit app-no-drag`}
                      data-sidebar-collection-id={collection.id}
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => handleCollectionNameClick(collection.id, expanded)}
                      onDoubleClick={() => onConfigureCollection(collection.id)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        onConfigureCollection(collection.id);
                        focusCollectionSettings();
                      }}
                    >
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className="truncate">{collection.name}</span>
                        <SidebarMarkerDot
                          marker={collection.marker}
                          label={`Color marker for ${collection.name}`}
                        />
                        {(() => {
                          const badgeLabel =
                            connectionType === 'git' && gitStatus?.branch != null
                              ? gitStatus.branch
                              : connectionName;
                          if (!showStorageLocationBadges || badgeLabel == null) {
                            return null;
                          }

                          if (connectionType === 'git') {
                            return (
                              <SidebarBadge
                                as="button"
                                variant="info"
                                title={`On branch ${badgeLabel}`}
                                aria-label={`Switch branch (currently ${badgeLabel})`}
                                onPointerDown={stopSortableDragPointerDown}
                                onClick={() =>
                                  onOpenSwitchBranch(
                                    collectionConnectionId,
                                    connectionName ?? 'Git repository',
                                    collection.uuid
                                  )
                                }
                              >
                                {badgeLabel}
                              </SidebarBadge>
                            );
                          }

                          return (
                            <SidebarBadge variant="info" title={`Stored in ${badgeLabel}`}>
                              {badgeLabel}
                            </SidebarBadge>
                          );
                        })()}
                      </span>
                    </button>
                    {connectionType === 'git' && collectionChangedCount > 0 && (
                      <SidebarBadge
                        as="button"
                        variant="recessed"
                        aria-label={`Open source control (${collectionChangedCount} uncommitted change(s))`}
                        onPointerDown={stopSortableDragPointerDown}
                        onClick={() => onOpenSourceControl()}
                      >
                        {collectionChangedCount}
                      </SidebarBadge>
                    )}
                  </SortableRow>

                  {/**
                   * Renders the expanded collection request tree.
                   */}
                  {(() => {
                    const renderExpandedRequests = (): JSX.Element => (
                      <AnimatedCollapse open={expanded}>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={collectionCollisionDetectionWithDragKind}
                          onDragStart={(event) => handleDragStart(event, collection.id)}
                          onDragOver={(event) => handleDragOver(event, collection.id)}
                          onDragEnd={(event) => void handleDragEnd(event, collection.id)}
                          onDragCancel={clearDragState}
                        >
                          <div className="ml-4 flex flex-col gap-0 py-0">
                            {loaded &&
                              folders.length === 0 &&
                              rootItems.length === 0 &&
                              rootDocuments.length === 0 && (
                                <EmptySectionLabel
                                  label="No saved requests"
                                  className="px-1.5 py-0 pb-0"
                                />
                              )}

                            <DropZone
                              id={dropRootId(collection.id)}
                              disabled={reorderDisabled}
                              className={
                                [
                                  rootDropHighlight,
                                  isDraggingSidebarItemHere &&
                                  rootItems.length === 0 &&
                                  rootDocuments.length === 0
                                    ? 'min-h-8'
                                    : undefined
                                ]
                                  .filter(Boolean)
                                  .join(' ') || undefined
                              }
                            >
                              {isSidebarItemDragInCollection && dropTargetFolderId === null && (
                                <div className="px-2 pb-0.5 text-info">Drop at collection root</div>
                              )}
                              {isDraggingSidebarItemHere &&
                                rootItems.length === 0 &&
                                rootDocuments.length === 0 && (
                                  <div className="px-2 py-1.5 text-muted">Collection root</div>
                                )}
                              <SortableContext
                                items={rootItemIds}
                                strategy={verticalListSortingStrategy}
                              >
                                <div className="flex flex-col gap-0">
                                  {rootDocuments.map((doc) => (
                                    <DocumentRow
                                      key={`document-${doc.id}`}
                                      doc={doc}
                                      activeDocumentId={activeDocumentId}
                                      openMenuId={openMenuId}
                                      onOpenChange={setOpenMenuId}
                                      onLoadDocument={(doc) => {
                                        clearRequestSelection();
                                        onLoadDocument(doc);
                                      }}
                                      onRenameDocument={onRenameDocument}
                                      onDeleteDocument={onDeleteDocument}
                                      gitItemStatus={
                                        connectionType === 'git'
                                          ? itemGitStatusByUuid[doc.uuid]
                                          : undefined
                                      }
                                      onGitStageItem={
                                        connectionType === 'git'
                                          ? () =>
                                              void onGitStageItem(
                                                collectionConnectionId,
                                                collection.uuid,
                                                doc.uuid
                                              )
                                          : undefined
                                      }
                                      onGitUnstageItem={
                                        connectionType === 'git'
                                          ? () =>
                                              void onGitUnstageItem(
                                                collectionConnectionId,
                                                collection.uuid,
                                                doc.uuid
                                              )
                                          : undefined
                                      }
                                    />
                                  ))}
                                  {rootItems.map((item, itemIndex) => {
                                    const req = (requestsByCollection[collection.id] ?? []).find(
                                      (request) => request.id === item.id
                                    );
                                    if (req == null) return null;
                                    return (
                                      <RequestRow
                                        key={`request-${req.id}`}
                                        req={req}
                                        activeRequestId={activeRequestId}
                                        selected={selectedRequestIds.has(req.id)}
                                        selectionCount={selectedRequestIds.size}
                                        openMenuId={openMenuId}
                                        onOpenChange={setOpenMenuId}
                                        onRowClick={handleRequestRowClick}
                                        onBeforeContextMenu={handleRequestBeforeContextMenu}
                                        canMoveUp={!reorderDisabled && itemIndex > 0}
                                        canMoveDown={
                                          !reorderDisabled && itemIndex < rootItems.length - 1
                                        }
                                        onMoveUp={() =>
                                          void moveContainerItemInList(
                                            collection.id,
                                            null,
                                            item,
                                            'up'
                                          )
                                        }
                                        onMoveDown={() =>
                                          void moveContainerItemInList(
                                            collection.id,
                                            null,
                                            item,
                                            'down'
                                          )
                                        }
                                        onRunRequest={() => onRunRequest(req, collection.name)}
                                        onDeleteRequest={onDeleteRequest}
                                        onDuplicateRequest={onDuplicateRequest}
                                        onExportRequest={onExportRequest}
                                        aiChatAvailable={aiAvailable}
                                        onCopyToChat={(request) =>
                                          void copyToChat(`@request.${request.uuid}`)
                                        }
                                        onRunSelected={() =>
                                          onRunSelectedRequests(selectedRequestsOrdered)
                                        }
                                        onOpenSelected={() =>
                                          onOpenSelectedRequests(selectedRequestsOrdered)
                                        }
                                        onNewWorkspaceFromSelected={() =>
                                          onCreateWorkspaceFromSelection(
                                            selectedRequestsOrdered.map((request) => request.id)
                                          )
                                        }
                                        onDeleteSelected={() => {
                                          void onDeleteSelectedRequests(
                                            selectedRequestsOrdered
                                          ).then((deleted) => {
                                            if (deleted) {
                                              clearRequestSelection();
                                            }
                                          });
                                        }}
                                        dragDisabled={reorderDisabled}
                                        gitItemStatus={
                                          connectionType === 'git'
                                            ? itemGitStatusByUuid[req.uuid]
                                            : undefined
                                        }
                                        onGitStageItem={
                                          connectionType === 'git'
                                            ? () =>
                                                void onGitStageItem(
                                                  collectionConnectionId,
                                                  collection.uuid,
                                                  req.uuid
                                                )
                                            : undefined
                                        }
                                        onGitUnstageItem={
                                          connectionType === 'git'
                                            ? () =>
                                                void onGitUnstageItem(
                                                  collectionConnectionId,
                                                  collection.uuid,
                                                  req.uuid
                                                )
                                            : undefined
                                        }
                                      />
                                    );
                                  })}
                                </div>
                              </SortableContext>
                            </DropZone>

                            {(() => {
                              /**
                               * Renders nested folder sibling groups with parent-scoped sorting.
                               *
                               * @param nodes - Folder nodes sharing the same parent.
                               * @param level - One-based accessibility depth.
                               * @returns The sortable sibling group.
                               */
                              const renderFolderNodes = (
                                nodes: readonly FolderTreeNode[],
                                level: number
                              ): JSX.Element => (
                                <SortableContext
                                  items={nodes.map((node) => folderDragId(node.folder.id))}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <>
                                    {nodes.map((node, folderIndex) => {
                                      const folder = node.folder;
                                      const folderExpanded = treeFilterActive
                                        ? true
                                        : expandedFolderIds.has(folder.id);
                                      const folderItems = getContainerItems(
                                        collection.id,
                                        folder.id
                                      );
                                      const folderDocuments = getContainerDocuments(
                                        collection.id,
                                        folder.id
                                      );
                                      const descendants = getFolderDescendants(
                                        folder.id,
                                        foldersByCollection[collection.id] ?? []
                                      );
                                      const subtreeFolderIds = new Set([
                                        folder.id,
                                        ...descendants.map((descendant) => descendant.id)
                                      ]);
                                      const subtreeRequestIds = (
                                        requestsByCollection[collection.id] ?? []
                                      )
                                        .filter(
                                          (request) =>
                                            request.folder_id != null &&
                                            subtreeFolderIds.has(request.folder_id)
                                        )
                                        .map((request) => request.id);
                                      const folderItemIds = folderItems.map((item) =>
                                        containerItemDragId(item)
                                      );
                                      const folderHighlighted =
                                        isSidebarItemDragInCollection &&
                                        dropTargetFolderId === folder.id;
                                      const folderSelected = selectedFolderId === folder.id;

                                      return (
                                        <div
                                          key={folder.id}
                                          role="none"
                                          data-sidebar-folder-id={folder.id}
                                          className={
                                            folderHighlighted ? dropTargetHighlightClass : undefined
                                          }
                                        >
                                          <DropZone
                                            id={dropFolderId(folder.id)}
                                            disabled={reorderDisabled}
                                            role="none"
                                          >
                                            <SidebarFolderItem
                                              as="li"
                                              name={folder.name}
                                              expanded={folderExpanded}
                                              childrenId={`sidebar-folder-children-${folder.id}`}
                                              level={level}
                                              setSize={nodes.length}
                                              posInSet={folderIndex + 1}
                                              selected={folderSelected}
                                              dropHighlighted={folderHighlighted}
                                              expandIcon={faChevronRight}
                                              collapseIcon={faChevronDown}
                                              markerDot={{
                                                marker: folder.marker,
                                                visible: showMarkers,
                                                label: `Color marker for ${folder.name}`
                                              }}
                                              sortable={{
                                                id: folderDragId(folder.id),
                                                dragHandleLabel: `Reorder folder "${folder.name}"`,
                                                disabled: reorderDisabled
                                              }}
                                              onToggleExpand={() => toggleFolder(folder.id)}
                                              onNameClick={() =>
                                                handleFolderNameClick(
                                                  collection.id,
                                                  folder.id,
                                                  folderExpanded
                                                )
                                              }
                                              onNameDoubleClick={() =>
                                                onConfigureFolder(collection.id, folder.id)
                                              }
                                              onNameEnter={() => {
                                                onConfigureFolder(collection.id, folder.id);
                                                focusFolderSettings();
                                              }}
                                              onContextMenu={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                const menuId = `folder-${folder.id}`;
                                                setInspectPointsByMenuId((prev) => ({
                                                  ...prev,
                                                  [menuId]: { x: event.clientX, y: event.clientY }
                                                }));
                                                setOpenMenuId(menuId);
                                              }}
                                              actions={
                                                <SidebarRowActionsMenu
                                                  menuId={`folder-${folder.id}`}
                                                  openMenuId={openMenuId}
                                                  onOpenChange={setOpenMenuId}
                                                  markerTarget={{
                                                    kind: 'folder',
                                                    collectionId: collection.id,
                                                    id: folder.id,
                                                    marker: folder.marker ?? null
                                                  }}
                                                  groups={[
                                                    [
                                                      {
                                                        label: 'New',
                                                        submenu: [
                                                          [
                                                            {
                                                              label: 'New Request',
                                                              onSelect: () =>
                                                                void onNewRequestInFolder(
                                                                  collection.id,
                                                                  folder.id
                                                                )
                                                            },
                                                            {
                                                              label: 'New Folder',
                                                              onSelect: () =>
                                                                onNewFolder(
                                                                  collection.id,
                                                                  folder.id
                                                                )
                                                            },
                                                            {
                                                              label: 'New Markdown',
                                                              onSelect: () =>
                                                                void onNewDocumentInFolder(
                                                                  collection.id,
                                                                  folder.id
                                                                )
                                                            }
                                                          ]
                                                        ]
                                                      }
                                                    ],
                                                    [
                                                      {
                                                        label: 'Run',
                                                        onSelect: () =>
                                                          onRunFolder(
                                                            collection.id,
                                                            folder.id,
                                                            collection.name,
                                                            folder.name
                                                          )
                                                      }
                                                    ],
                                                    [buildCopyIdMenuItem(folder.uuid)],
                                                    ...(aiAvailable
                                                      ? [
                                                          [
                                                            {
                                                              label: 'Copy to chat',
                                                              onSelect: () =>
                                                                void copyToChat(
                                                                  `@folder.${folder.uuid}`
                                                                )
                                                            }
                                                          ]
                                                        ]
                                                      : []),
                                                    ...(!reorderDisabled
                                                      ? buildReorderMenuGroup(
                                                          folderIndex,
                                                          nodes.length,
                                                          (direction) =>
                                                            moveFolder(
                                                              collection.id,
                                                              folder.id,
                                                              direction
                                                            )
                                                        )
                                                      : []),
                                                    [
                                                      {
                                                        label: 'Import Request',
                                                        onSelect: () =>
                                                          void onImportRequest(
                                                            collection.id,
                                                            folder.id
                                                          )
                                                      },
                                                      {
                                                        label: 'Save all',
                                                        onSelect: () =>
                                                          void onSaveAllInFolder(
                                                            collection.id,
                                                            folder.id
                                                          )
                                                      },
                                                      {
                                                        label: 'Rename',
                                                        onSelect: () =>
                                                          void onRenameFolder(
                                                            folder.id,
                                                            collection.id
                                                          )
                                                      },
                                                      {
                                                        label: 'Settings',
                                                        onSelect: () =>
                                                          onConfigureFolder(
                                                            collection.id,
                                                            folder.id
                                                          )
                                                      }
                                                    ],
                                                    ...buildPluginContextMenuGroups(
                                                      'folder',
                                                      {
                                                        collectionId: collection.id,
                                                        folderId: folder.id
                                                      },
                                                      pluginContextMenuItems
                                                    ),
                                                    [
                                                      {
                                                        label: 'Delete',
                                                        variant: 'danger',
                                                        onSelect: () =>
                                                          void onDeleteFolder(
                                                            folder.id,
                                                            collection.id,
                                                            subtreeRequestIds,
                                                            descendants.length
                                                          )
                                                      }
                                                    ],
                                                    ...buildDevInspectMenuGroups(
                                                      inspectPointsByMenuId[`folder-${folder.id}`],
                                                      `folder-${folder.id}`,
                                                      developerToolsEnabled
                                                    )
                                                  ]}
                                                />
                                              }
                                            />
                                          </DropZone>

                                          <AnimatedCollapse open={folderExpanded} className="ml-6">
                                            <div className="flex flex-col gap-0 py-0">
                                              {folderDocuments.map((doc) => (
                                                <DocumentRow
                                                  key={`document-${doc.id}`}
                                                  doc={doc}
                                                  activeDocumentId={activeDocumentId}
                                                  openMenuId={openMenuId}
                                                  onOpenChange={setOpenMenuId}
                                                  onLoadDocument={(doc) => {
                                                    clearRequestSelection();
                                                    onLoadDocument(doc);
                                                  }}
                                                  onRenameDocument={onRenameDocument}
                                                  onDeleteDocument={onDeleteDocument}
                                                  gitItemStatus={
                                                    connectionType === 'git'
                                                      ? itemGitStatusByUuid[doc.uuid]
                                                      : undefined
                                                  }
                                                  onGitStageItem={
                                                    connectionType === 'git'
                                                      ? () =>
                                                          void onGitStageItem(
                                                            collectionConnectionId,
                                                            collection.uuid,
                                                            doc.uuid
                                                          )
                                                      : undefined
                                                  }
                                                  onGitUnstageItem={
                                                    connectionType === 'git'
                                                      ? () =>
                                                          void onGitUnstageItem(
                                                            collectionConnectionId,
                                                            collection.uuid,
                                                            doc.uuid
                                                          )
                                                      : undefined
                                                  }
                                                />
                                              ))}
                                              <SortableContext
                                                items={folderItemIds}
                                                strategy={verticalListSortingStrategy}
                                              >
                                                {folderItems.map((item, itemIndex) => {
                                                  const req = (
                                                    requestsByCollection[collection.id] ?? []
                                                  ).find((request) => request.id === item.id);
                                                  if (req == null) return null;
                                                  return (
                                                    <RequestRow
                                                      key={`request-${req.id}`}
                                                      req={req}
                                                      activeRequestId={activeRequestId}
                                                      selected={selectedRequestIds.has(req.id)}
                                                      selectionCount={selectedRequestIds.size}
                                                      openMenuId={openMenuId}
                                                      onOpenChange={setOpenMenuId}
                                                      onRowClick={handleRequestRowClick}
                                                      onBeforeContextMenu={
                                                        handleRequestBeforeContextMenu
                                                      }
                                                      canMoveUp={!reorderDisabled && itemIndex > 0}
                                                      canMoveDown={
                                                        !reorderDisabled &&
                                                        itemIndex < folderItems.length - 1
                                                      }
                                                      onMoveUp={() =>
                                                        void moveContainerItemInList(
                                                          collection.id,
                                                          folder.id,
                                                          item,
                                                          'up'
                                                        )
                                                      }
                                                      onMoveDown={() =>
                                                        void moveContainerItemInList(
                                                          collection.id,
                                                          folder.id,
                                                          item,
                                                          'down'
                                                        )
                                                      }
                                                      onRunRequest={() =>
                                                        onRunRequest(req, collection.name)
                                                      }
                                                      onDeleteRequest={onDeleteRequest}
                                                      onDuplicateRequest={onDuplicateRequest}
                                                      onExportRequest={onExportRequest}
                                                      aiChatAvailable={aiAvailable}
                                                      onCopyToChat={(request) =>
                                                        void copyToChat(`@request.${request.uuid}`)
                                                      }
                                                      onRunSelected={() =>
                                                        onRunSelectedRequests(
                                                          selectedRequestsOrdered
                                                        )
                                                      }
                                                      onOpenSelected={() =>
                                                        onOpenSelectedRequests(
                                                          selectedRequestsOrdered
                                                        )
                                                      }
                                                      onNewWorkspaceFromSelected={() =>
                                                        onCreateWorkspaceFromSelection(
                                                          selectedRequestsOrdered.map(
                                                            (request) => request.id
                                                          )
                                                        )
                                                      }
                                                      onDeleteSelected={() => {
                                                        void onDeleteSelectedRequests(
                                                          selectedRequestsOrdered
                                                        ).then((deleted) => {
                                                          if (deleted) {
                                                            clearRequestSelection();
                                                          }
                                                        });
                                                      }}
                                                      dragDisabled={reorderDisabled}
                                                      gitItemStatus={
                                                        connectionType === 'git'
                                                          ? itemGitStatusByUuid[req.uuid]
                                                          : undefined
                                                      }
                                                      onGitStageItem={
                                                        connectionType === 'git'
                                                          ? () =>
                                                              void onGitStageItem(
                                                                collectionConnectionId,
                                                                collection.uuid,
                                                                req.uuid
                                                              )
                                                          : undefined
                                                      }
                                                      onGitUnstageItem={
                                                        connectionType === 'git'
                                                          ? () =>
                                                              void onGitUnstageItem(
                                                                collectionConnectionId,
                                                                collection.uuid,
                                                                req.uuid
                                                              )
                                                          : undefined
                                                      }
                                                    />
                                                  );
                                                })}
                                              </SortableContext>
                                              {folderItems.length === 0 &&
                                                folderDocuments.length === 0 &&
                                                node.children.length === 0 && (
                                                  <div className="px-1.5 py-0">
                                                    <span className="text-muted">Empty folder</span>
                                                  </div>
                                                )}
                                            </div>
                                            {node.children.length > 0 && (
                                              <SidebarTreeGroup
                                                id={`sidebar-folder-children-${folder.id}`}
                                                className="ml-2"
                                              >
                                                {renderFolderNodes(node.children, level + 1)}
                                              </SidebarTreeGroup>
                                            )}
                                          </AnimatedCollapse>
                                        </div>
                                      );
                                    })}
                                  </>
                                </SortableContext>
                              );

                              return (
                                <SidebarTree aria-label={`${collection.name} folders`}>
                                  {renderFolderNodes(folderTree, 1)}
                                </SidebarTree>
                              );
                            })()}
                          </div>

                          <DragOverlay dropAnimation={null}>
                            {dragCollectionId === collection.id &&
                            activeDragKind === 'request' &&
                            activeDragRequest ? (
                              <div className="flex items-center gap-1.5 rounded border border-separator bg-surface px-2 py-1 shadow-md">
                                <span
                                  className={`shrink-0 px-1 py-px ${methodBadgeClass(activeDragRequest.method, showMethodColors)}`}
                                >
                                  {activeDragRequest.method}
                                </span>
                                <span className="truncate">{activeDragRequest.name}</span>
                              </div>
                            ) : dragCollectionId === collection.id &&
                              activeDragKind === 'folder' &&
                              activeDragFolder ? (
                              <div className="rounded border border-separator bg-surface px-2 py-1 font-medium shadow-md">
                                {activeDragFolder.name}
                              </div>
                            ) : null}
                          </DragOverlay>
                        </DndContext>
                      </AnimatedCollapse>
                    );

                    return renderExpandedRequests();
                  })()}
                </div>
              );
            }
          )}
        </SortableContext>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragCollection ? (
          <div className="rounded border border-separator bg-surface px-2 py-1 font-medium shadow-md">
            {activeDragCollection.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
