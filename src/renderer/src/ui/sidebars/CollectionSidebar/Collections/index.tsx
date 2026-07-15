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
import { toContainerItemRefs } from '#/shared/collectionContainerOrder';
import type { Collection, CollectionDocument, Folder, SavedRequest } from '#/shared/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveDocumentId,
  selectCollections,
  selectDocumentsByCollection,
  selectDraft,
  selectFoldersByCollection,
  selectOpenDocumentIds,
  selectOpenRequestIds,
  selectRequestsByCollection,
  selectSelectedCollectionId,
  selectSelectedFolderId
} from '#/renderer/src/store/selectors';
import { useSidebarExpansion } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarExpansion';
import { useSidebarProviders } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarProvidersContext';
import { useSidebarGit } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarGitContext';
import { useSidebarSearchContext } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarSearchContext';
import { useCollectionActions } from '#/renderer/src/ui/sidebars/CollectionSidebar/useCollectionActions';
import { closeSidebarContentTabs } from '#/renderer/src/store/thunks/sidebarDeselect';
import {
  EmptySectionLabel,
  FaIcon,
  SidebarBadge,
  SidebarFolderItem
} from '@harborclient/sdk/components';
import { SidebarColorDot } from '#/renderer/src/ui/sidebars/CollectionSidebar/SidebarColorDot';
import { SidebarRowActionsMenu } from '#/renderer/src/ui/sidebars/CollectionSidebar/SidebarRowActionsMenu';
import { buildReorderMenuGroup } from '@harborclient/sdk/components';
import { usePluginContextMenuItems } from '#/renderer/src/plugins/pluginHooks';
import { buildPluginContextMenuGroups } from '#/renderer/src/plugins/pluginContextMenuHelpers';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useCopyToChat } from '#/renderer/src/hooks/useCopyToChat';
import { faChevronDown, faChevronRight } from '#/renderer/src/fontawesome';
import { METHOD_CLASSES, sourceRow } from '#/renderer/src/ui/shared/classes';
import { AnimatedCollapse } from '#/renderer/src/ui/shared/AnimatedCollapse';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/shared/devInspectContextMenu';
import { DropZone } from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/DropZone';
import { focusCollectionSettings } from '#/renderer/src/ui/CollectionSettings/focusCollectionSettings';
import { focusFolderSettings } from '#/renderer/src/ui/FolderSettings/focusFolderSettings';
import { DocumentRow } from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/DocumentRow';
import { RequestRow } from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/RequestRow';
import { SortableRow } from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/SortableRow';
import { stopSortableDragPointerDown } from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/sortableRowUtils';
import {
  collectionHasDeselectableSelection,
  removeCollectionRequestSelection
} from '#/renderer/src/ui/sidebars/CollectionSidebar/collectionSidebarSelection';
import { useSidebarSelectionCoordinator } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarSelectionContext';
import {
  applySidebarSelectionClick,
  orderSelectedIds
} from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarSelectionUtils';
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
} from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/utils';

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
  const collections = useAppSelector(selectCollections);
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
    showColorDots
  } = useSidebarExpansion();
  const { primaryConnectionId, connectionNamesById, connectionTypesById } = useSidebarProviders();
  const {
    gitStatusesByConnectionId,
    itemGitStatusByUuid,
    changedItemCountByCollectionUuid,
    stageItem: onGitStageItem,
    unstageItem: onGitUnstageItem,
    openSourceControl: onOpenSourceControl,
    openCreateBranch: onOpenCreateBranch,
    openSwitchBranch: onOpenSwitchBranch,
    openMergeBranch: onOpenMergeBranch
  } = useSidebarGit();
  const { searchFilter, searchActive } = useSidebarSearchContext();
  const {
    onExpandCollection,
    onSelectCollection,
    onClearCollectionSelection,
    onSelectFolder,
    onConfigureCollection,
    onConfigureFolder,
    onRunCollection,
    onRunFolder,
    onRunRequest,
    onDeleteCollection,
    onExportCollection,
    onDuplicateCollection,
    onShareCollection,
    onSaveAllInCollection,
    onSaveAllInFolder,
    onNewFolder,
    onNewRequestInCollection,
    onImportRequest,
    onNewRequestInFolder,
    onNewDocumentInCollection,
    onNewDocumentInFolder,
    onRenameFolder,
    onDeleteFolder,
    onReorderCollections,
    onReorderFolders,
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
    onCreateTabGroupFromSelection,
    onDeleteSelectedRequests,
    onRunSelectedRequests
  } = useCollectionActions();
  const confirm = useConfirm();
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
   * Gets sortable sidebar items (requests only) for a collection root or folder container.
   *
   * @param collectionId The collection id to read items from.
   * @param folderId The folder id, or null for collection root.
   */
  const getContainerItems = (collectionId: number, folderId: number | null): ContainerItem[] => {
    const requests = requestsByCollection[collectionId] ?? [];
    let items = mergeContainerItems(requests, [], folderId);

    if (searchFilter != null) {
      items = items.filter((item) => searchFilter.requestIds.has(item.id));
    }

    return items;
  };

  /**
   * Gets markdown documents for a collection root or folder, sorted alphabetically by name.
   * Documents are always shown during search regardless of request matches.
   *
   * @param collectionId The collection id to read documents from.
   * @param folderId The folder id, or null for collection root.
   */
  const getContainerDocuments = (
    collectionId: number,
    folderId: number | null
  ): CollectionDocument[] => {
    const documents = documentsByCollection[collectionId] ?? [];
    const inContainer = documents.filter((document) => (document.folder_id ?? null) === folderId);
    return sortContainerDocuments(inContainer);
  };

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
    const ids = folders.map((folder) => folder.id);
    const index = ids.findIndex((id) => id === folderId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ids.length) return;
    await onReorderFolders(collectionId, arrayMove(ids, index, targetIndex));
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
   */
  const collectionTrees = useMemo(() => {
    const trees = collections.map((collection) => {
      const folders = foldersByCollection[collection.id] ?? [];
      const rootItems = mergeContainerItems(
        requestsByCollection[collection.id] ?? [],
        [],
        null
      ).filter((item) => searchFilter == null || searchFilter.requestIds.has(item.id));
      const rootDocuments = sortContainerDocuments(
        (documentsByCollection[collection.id] ?? []).filter(
          (document) => (document.folder_id ?? null) === null
        )
      );

      return {
        collection,
        folders:
          searchFilter == null
            ? folders
            : folders.filter((folder) => searchFilter.folderIds.has(folder.id)),
        rootItems,
        rootDocuments
      };
    });

    if (searchFilter == null) {
      return trees;
    }

    return trees.filter(({ collection }) => searchFilter.collectionIds.has(collection.id));
  }, [collections, foldersByCollection, requestsByCollection, documentsByCollection, searchFilter]);

  /**
   * Request ids in on-screen sidebar order for shift-click range selection.
   */
  const visibleRequestOrder = useMemo(() => {
    const ids: number[] = [];

    for (const { collection, folders, rootItems } of collectionTrees) {
      const expanded =
        searchActive && searchFilter != null
          ? searchFilter.collectionIds.has(collection.id)
          : expandedCollectionIds.has(collection.id);
      if (!expanded) {
        continue;
      }

      for (const item of rootItems) {
        ids.push(item.id);
      }

      for (const folder of folders) {
        const folderExpanded =
          searchActive && searchFilter != null
            ? searchFilter.folderIds.has(folder.id)
            : expandedFolderIds.has(folder.id);
        if (!folderExpanded) {
          continue;
        }

        const folderItems = mergeContainerItems(
          requestsByCollection[collection.id] ?? [],
          [],
          folder.id
        ).filter((item) => searchFilter == null || searchFilter.requestIds.has(item.id));
        for (const item of folderItems) {
          ids.push(item.id);
        }
      }
    }

    return ids;
  }, [
    collectionTrees,
    expandedCollectionIds,
    expandedFolderIds,
    requestsByCollection,
    searchActive,
    searchFilter
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
      const overDrop = overParsed == null ? parseDropTarget(overId) : null;
      const overFolderId =
        overParsed?.kind === 'folder' ? overParsed.id : (overDrop?.folderId ?? null);
      if (overFolderId == null) {
        clearDragState();
        return;
      }

      const oldIndex = folders.findIndex((folder) => folder.id === activeParsed.id);
      const newIndex = folders.findIndex((folder) => folder.id === overFolderId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        clearDragState();
        return;
      }
      const nextOrder = arrayMove(
        folders.map((folder) => folder.id),
        oldIndex,
        newIndex
      );
      const persist = onReorderFolders(collectionId, nextOrder);
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
    if (activeDragKind !== 'request' || dragCollectionId !== collectionId) {
      return;
    }

    const overId = event.over?.id;
    if (overId == null) {
      setDropTargetFolderId(undefined);
      return;
    }

    const requests = requestsByCollection[collectionId] ?? [];
    const target = resolveRequestDropTarget(String(overId), requests);
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
        {searchActive && collections.length > 0 && collectionTrees.length === 0 && (
          <div className="px-2 py-1.5 text-muted">No matching collections or requests</div>
        )}

        <SortableContext items={collectionIds} strategy={verticalListSortingStrategy}>
          {collectionTrees.map(
            ({ collection, folders, rootItems, rootDocuments }, collectionIndex) => {
              const expanded =
                searchActive && searchFilter != null
                  ? searchFilter.collectionIds.has(collection.id)
                  : expandedCollectionIds.has(collection.id);
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
              const canShare =
                connectionType != null && connectionType !== 'sqlite' && connectionType !== 'git';
              const folderIds = folders.map((folder) => folderDragId(folder.id));
              const rootItemIds = rootItems.map((item) => containerItemDragId(item));
              const isSidebarItemDragInCollection =
                activeDragKind === 'request' &&
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
                    disabled={searchActive}
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
                  >
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:text-text app-no-drag"
                      onClick={() => toggleCollection(collection.id)}
                      onPointerDown={stopSortableDragPointerDown}
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Collapse' : 'Expand'}
                    >
                      <FaIcon
                        icon={expanded ? faChevronDown : faChevronRight}
                        className="h-2 w-2"
                      />
                    </button>
                    <button
                      type="button"
                      className="ml-0.5 min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent py-0 text-left leading-none text-inherit app-no-drag"
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
                        <SidebarColorDot
                          color={collection.color}
                          label={`Color for ${collection.name}`}
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
                    <div onPointerDown={stopSortableDragPointerDown}>
                      <SidebarRowActionsMenu
                        menuId={`collection-${collection.id}`}
                        openMenuId={openMenuId}
                        onOpenChange={setOpenMenuId}
                        colorTarget={{
                          kind: 'collection',
                          id: collection.id,
                          color: collection.color ?? null
                        }}
                        groups={[
                          [
                            {
                              label: 'New',
                              submenu: [
                                [
                                  {
                                    label: 'New Request',
                                    onSelect: () => void onNewRequestInCollection(collection.id)
                                  },
                                  {
                                    label: 'New Folder',
                                    onSelect: () => void onNewFolder(collection.id)
                                  },
                                  {
                                    label: 'New Markdown',
                                    onSelect: () => void onNewDocumentInCollection(collection.id)
                                  }
                                ]
                              ]
                            },
                            ...(connectionType === 'git' && connectionName != null
                              ? [
                                  {
                                    label: 'Git',
                                    submenu: [
                                      [
                                        {
                                          label: 'Commit',
                                          onSelect: () => onOpenSourceControl()
                                        },
                                        {
                                          label: 'Branches',
                                          onSelect: () =>
                                            onOpenCreateBranch(
                                              collectionConnectionId,
                                              connectionName,
                                              collection.uuid
                                            )
                                        },
                                        {
                                          label: 'Merge',
                                          onSelect: () =>
                                            onOpenMergeBranch(
                                              collectionConnectionId,
                                              connectionName,
                                              collection.uuid
                                            )
                                        }
                                      ]
                                    ]
                                  }
                                ]
                              : [])
                          ],
                          [
                            {
                              label: 'Run',
                              onSelect: () => onRunCollection(collection.id, collection.name)
                            }
                          ],
                          ...(aiAvailable
                            ? [
                                [
                                  {
                                    label: 'Copy to chat',
                                    onSelect: () =>
                                      void copyToChat(`@collection.${collection.uuid}`)
                                  }
                                ]
                              ]
                            : []),
                          ...buildReorderMenuGroup(
                            collectionIndex,
                            collections.length,
                            (direction) => moveCollection(collection.id, direction)
                          ),
                          [
                            {
                              label: 'Settings',
                              onSelect: () => onConfigureCollection(collection.id)
                            },
                            {
                              label: 'Duplicate',
                              onSelect: () => void onDuplicateCollection(collection.id)
                            }
                          ],
                          [
                            {
                              label: 'Import',
                              onSelect: () => void onImportRequest(collection.id)
                            },
                            {
                              label: 'Export',
                              onSelect: () => void onExportCollection(collection.id)
                            },
                            {
                              label: 'Save all',
                              onSelect: () => void onSaveAllInCollection(collection.id)
                            }
                          ],
                          [
                            ...(canShare
                              ? [
                                  {
                                    label: 'Share access',
                                    onSelect: () =>
                                      onShareCollection(collection.id, collection.name)
                                  }
                                ]
                              : [])
                          ],
                          ...buildPluginContextMenuGroups(
                            'collection',
                            { collectionId: collection.id },
                            pluginContextMenuItems
                          ),
                          [
                            ...(collectionHasDeselectableSelection(collection.id, {
                              selectedCollectionId,
                              selectedFolderId,
                              selectedRequestIds,
                              requestsByCollection,
                              documentsByCollection,
                              openRequestIds,
                              openDocumentIds
                            })
                              ? [
                                  {
                                    label: 'Deselect all',
                                    onSelect: () => handleDeselectAllInCollection(collection.id)
                                  }
                                ]
                              : []),
                            {
                              label: 'Delete',
                              variant: 'danger',
                              onSelect: () => {
                                void (async () => {
                                  const confirmOptions = {
                                    title: 'Delete collection',
                                    message: `Delete collection "${collection.name}"?`,
                                    confirmLabel: 'Delete',
                                    variant: 'danger' as const,
                                    reconfirm: true
                                  };
                                  const result =
                                    connectionType === 'git'
                                      ? await confirm({
                                          ...confirmOptions,
                                          checkboxLabel: 'Also delete repo directory'
                                        })
                                      : await confirm(confirmOptions);
                                  const confirmed =
                                    typeof result === 'boolean' ? result : result.confirmed;
                                  const deleteRepoDirectory =
                                    typeof result === 'boolean' ? false : result.checkboxChecked;
                                  if (confirmed) {
                                    void onDeleteCollection(collection.id, { deleteRepoDirectory });
                                  }
                                })();
                              }
                            }
                          ],
                          ...buildDevInspectMenuGroups(
                            inspectPointsByMenuId[`collection-${collection.id}`],
                            `collection-${collection.id}`,
                            developerToolsEnabled
                          )
                        ]}
                      />
                    </div>
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
                              disabled={searchActive}
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
                                        canMoveUp={itemIndex > 0}
                                        canMoveDown={itemIndex < rootItems.length - 1}
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
                                        onNewTabGroupFromSelected={() =>
                                          onCreateTabGroupFromSelection(
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
                                        dragDisabled={searchActive}
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

                            <SortableContext
                              items={folderIds}
                              strategy={verticalListSortingStrategy}
                            >
                              {folders.map((folder, folderIndex) => {
                                const folderExpanded =
                                  searchActive && searchFilter != null
                                    ? searchFilter.folderIds.has(folder.id)
                                    : expandedFolderIds.has(folder.id);
                                const folderItems = getContainerItems(collection.id, folder.id);
                                const folderDocuments = getContainerDocuments(
                                  collection.id,
                                  folder.id
                                );
                                const folderItemIds = folderItems.map((item) =>
                                  containerItemDragId(item)
                                );
                                const folderHighlighted =
                                  isSidebarItemDragInCollection && dropTargetFolderId === folder.id;
                                const folderSelected = selectedFolderId === folder.id;

                                return (
                                  <div
                                    key={folder.id}
                                    data-sidebar-folder-id={folder.id}
                                    className={
                                      folderHighlighted ? dropTargetHighlightClass : undefined
                                    }
                                  >
                                    <DropZone id={dropFolderId(folder.id)} disabled={searchActive}>
                                      <SidebarFolderItem
                                        name={folder.name}
                                        expanded={folderExpanded}
                                        selected={folderSelected}
                                        dropHighlighted={folderHighlighted}
                                        expandIcon={faChevronRight}
                                        collapseIcon={faChevronDown}
                                        colorDot={{
                                          color: folder.color,
                                          visible: showColorDots,
                                          label: `Color for ${folder.name}`
                                        }}
                                        sortable={{
                                          id: folderDragId(folder.id),
                                          dragHandleLabel: `Reorder folder "${folder.name}"`,
                                          disabled: searchActive
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
                                            colorTarget={{
                                              kind: 'folder',
                                              collectionId: collection.id,
                                              id: folder.id,
                                              color: folder.color ?? null
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
                                              ...(aiAvailable
                                                ? [
                                                    [
                                                      {
                                                        label: 'Copy to chat',
                                                        onSelect: () =>
                                                          void copyToChat(`@folder.${folder.uuid}`)
                                                      }
                                                    ]
                                                  ]
                                                : []),
                                              ...buildReorderMenuGroup(
                                                folderIndex,
                                                folders.length,
                                                (direction) =>
                                                  moveFolder(collection.id, folder.id, direction)
                                              ),
                                              [
                                                {
                                                  label: 'Import Request',
                                                  onSelect: () =>
                                                    void onImportRequest(collection.id, folder.id)
                                                },
                                                {
                                                  label: 'Save all',
                                                  onSelect: () =>
                                                    void onSaveAllInFolder(collection.id, folder.id)
                                                },
                                                {
                                                  label: 'Rename',
                                                  onSelect: () =>
                                                    void onRenameFolder(folder.id, collection.id)
                                                },
                                                {
                                                  label: 'Settings',
                                                  onSelect: () =>
                                                    onConfigureFolder(collection.id, folder.id)
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
                                                      folderItems
                                                        .filter((item) => item.kind === 'request')
                                                        .map((item) => item.id)
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
                                                onBeforeContextMenu={handleRequestBeforeContextMenu}
                                                canMoveUp={itemIndex > 0}
                                                canMoveDown={itemIndex < folderItems.length - 1}
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
                                                  onRunSelectedRequests(selectedRequestsOrdered)
                                                }
                                                onOpenSelected={() =>
                                                  onOpenSelectedRequests(selectedRequestsOrdered)
                                                }
                                                onNewTabGroupFromSelected={() =>
                                                  onCreateTabGroupFromSelection(
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
                                                dragDisabled={searchActive}
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
                                          folderDocuments.length === 0 && (
                                            <div className="px-1.5 py-0">
                                              <span className="text-muted">Empty folder</span>
                                            </div>
                                          )}
                                      </div>
                                    </AnimatedCollapse>
                                  </div>
                                );
                              })}
                            </SortableContext>
                          </div>

                          <DragOverlay dropAnimation={null}>
                            {dragCollectionId === collection.id &&
                            activeDragKind === 'request' &&
                            activeDragRequest ? (
                              <div className="flex items-center gap-1.5 rounded border border-separator bg-surface px-2 py-1 shadow-md">
                                <span
                                  className={`shrink-0 px-1 py-px ${METHOD_CLASSES[activeDragRequest.method.toLowerCase()] ?? 'text-info'}`}
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
