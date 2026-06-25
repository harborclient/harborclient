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
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type JSX,
  type SetStateAction
} from 'react';
import type {
  Collection,
  CollectionProviderKind,
  Folder,
  SavedRequest,
  SourceControlStatus
} from '#/shared/types';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { RowActionsMenu } from '#/renderer/src/components/RowActionsMenu';
import { buildReorderMenuGroup } from '#/renderer/src/components/rowActionsMenuHelpers';
import { usePluginContextMenuItems } from '#/renderer/src/plugins/pluginHooks';
import { buildPluginContextMenuGroups } from '#/renderer/src/plugins/pluginContextMenuHelpers';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { faChevronDown, faChevronRight } from '#/renderer/src/fontawesome';
import { METHOD_CLASSES, sourceRow } from '#/renderer/src/ui/shared/classes';
import { DropZone } from '#/renderer/src/ui/Sidebar/Collections/DropZone';
import { RequestRow } from '#/renderer/src/ui/Sidebar/Collections/RequestRow';
import { SortableRow } from '#/renderer/src/ui/Sidebar/Collections/SortableRow';
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
} from '#/renderer/src/ui/Sidebar/Collections/utils';

interface Props {
  /**
   * Collections shown in the sidebar, in display order.
   */
  collections: Collection[];

  /**
   * Folders grouped by collection id.
   */
  foldersByCollection: Record<number, Folder[]>;

  /**
   * Saved requests grouped by collection id.
   */
  requestsByCollection: Record<number, SavedRequest[]>;

  /**
   * Currently selected collection id, if any.
   */
  selectedCollectionId: number | null;

  /**
   * Currently selected folder id, if any.
   */
  selectedFolderId: number | null;

  /**
   * Default connection id used when a collection has no explicit connection.
   */
  primaryConnectionId: string;

  /**
   * Human-readable connection names keyed by connection id.
   */
  connectionNamesById: Record<string, string>;

  /**
   * Database provider types keyed by connection id.
   */
  connectionTypesById: Record<string, CollectionProviderKind>;

  /**
   * Git source-control status keyed by connection id.
   */
  gitStatusesByConnectionId: Record<string, SourceControlStatus>;

  /**
   * Opens the in-app source-control panel for a git connection.
   */
  onOpenSourceControl: (connectionId: string, connectionName: string) => void;

  /**
   * Id of the request currently open in the editor, for row highlighting.
   */
  activeRequestId?: number;

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
   * Called when the user selects a collection row.
   */
  onSelectCollection: (id: number) => void;

  /**
   * Called when the user selects a folder row.
   */
  onSelectFolder: (collectionId: number, folderId: number) => void;

  /**
   * Called when a collection is expanded so its contents can be loaded.
   */
  onExpandCollection: (id: number) => void;

  /**
   * Called when the user opens collection settings.
   */
  onConfigureCollection: (id: number) => void;

  /**
   * Opens the collection runner for an entire collection.
   */
  onRunCollection: (collectionId: number, collectionName: string) => void;

  /**
   * Opens the collection runner scoped to one folder.
   */
  onRunFolder: (
    collectionId: number,
    folderId: number,
    collectionName: string,
    folderName: string
  ) => void;

  /**
   * Deletes a collection after user confirmation.
   */
  onDeleteCollection: (id: number) => Promise<void>;

  /**
   * Exports a collection to disk.
   */
  onExportCollection: (id: number) => Promise<void> | void;

  /**
   * Duplicates a collection and its contents.
   */
  onDuplicateCollection: (id: number) => Promise<void> | void;

  /**
   * Opens the share flow for a shared collection.
   */
  onShareCollection: (collectionId: number, collectionName: string) => void;

  /**
   * Creates a new folder in the given collection.
   */
  onNewFolder: (collectionId: number) => Promise<void> | void;

  /**
   * Creates a new request at the collection root.
   */
  onNewRequestInCollection: (id: number) => Promise<void> | void;

  /**
   * Imports a request from a JSON file into a collection or folder.
   */
  onImportRequest: (collectionId: number, folderId?: number | null) => Promise<void> | void;

  /**
   * Creates a new request inside a folder.
   */
  onNewRequestInFolder: (collectionId: number, folderId: number) => Promise<void> | void;

  /**
   * Renames a folder within a collection.
   */
  onRenameFolder: (id: number, collectionId: number) => Promise<void> | void;

  /**
   * Deletes a folder and any requests it contains.
   */
  onDeleteFolder: (id: number, collectionId: number, requestIds: number[]) => Promise<void> | void;

  /**
   * Persists a new top-level collection order after drag-and-drop.
   */
  onReorderCollections: (orderedCollectionIds: number[]) => Promise<void> | void;

  /**
   * Persists a new folder order within a collection after drag-and-drop.
   */
  onReorderFolders: (collectionId: number, orderedFolderIds: number[]) => Promise<void> | void;

  /**
   * Persists a new request order within a folder or collection root.
   */
  onReorderRequests: (
    collectionId: number,
    folderId: number | null,
    orderedRequestIds: number[]
  ) => Promise<void> | void;

