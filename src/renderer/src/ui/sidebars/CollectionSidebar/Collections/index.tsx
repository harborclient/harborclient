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
import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { Collection, CollectionDocument, Folder, SavedRequest } from '#/shared/types';
import { useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveDocumentId,
  selectCollections,
  selectDocumentsByCollection,
  selectDraft,
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectSelectedCollectionId,
  selectSelectedFolderId
} from '#/renderer/src/store/selectors';
import { useSidebarExpansion } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarExpansion';
import { useSidebarProviders } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarProvidersContext';
import { useSidebarGit } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarGitContext';
import { useSidebarSearchContext } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarSearchContext';
import { useCollectionActions } from '#/renderer/src/ui/sidebars/CollectionSidebar/useCollectionActions';
import { FaIcon } from '@harborclient/sdk/components';
import { RowActionsMenu } from '@harborclient/sdk/components';
import { buildReorderMenuGroup } from '@harborclient/sdk/components';
import { usePluginContextMenuItems } from '#/renderer/src/plugins/pluginHooks';
import { buildPluginContextMenuGroups } from '#/renderer/src/plugins/pluginContextMenuHelpers';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
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
import {
  collectionCollisionDetection,
  collectionDragId,
  dropFolderId,
  dropRootId,
  dropTargetHighlightClass,
  folderDragId,
  parseCollectionDragId,
  parseDragId,
  requestDragId,
  resolveRequestDropTarget,
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
  const collections = useAppSelector(selectCollections);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const documentsByCollection = useAppSelector(selectDocumentsByCollection);
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const selectedFolderId = useAppSelector(selectSelectedFolderId);
  const draft = useAppSelector(selectDraft);
  const activeRequestId = draft.id;
  const activeDocumentId = useAppSelector(selectActiveDocumentId);
  const {
    expandedCollectionIds,
    expandedFolderIds,
    setExpandedCollectionIds,
    setExpandedFolderIds,
    showStorageLocationBadges
  } = useSidebarExpansion();
  const { primaryConnectionId, connectionNamesById, connectionTypesById } = useSidebarProviders();
  const { gitStatusesByConnectionId, openSourceControl: onOpenSourceControl } = useSidebarGit();
  const { searchFilter, searchActive } = useSidebarSearchContext();
  const {
    onExpandCollection,
    onSelectCollection,
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
    onReorderRequests,
    onMoveRequest,
    onLoadRequest,
    onLoadDocument,
    onRenameDocument,
    onDeleteDocument,
    onReorderDocuments,
    onDeleteRequest,
    onDuplicateRequest,
    onExportRequest
  } = useCollectionActions();
  const confirm = useConfirm();
  const pluginContextMenuItems = usePluginContextMenuItems();
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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
  const activeDragKindRef = useRef<DragKind | null>(null);
  const dragCollectionIdRef = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /**
   * Clears drag state for request-row dragging.
   */
  const clearDragState = (): void => {
    activeDragKindRef.current = null;
    dragCollectionIdRef.current = null;
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
   * Gets the root requests for a collection.
   *
   * @param collectionId The collection id to get the root requests for.
   * @returns The root requests for the collection.
   */
  const getRootRequests = (collectionId: number): SavedRequest[] =>
    (requestsByCollection[collectionId] ?? []).filter((req) => req.folder_id == null);

  /**
   * Gets the requests for a folder.
   *
   * @param collectionId The collection id to get the requests for.
   * @param folderId The folder id to get the requests for.
   * @returns The requests for the folder.
   */
  const getFolderRequests = (collectionId: number, folderId: number): SavedRequest[] => {
    const requests = (requestsByCollection[collectionId] ?? []).filter(
      (req) => req.folder_id === folderId
    );
    if (searchFilter == null) {
      return requests;
    }
    return requests.filter((req) => searchFilter.requestIds.has(req.id));
  };

  /**
   * Gets the root markdown documents for a collection.
   *
   * @param collectionId The collection id to get root documents for.
   * @returns Root documents for the collection.
   */
  const getRootDocuments = (collectionId: number): CollectionDocument[] =>
    (documentsByCollection[collectionId] ?? []).filter((doc) => doc.folder_id == null);

  /**
   * Gets the markdown documents for a folder.
   *
   * @param collectionId The collection id to get documents for.
   * @param folderId The folder id to get documents for.
   * @returns Documents for the folder.
   */
  const getFolderDocuments = (collectionId: number, folderId: number): CollectionDocument[] =>
    (documentsByCollection[collectionId] ?? []).filter((doc) => doc.folder_id === folderId);

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
   * Moves a request one position up or down within its folder or collection root list.
   *
   * @param collectionId The owning collection id.
   * @param folderId The request's folder id, or null for collection root.
   * @param requestId The request to move.
   * @param direction Whether to move toward the top or bottom of the list.
   */
  const moveRequestInList = async (
    collectionId: number,
    folderId: number | null,
    requestId: number,
    direction: 'up' | 'down'
  ): Promise<void> => {
    const list =
      folderId == null ? getRootRequests(collectionId) : getFolderRequests(collectionId, folderId);
    const ids = list.map((req) => req.id);
    const index = ids.findIndex((id) => id === requestId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ids.length) return;
    await onReorderRequests(collectionId, folderId, arrayMove(ids, index, targetIndex));
  };

  /**
   * Moves a document one position up or down within its folder or collection root list.
   *
   * @param collectionId The owning collection id.
   * @param folderId The document's folder id, or null for collection root.
   * @param documentId The document to move.
   * @param direction Whether to move toward the top or bottom of the list.
   */
  const moveDocumentInList = async (
    collectionId: number,
    folderId: number | null,
    documentId: number,
    direction: 'up' | 'down'
  ): Promise<void> => {
    const list =
      folderId == null
        ? getRootDocuments(collectionId)
        : getFolderDocuments(collectionId, folderId);
    const ids = list.map((doc) => doc.id);
    const index = ids.findIndex((id) => id === documentId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ids.length) return;
    await onReorderDocuments(collectionId, folderId, arrayMove(ids, index, targetIndex));
  };

  /**
   * Precomputes per-collection folder and root-request groupings for rendering.
   */
  const collectionTrees = useMemo(() => {
    const trees = collections.map((collection) => {
      const folders = foldersByCollection[collection.id] ?? [];
      let rootRequests = (requestsByCollection[collection.id] ?? []).filter(
        (req) => req.folder_id == null
      );
      const rootDocuments = (documentsByCollection[collection.id] ?? []).filter(
        (doc) => doc.folder_id == null
      );

      if (searchFilter != null) {
        rootRequests = rootRequests.filter((req) => searchFilter.requestIds.has(req.id));
      }

      return {
        collection,
        folders:
          searchFilter == null
            ? folders
            : folders.filter((folder) => searchFilter.folderIds.has(folder.id)),
        rootRequests,
        rootDocuments
      };
    });

    if (searchFilter == null) {
      return trees;
    }

    return trees.filter(({ collection }) => searchFilter.collectionIds.has(collection.id));
  }, [collections, foldersByCollection, requestsByCollection, documentsByCollection, searchFilter]);

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
    clearCollectionDragState();
    if (!over) return;

    const activeId = parseCollectionDragId(String(active.id));
    const overId = parseCollectionDragId(String(over.id));
    if (activeId == null || overId == null || activeId === overId) return;

    const ids = collections.map((collection) => collection.id);
    const oldIndex = ids.findIndex((id) => id === activeId);
    const newIndex = ids.findIndex((id) => id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextOrder = arrayMove(ids, oldIndex, newIndex);
    await onReorderCollections(nextOrder);
  };

  /**
   * Handles the end of a request drag-and-drop operation.
   *
   * @param event The drag end event.
   * @param collectionId The collection id to handle the drag end for.
   */
  const handleDragEnd = async (event: DragEndEvent, collectionId: number): Promise<void> => {
    const { active, over } = event;
    clearDragState();
    if (!over) return;

    const activeParsed = parseDragId(String(active.id));
    if (!activeParsed) return;

    if (activeParsed.kind === 'folder') {
      const folders = foldersByCollection[collectionId] ?? [];
      const overParsed = parseDragId(String(over.id));
      if (!overParsed || overParsed.kind !== 'folder') return;
      const oldIndex = folders.findIndex((folder) => folder.id === activeParsed.id);
      const newIndex = folders.findIndex((folder) => folder.id === overParsed.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const nextOrder = arrayMove(
        folders.map((folder) => folder.id),
        oldIndex,
        newIndex
      );
      await onReorderFolders(collectionId, nextOrder);
      return;
    }

    const allRequests = requestsByCollection[collectionId] ?? [];
    const activeRequest = allRequests.find((req) => req.id === activeParsed.id);
    if (!activeRequest) return;

    const sourceFolderId = activeRequest.folder_id ?? null;
    const resolvedTarget = resolveRequestDropTarget(String(over.id), allRequests);
    if (resolvedTarget === undefined) return;

    const targetFolderId = resolvedTarget;
    const targetList =
      targetFolderId == null
        ? getRootRequests(collectionId)
        : getFolderRequests(collectionId, targetFolderId);

    const overParsed = parseDragId(String(over.id));
    let targetIndex: number;
    if (overParsed?.kind === 'request') {
      targetIndex = targetList.findIndex((req) => req.id === overParsed.id);
      if (targetIndex < 0) return;
    } else {
      targetIndex = targetList.filter((req) => req.id !== activeParsed.id).length;
    }

    if (sourceFolderId === targetFolderId) {
      const list =
        sourceFolderId == null
          ? getRootRequests(collectionId)
          : getFolderRequests(collectionId, sourceFolderId);
      const oldIndex = list.findIndex((req) => req.id === activeParsed.id);
      if (oldIndex < 0 || targetIndex < 0) return;
      const nextOrder = arrayMove(
        list.map((req) => req.id),
        oldIndex,
        targetIndex
      );
      await onReorderRequests(collectionId, sourceFolderId, nextOrder);
      return;
    }

    await onMoveRequest(collectionId, activeParsed.id, targetFolderId, targetIndex);
  };

  /**
   * Handles the over of a request drag-and-drop operation.
   *
   * @param event The drag over event.
   * @param collectionId The collection id to handle the drag over for.
   */
  const handleDragOver = (event: DragOverEvent, collectionId: number): void => {
    if (activeDragKindRef.current !== 'request' || dragCollectionIdRef.current !== collectionId) {
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
   * Handles the start of a request drag-and-drop operation.
   *
   * @param event The drag start event.
   * @param collectionId The collection id to handle the drag start for.
   */
  const handleDragStart = (event: DragStartEvent, collectionId: number): void => {
    const parsed = parseDragId(String(event.active.id));
    if (!parsed) return;

    setDragCollectionId(collectionId);
    dragCollectionIdRef.current = collectionId;
    setDropTargetFolderId(undefined);

    if (parsed.kind === 'folder') {
      const folder = (foldersByCollection[collectionId] ?? []).find(
        (item) => item.id === parsed.id
      );
      activeDragKindRef.current = 'folder';
      setActiveDragKind('folder');
      setActiveDragFolder(folder ?? null);
      setActiveDragRequest(null);
      return;
    }

    const request = (requestsByCollection[collectionId] ?? []).find(
      (item) => item.id === parsed.id
    );
    activeDragKindRef.current = 'request';
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
      <div className="sidebar-source-list flex flex-col gap-0">
        {collections.length === 0 && (
          <div className="px-2 py-1.5 text-[16px] text-muted">No collections yet</div>
        )}
        {searchActive && collections.length > 0 && collectionTrees.length === 0 && (
          <div className="px-2 py-1.5 text-[16px] text-muted">
            No matching collections or requests
          </div>
        )}

        <SortableContext items={collectionIds} strategy={verticalListSortingStrategy}>
          {collectionTrees.map(
            ({ collection, folders, rootRequests, rootDocuments }, collectionIndex) => {
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
              const canShare =
                connectionType != null && connectionType !== 'sqlite' && connectionType !== 'git';
              const folderIds = folders.map((folder) => folderDragId(folder.id));
              const rootRequestIds = rootRequests.map((req) => requestDragId(req.id));
              const isRequestDragInCollection =
                activeDragKind === 'request' &&
                dragCollectionId === collection.id &&
                dropTargetFolderId !== undefined;
              const isDraggingRequestHere =
                activeDragKind === 'request' && dragCollectionId === collection.id;
              const rootDropHighlight =
                isRequestDragInCollection && dropTargetFolderId === null
                  ? dropTargetHighlightClass
                  : undefined;

              return (
                <div key={collection.id}>
                  <SortableRow
                    id={collectionDragId(collection.id)}
                    className={sourceRow(selected, true)}
                    dragHandleLabel={`Reorder collection "${collection.name}"`}
                    disabled={searchActive}
                    compact
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
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Collapse' : 'Expand'}
                    >
                      <FaIcon
                        icon={expanded ? faChevronDown : faChevronRight}
                        className="h-3 w-3"
                      />
                    </button>
                    <button
                      type="button"
                      className="min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent py-0 text-left text-[16px] text-inherit app-no-drag"
                      data-sidebar-collection-id={collection.id}
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => onSelectCollection(collection.id)}
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
                        {showStorageLocationBadges && connectionName != null && (
                          <span
                            className="shrink-0 rounded bg-info/15 px-1.5 py-0.5 text-[11px] font-medium text-info"
                            title={`Stored in ${connectionName}`}
                          >
                            {connectionName}
                          </span>
                        )}
                      </span>
                    </button>
                    {connectionType === 'git' &&
                      gitStatus != null &&
                      gitStatus.changedCount > 0 && (
                        <button
                          type="button"
                          className="shrink-0 cursor-pointer rounded bg-warning/20 px-1.5 py-0.5 text-[16px] font-medium text-warning hover:bg-warning/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent app-no-drag"
                          aria-label={`Open source control (${gitStatus.changedCount} uncommitted change(s))`}
                          onClick={() =>
                            onOpenSourceControl(
                              collectionConnectionId,
                              connectionName ?? 'Git repository'
                            )
                          }
                        >
                          {gitStatus.changedCount}
                        </button>
                      )}
                    <RowActionsMenu
                      menuId={`collection-${collection.id}`}
                      openMenuId={openMenuId}
                      onOpenChange={setOpenMenuId}
                      groups={[
                        [
                          {
                            label: 'Run',
                            onSelect: () => onRunCollection(collection.id, collection.name)
                          }
                        ],
                        ...buildReorderMenuGroup(collectionIndex, collections.length, (direction) =>
                          moveCollection(collection.id, direction)
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
                          { label: 'New Folder', onSelect: () => void onNewFolder(collection.id) },
                          {
                            label: 'New Request',
                            onSelect: () => void onNewRequestInCollection(collection.id)
                          },
                          {
                            label: 'New Markdown',
                            onSelect: () => void onNewDocumentInCollection(collection.id)
                          },
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
                          ...(connectionType === 'git' && connectionName != null
                            ? [
                                {
                                  label: 'Source control',
                                  onSelect: () =>
                                    onOpenSourceControl(collectionConnectionId, connectionName)
                                }
                              ]
                            : []),

                          ...(canShare
                            ? [
                                {
                                  label: 'Share access',
                                  onSelect: () => onShareCollection(collection.id, collection.name)
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
                          {
                            label: 'Delete',
                            variant: 'danger',
                            onSelect: () => {
                              void (async () => {
                                const confirmed = await confirm({
                                  title: 'Delete collection',
                                  message: `Delete collection "${collection.name}"?`,
                                  confirmLabel: 'Delete',
                                  variant: 'danger'
                                });
                                if (confirmed) {
                                  void onDeleteCollection(collection.id);
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
                  </SortableRow>

                  <AnimatedCollapse open={expanded}>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={collectionCollisionDetection}
                      onDragStart={(event) => handleDragStart(event, collection.id)}
                      onDragOver={(event) => handleDragOver(event, collection.id)}
                      onDragEnd={(event) => void handleDragEnd(event, collection.id)}
                      onDragCancel={clearDragState}
                    >
                      <div className="ml-4 flex flex-col gap-0 py-0">
                        {loaded &&
                          folders.length === 0 &&
                          rootRequests.length === 0 &&
                          rootDocuments.length === 0 && (
                            <div className="flex items-center gap-1 px-1.5 py-0">
                              <span className="inline-flex h-4 w-4 shrink-0" aria-hidden="true" />
                              <span className="text-[16px] text-muted">No saved requests</span>
                            </div>
                          )}

                        <DropZone
                          id={dropRootId(collection.id)}
                          disabled={searchActive}
                          className={
                            [
                              rootDropHighlight,
                              isDraggingRequestHere && rootRequests.length === 0
                                ? 'min-h-8'
                                : undefined
                            ]
                              .filter(Boolean)
                              .join(' ') || undefined
                          }
                        >
                          {isRequestDragInCollection && dropTargetFolderId === null && (
                            <div className="px-2 pb-0.5 text-[16px] text-info">
                              Drop at collection root
                            </div>
                          )}
                          {isDraggingRequestHere && rootRequests.length === 0 && (
                            <div className="px-2 py-1.5 text-[16px] text-muted">
                              Collection root
                            </div>
                          )}
                          <SortableContext
                            items={rootRequestIds}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="flex flex-col gap-0">
                              {rootRequests.map((req, requestIndex) => (
                                <RequestRow
                                  key={req.id}
                                  req={req}
                                  activeRequestId={activeRequestId}
                                  openMenuId={openMenuId}
                                  onOpenChange={setOpenMenuId}
                                  canMoveUp={requestIndex > 0}
                                  canMoveDown={requestIndex < rootRequests.length - 1}
                                  onMoveUp={() =>
                                    void moveRequestInList(collection.id, null, req.id, 'up')
                                  }
                                  onMoveDown={() =>
                                    void moveRequestInList(collection.id, null, req.id, 'down')
                                  }
                                  onRunRequest={() => onRunRequest(req, collection.name)}
                                  onLoadRequest={onLoadRequest}
                                  onDeleteRequest={onDeleteRequest}
                                  onDuplicateRequest={onDuplicateRequest}
                                  onExportRequest={onExportRequest}
                                  dragDisabled={searchActive}
                                />
                              ))}
                              {rootDocuments.map((doc, documentIndex) => (
                                <DocumentRow
                                  key={doc.id}
                                  doc={doc}
                                  activeDocumentId={activeDocumentId}
                                  openMenuId={openMenuId}
                                  onOpenChange={setOpenMenuId}
                                  canMoveUp={documentIndex > 0}
                                  canMoveDown={documentIndex < rootDocuments.length - 1}
                                  onMoveUp={() =>
                                    void moveDocumentInList(collection.id, null, doc.id, 'up')
                                  }
                                  onMoveDown={() =>
                                    void moveDocumentInList(collection.id, null, doc.id, 'down')
                                  }
                                  onLoadDocument={onLoadDocument}
                                  onRenameDocument={onRenameDocument}
                                  onDeleteDocument={onDeleteDocument}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DropZone>

                        <SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
                          {folders.map((folder, folderIndex) => {
                            const folderExpanded =
                              searchActive && searchFilter != null
                                ? searchFilter.folderIds.has(folder.id)
                                : expandedFolderIds.has(folder.id);
                            const folderRequests = getFolderRequests(collection.id, folder.id);
                            const folderDocuments = getFolderDocuments(collection.id, folder.id);
                            const folderRequestIds = folderRequests.map((req) =>
                              requestDragId(req.id)
                            );
                            const folderHighlighted =
                              isRequestDragInCollection && dropTargetFolderId === folder.id;
                            const folderSelected = selectedFolderId === folder.id;

                            return (
                              <div
                                key={folder.id}
                                data-sidebar-folder-id={folder.id}
                                className={folderHighlighted ? dropTargetHighlightClass : undefined}
                              >
                                <DropZone id={dropFolderId(folder.id)} disabled={searchActive}>
                                  <SortableRow
                                    id={folderDragId(folder.id)}
                                    className={sourceRow(folderSelected, true)}
                                    dragHandleLabel={`Reorder folder "${folder.name}"`}
                                    disabled={searchActive}
                                    compact
                                    onRowContextMenu={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      const menuId = `folder-${folder.id}`;
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
                                      onClick={() => toggleFolder(folder.id)}
                                      aria-expanded={folderExpanded}
                                      aria-label={
                                        folderExpanded ? 'Collapse folder' : 'Expand folder'
                                      }
                                    >
                                      <FaIcon
                                        icon={folderExpanded ? faChevronDown : faChevronRight}
                                        className="h-3 w-3"
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      className="min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent py-0 text-left text-[16px] font-medium text-inherit app-no-drag"
                                      aria-current={folderSelected ? 'true' : undefined}
                                      onClick={() => onSelectFolder(collection.id, folder.id)}
                                      onDoubleClick={() =>
                                        onConfigureFolder(collection.id, folder.id)
                                      }
                                      onKeyDown={(event) => {
                                        if (event.key !== 'Enter') return;
                                        event.preventDefault();
                                        onConfigureFolder(collection.id, folder.id);
                                        focusFolderSettings();
                                      }}
                                    >
                                      {folder.name}
                                      {folderHighlighted && (
                                        <span className="ml-1.5 text-[16px] font-normal text-info">
                                          Drop here
                                        </span>
                                      )}
                                    </button>
                                    <RowActionsMenu
                                      menuId={`folder-${folder.id}`}
                                      openMenuId={openMenuId}
                                      onOpenChange={setOpenMenuId}
                                      groups={[
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
                                        ...buildReorderMenuGroup(
                                          folderIndex,
                                          folders.length,
                                          (direction) =>
                                            moveFolder(collection.id, folder.id, direction)
                                        ),
                                        [
                                          {
                                            label: 'New Request',
                                            onSelect: () =>
                                              void onNewRequestInFolder(collection.id, folder.id)
                                          },
                                          {
                                            label: 'New Markdown',
                                            onSelect: () =>
                                              void onNewDocumentInFolder(collection.id, folder.id)
                                          },
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
                                          { collectionId: collection.id, folderId: folder.id },
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
                                                folderRequests.map((req) => req.id)
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
                                  </SortableRow>
                                </DropZone>

                                <AnimatedCollapse open={folderExpanded} className="ml-6">
                                  <div className="flex flex-col gap-0 py-0">
                                    <SortableContext
                                      items={folderRequestIds}
                                      strategy={verticalListSortingStrategy}
                                    >
                                      {folderRequests.map((req, requestIndex) => (
                                        <RequestRow
                                          key={req.id}
                                          req={req}
                                          activeRequestId={activeRequestId}
                                          openMenuId={openMenuId}
                                          onOpenChange={setOpenMenuId}
                                          canMoveUp={requestIndex > 0}
                                          canMoveDown={requestIndex < folderRequests.length - 1}
                                          onMoveUp={() =>
                                            void moveRequestInList(
                                              collection.id,
                                              folder.id,
                                              req.id,
                                              'up'
                                            )
                                          }
                                          onMoveDown={() =>
                                            void moveRequestInList(
                                              collection.id,
                                              folder.id,
                                              req.id,
                                              'down'
                                            )
                                          }
                                          onRunRequest={() => onRunRequest(req, collection.name)}
                                          onLoadRequest={onLoadRequest}
                                          onDeleteRequest={onDeleteRequest}
                                          onDuplicateRequest={onDuplicateRequest}
                                          onExportRequest={onExportRequest}
                                          dragDisabled={searchActive}
                                        />
                                      ))}
                                      {folderDocuments.map((doc, documentIndex) => (
                                        <DocumentRow
                                          key={doc.id}
                                          doc={doc}
                                          activeDocumentId={activeDocumentId}
                                          openMenuId={openMenuId}
                                          onOpenChange={setOpenMenuId}
                                          canMoveUp={documentIndex > 0}
                                          canMoveDown={documentIndex < folderDocuments.length - 1}
                                          onMoveUp={() =>
                                            void moveDocumentInList(
                                              collection.id,
                                              folder.id,
                                              doc.id,
                                              'up'
                                            )
                                          }
                                          onMoveDown={() =>
                                            void moveDocumentInList(
                                              collection.id,
                                              folder.id,
                                              doc.id,
                                              'down'
                                            )
                                          }
                                          onLoadDocument={onLoadDocument}
                                          onRenameDocument={onRenameDocument}
                                          onDeleteDocument={onDeleteDocument}
                                        />
                                      ))}
                                    </SortableContext>
                                    {folderRequests.length === 0 &&
                                      folderDocuments.length === 0 && (
                                        <div className="flex items-center gap-1 px-1.5 py-0">
                                          <span
                                            className="inline-flex h-4 w-4 shrink-0"
                                            aria-hidden="true"
                                          />
                                          <span className="text-[16px] text-muted">
                                            Empty folder
                                          </span>
                                        </div>
                                      )}
                                  </div>
                                </AnimatedCollapse>
                              </div>
                            );
                          })}
                        </SortableContext>
                      </div>

                      <DragOverlay>
                        {dragCollectionId === collection.id &&
                        activeDragKind === 'request' &&
                        activeDragRequest ? (
                          <div className="flex items-center gap-1.5 rounded border border-separator bg-surface px-2 py-1 shadow-md">
                            <span
                              className={`shrink-0 px-1 py-px text-[16px] ${METHOD_CLASSES[activeDragRequest.method.toLowerCase()] ?? 'text-info'}`}
                            >
                              {activeDragRequest.method}
                            </span>
                            <span className="truncate text-[16px]">{activeDragRequest.name}</span>
                          </div>
                        ) : dragCollectionId === collection.id &&
                          activeDragKind === 'folder' &&
                          activeDragFolder ? (
                          <div className="rounded border border-separator bg-surface px-2 py-1 text-[16px] font-medium shadow-md">
                            {activeDragFolder.name}
                          </div>
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  </AnimatedCollapse>
                </div>
              );
            }
          )}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeDragCollection ? (
          <div className="rounded border border-separator bg-surface px-2 py-1 text-[16px] font-medium shadow-md">
            {activeDragCollection.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