  /**
   * Moves a request to another folder or collection root at the given index.
   */
  onMoveRequest: (
    collectionId: number,
    requestId: number,
    folderId: number | null,
    index: number
  ) => Promise<void> | void;

  /**
   * Loads a saved request into the editor.
   */
  onLoadRequest: (req: SavedRequest) => void;

  /**
   * Deletes a saved request.
   */
  onDeleteRequest: (id: number) => Promise<void>;

  /**
   * Duplicates a saved request.
   */
  onDuplicateRequest: (req: SavedRequest) => Promise<void>;

  /**
   * Exports a saved request to a JSON file.
   */
  onExportRequest: (req: SavedRequest) => Promise<void> | void;
}

/**
 * Collections list with expandable folders and drag-and-drop organization.
 */
export function Collections({
  collections,
  foldersByCollection,
  requestsByCollection,
  selectedCollectionId,
  selectedFolderId,
  primaryConnectionId,
  connectionNamesById,
  connectionTypesById,
  gitStatusesByConnectionId,
  onOpenSourceControl,
  activeRequestId,
  expandedCollectionIds,
  expandedFolderIds,
  setExpandedCollectionIds,
  setExpandedFolderIds,
  onSelectCollection,
  onSelectFolder,
  onExpandCollection,
  onConfigureCollection,
  onRunCollection,
  onRunFolder,
  onDeleteCollection,
  onExportCollection,
  onDuplicateCollection,
  onShareCollection,
  onNewFolder,
  onNewRequestInCollection,
  onImportRequest,
  onNewRequestInFolder,
  onRenameFolder,
  onDeleteFolder,
  onReorderCollections,
  onReorderFolders,
  onReorderRequests,
  onMoveRequest,
  onLoadRequest,
  onDeleteRequest,
  onDuplicateRequest,
  onExportRequest
}: Props): JSX.Element {
  const confirm = useConfirm();
  const pluginContextMenuItems = usePluginContextMenuItems();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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
  const getFolderRequests = (collectionId: number, folderId: number): SavedRequest[] =>
    (requestsByCollection[collectionId] ?? []).filter((req) => req.folder_id === folderId);

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
   * Precomputes per-collection folder and root-request groupings for rendering.
   */
  const collectionTrees = useMemo(
    () =>
      collections.map((collection) => {
        const folders = foldersByCollection[collection.id] ?? [];
        const rootRequests = (requestsByCollection[collection.id] ?? []).filter(
          (req) => req.folder_id == null
        );
        return { collection, folders, rootRequests };
      }),
    [collections, foldersByCollection, requestsByCollection]
  );

  /**
   * Stable sortable ids for top-level collection rows.
   */
  const collectionIds = useMemo(
    () => collections.map((collection) => collectionDragId(collection.id)),
    [collections]
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
      <div className="flex flex-col gap-0.5">
        {collections.length === 0 && (
          <div className="px-2 py-1.5 text-[14px] text-muted">No collections yet</div>
        )}

        <SortableContext items={collectionIds} strategy={verticalListSortingStrategy}>
          {collectionTrees.map(({ collection, folders, rootRequests }, collectionIndex) => {
            const expanded = expandedCollectionIds.has(collection.id);
            const selected = selectedCollectionId === collection.id;
            const loaded =
              requestsByCollection[collection.id] != null &&
              foldersByCollection[collection.id] != null;
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
                  className={sourceRow(selected)}
                  dragHandleLabel={`Reorder collection "${collection.name}"`}
                >
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:text-text app-no-drag"
                    onClick={() => toggleCollection(collection.id)}
                    aria-expanded={expanded}
                    aria-label={expanded ? 'Collapse' : 'Expand'}
                  >
                    <FaIcon icon={expanded ? faChevronDown : faChevronRight} className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent py-0.5 text-left text-[14px] text-inherit app-no-drag"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => onSelectCollection(collection.id)}
                    onDoubleClick={() => onConfigureCollection(collection.id)}
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{collection.name}</span>
                      {connectionName != null && (
                        <span
                          className="shrink-0 rounded bg-info/15 px-1.5 py-0.5 text-[14px] font-medium text-info"
                          title={`Stored in ${connectionName}`}
                        >
                          {connectionName}
                        </span>
                      )}
                    </span>
                  </button>
                  {connectionType === 'git' && gitStatus != null && gitStatus.changedCount > 0 && (
                    <button
                      type="button"
                      className="shrink-0 cursor-pointer rounded bg-warning/20 px-1.5 py-0.5 text-[14px] font-medium text-warning hover:bg-warning/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent app-no-drag"
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
                      ...buildReorderMenuGroup(collectionIndex, collections.length, (direction) =>
                        moveCollection(collection.id, direction)
                      ),
                      [
                        {
                          label: 'Run',
                          onSelect: () => onRunCollection(collection.id, collection.name)
                        }
                      ],
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
                          label: 'Import',
                          onSelect: () => void onImportRequest(collection.id)
                        },
                        {
                          label: 'Export',
                          onSelect: () => void onExportCollection(collection.id)
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
                      ]
                    ]}
                  />
                </SortableRow>

                {expanded && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={collectionCollisionDetection}
                    onDragStart={(event) => handleDragStart(event, collection.id)}
                    onDragOver={(event) => handleDragOver(event, collection.id)}
                    onDragEnd={(event) => void handleDragEnd(event, collection.id)}
                    onDragCancel={clearDragState}
                  >
                    <div className="ml-4 flex flex-col gap-0.5 py-0.5">
                      {loaded && folders.length === 0 && rootRequests.length === 0 && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5">
                          <span className="inline-flex h-5 w-5 shrink-0" aria-hidden="true" />
                          <span className="text-[14px] text-muted">No saved requests</span>
                        </div>
                      )}

                      <DropZone
                        id={dropRootId(collection.id)}
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
                          <div className="px-2 pb-0.5 text-[14px] text-info">
                            Drop at collection root
                          </div>
                        )}
                        {isDraggingRequestHere && rootRequests.length === 0 && (
                          <div className="px-2 py-1.5 text-[14px] text-muted">Collection root</div>
                        )}
                        <SortableContext
                          items={rootRequestIds}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="flex flex-col gap-0.5">
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
                                onLoadRequest={onLoadRequest}
                                onDeleteRequest={onDeleteRequest}
                                onDuplicateRequest={onDuplicateRequest}
                                onExportRequest={onExportRequest}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DropZone>

                      <SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
                        {folders.map((folder, folderIndex) => {
                          const folderExpanded = expandedFolderIds.has(folder.id);
                          const folderRequests = getFolderRequests(collection.id, folder.id);
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
                              <DropZone id={dropFolderId(folder.id)}>
                                <SortableRow
                                  id={folderDragId(folder.id)}
                                  className={sourceRow(folderSelected)}
                                  dragHandleLabel={`Reorder folder "${folder.name}"`}
                                >
                                  <button
                                    type="button"
                                    className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:text-text app-no-drag"
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
                                    className="min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent py-0.5 text-left text-[14px] font-medium text-inherit app-no-drag"
                                    aria-current={folderSelected ? 'true' : undefined}
                                    onClick={() => onSelectFolder(collection.id, folder.id)}
                                  >
                                    {folder.name}
                                    {folderHighlighted && (
                                      <span className="ml-1.5 text-[14px] font-normal text-info">
                                        Drop here
                                      </span>
                                    )}
                                  </button>
                                  <RowActionsMenu
                                    menuId={`folder-${folder.id}`}
                                    openMenuId={openMenuId}
                                    onOpenChange={setOpenMenuId}
                                    groups={[
                                      ...buildReorderMenuGroup(
                                        folderIndex,
                                        folders.length,
                                        (direction) =>
                                          moveFolder(collection.id, folder.id, direction)
                                      ),
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
                                      [
                                        {
                                          label: 'New Request',
                                          onSelect: () =>
                                            void onNewRequestInFolder(collection.id, folder.id)
                                        },
                                        {
                                          label: 'Import Request',
                                          onSelect: () =>
                                            void onImportRequest(collection.id, folder.id)
                                        }
                                      ],
                                      [
                                        {
                                          label: 'Rename',
                                          onSelect: () =>
                                            void onRenameFolder(folder.id, collection.id)
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
                                      ]
                                    ]}
                                  />
                                </SortableRow>
                              </DropZone>

                              {folderExpanded && (
                                <div className="ml-6 flex flex-col gap-0.5 py-0.5">
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
                                        onLoadRequest={onLoadRequest}
                                        onDeleteRequest={onDeleteRequest}
                                        onDuplicateRequest={onDuplicateRequest}
                                        onExportRequest={onExportRequest}
                                      />
                                    ))}
                                  </SortableContext>
                                  {folderRequests.length === 0 && (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5">
                                      <span
                                        className="inline-flex h-5 w-5 shrink-0"
                                        aria-hidden="true"
                                      />
                                      <span className="text-[14px] text-muted">Empty folder</span>
                                    </div>
                                  )}
                                </div>
                              )}
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
                            className={`shrink-0 px-1 py-px text-[14px] ${METHOD_CLASSES[activeDragRequest.method.toLowerCase()] ?? 'text-info'}`}
                          >
                            {activeDragRequest.method}
                          </span>
                          <span className="truncate text-[14px]">{activeDragRequest.name}</span>
                        </div>
                      ) : dragCollectionId === collection.id &&
                        activeDragKind === 'folder' &&
                        activeDragFolder ? (
                        <div className="rounded border border-separator bg-surface px-2 py-1 text-[14px] font-medium shadow-md">
                          {activeDragFolder.name}
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                )}
              </div>
            );
          })}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeDragCollection ? (
          <div className="rounded border border-separator bg-surface px-2 py-1 text-[14px] font-medium shadow-md">
            {activeDragCollection.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
