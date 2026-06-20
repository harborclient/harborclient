import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type ReactNode
} from 'react';
import type { Collection, DatabaseProvider, Folder, SavedRequest } from '#/shared/types';
import { RowActionsMenu } from '#/renderer/src/components/RowActionsMenu';
import { METHOD_CLASSES, sourceRow } from '#/renderer/src/ui/shared/classes';

interface Props {
  collections: Collection[];
  foldersByCollection: Record<number, Folder[]>;
  requestsByCollection: Record<number, SavedRequest[]>;
  selectedCollectionId: number | null;
  primaryConnectionId: string;
  connectionNamesById: Record<string, string>;
  connectionTypesById: Record<string, DatabaseProvider>;
  activeRequestId?: number;
  onSelectCollection: (id: number) => void;
  onExpandCollection: (id: number) => void;
  onConfigureCollection: (id: number) => void;
  onDeleteCollection: (id: number) => Promise<void>;
  onExportCollection: (id: number) => Promise<void> | void;
  onDuplicateCollection: (id: number) => Promise<void> | void;
  onInviteCollection: (collectionId: number, collectionName: string) => void;
  onNewFolder: (collectionId: number) => Promise<void> | void;
  onNewRequestInCollection: (id: number) => Promise<void> | void;
  onNewRequestInFolder: (collectionId: number, folderId: number) => Promise<void> | void;
  onRenameFolder: (id: number, collectionId: number) => Promise<void> | void;
  onDeleteFolder: (id: number, collectionId: number, requestIds: number[]) => Promise<void> | void;
  onReorderCollections: (orderedCollectionIds: number[]) => Promise<void> | void;
  onReorderFolders: (collectionId: number, orderedFolderIds: number[]) => Promise<void> | void;
  onReorderRequests: (
    collectionId: number,
    folderId: number | null,
    orderedRequestIds: number[]
  ) => Promise<void> | void;
  onMoveRequest: (
    collectionId: number,
    requestId: number,
    folderId: number | null,
    index: number
  ) => Promise<void> | void;
  onLoadRequest: (req: SavedRequest) => void;
  onDeleteRequest: (id: number) => Promise<void>;
  onDuplicateRequest: (req: SavedRequest) => Promise<void>;
}

type DragKind = 'folder' | 'request';

interface ParsedDragId {
  kind: DragKind;
  id: number;
}

function collectionDragId(collectionId: number): string {
  return `collection:${collectionId}`;
}

function folderDragId(folderId: number): string {
  return `folder:${folderId}`;
}

function requestDragId(requestId: number): string {
  return `request:${requestId}`;
}

function dropRootId(collectionId: number): string {
  return `drop:root:${collectionId}`;
}

function dropFolderId(folderId: number): string {
  return `drop:folder:${folderId}`;
}

function parseDragId(value: string): ParsedDragId | null {
  const [kind, idValue] = value.split(':');
  if (kind !== 'folder' && kind !== 'request') return null;
  const id = Number(idValue);
  if (!Number.isFinite(id)) return null;
  return { kind, id };
}

/**
 * Parses a collection drag id into its numeric collection id.
 *
 * @returns The collection id, or null when the value is not a collection drag id.
 */
function parseCollectionDragId(value: string): number | null {
  if (!value.startsWith('collection:')) return null;
  const id = Number(value.slice('collection:'.length));
  return Number.isFinite(id) ? id : null;
}

function parseDropTarget(value: string): { folderId: number | null; collectionId?: number } | null {
  if (value.startsWith('drop:root:')) {
    return { folderId: null, collectionId: Number(value.slice('drop:root:'.length)) };
  }
  if (value.startsWith('drop:folder:')) {
    return { folderId: Number(value.slice('drop:folder:'.length)) };
  }
  return null;
}

/**
 * Resolves which folder container a request would drop into from the current over id.
 *
 * @returns folder id, null for collection root, or undefined when not a valid target.
 */
function resolveRequestDropTarget(
  overId: string,
  requests: SavedRequest[]
): number | null | undefined {
  const overDrop = parseDropTarget(overId);
  if (overDrop) return overDrop.folderId;

  const parsed = parseDragId(overId);
  if (!parsed) return undefined;

  if (parsed.kind === 'folder') return parsed.id;

  if (parsed.kind === 'request') {
    const request = requests.find((req) => req.id === parsed.id);
    if (!request) return undefined;
    return request.folder_id ?? null;
  }

  return undefined;
}

const dropTargetHighlightClass = 'rounded-md ring-2 ring-info/60 bg-info/10';

/** Prefer explicit drop zones when the pointer is inside them. */
const collectionCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    const dropTarget = pointerCollisions.find((collision) =>
      String(collision.id).startsWith('drop:')
    );
    if (dropTarget) return [dropTarget];
  }
  return closestCenter(args);
};

interface SortableRowProps {
  id: string;
  className: string;
  children: ReactNode;
}

function SortableRow({ id, className, children }: SortableRowProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined
  };

  return (
    <div ref={setNodeRef} style={style} className={className} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

interface DropZoneProps {
  id: string;
  className?: string;
  children: ReactNode;
}

function DropZone({ id, className, children }: DropZoneProps): JSX.Element {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
}

interface RequestRowProps {
  req: SavedRequest;
  activeRequestId?: number;
  openMenuId: string | null;
  onOpenChange: (menuId: string | null) => void;
  folders: Folder[];
  onLoadRequest: (req: SavedRequest) => void;
  onDeleteRequest: (id: number) => Promise<void>;
  onDuplicateRequest: (req: SavedRequest) => Promise<void>;
  onMoveRequest: (requestId: number, folderId: number | null) => void;
}

function RequestRow({
  req,
  activeRequestId,
  openMenuId,
  onOpenChange,
  folders,
  onLoadRequest,
  onDeleteRequest,
  onDuplicateRequest,
  onMoveRequest
}: RequestRowProps): JSX.Element {
  const moveItems =
    folders.length > 0
      ? [
          {
            label: 'Move to collection root',
            onSelect: () => onMoveRequest(req.id, null)
          },
          ...folders.map((folder) => ({
            label: `Move to ${folder.name}`,
            onSelect: () => onMoveRequest(req.id, folder.id)
          }))
        ]
      : [];

  return (
    <SortableRow id={requestDragId(req.id)} className={sourceRow(activeRequestId === req.id)}>
      <button
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0.5 text-left text-inherit app-no-drag"
        onClick={() => onLoadRequest(req)}
      >
        <span
          className={`shrink-0 rounded px-1 py-px text-[10px] font-semibold ${METHOD_CLASSES[req.method.toLowerCase()] ?? 'bg-info text-white'}`}
        >
          {req.method}
        </span>
        <span className="truncate text-[13px]">{req.name}</span>
      </button>
      <RowActionsMenu
        menuId={`request-${req.id}`}
        openMenuId={openMenuId}
        onOpenChange={onOpenChange}
        items={[
          ...moveItems,
          {
            label: 'Duplicate',
            onSelect: () => void onDuplicateRequest(req)
          },
          {
            label: 'Delete',
            variant: 'danger' as const,
            onSelect: () => {
              if (confirm(`Delete request "${req.name}"?`)) {
                void onDeleteRequest(req.id);
              }
            }
          }
        ]}
      />
    </SortableRow>
  );
}

/**
 * Collections list with expandable folders and drag-and-drop organization.
 */
export function Collections({
  collections,
  foldersByCollection,
  requestsByCollection,
  selectedCollectionId,
  primaryConnectionId,
  connectionNamesById,
  connectionTypesById,
  activeRequestId,
  onSelectCollection,
  onExpandCollection,
  onConfigureCollection,
  onDeleteCollection,
  onExportCollection,
  onDuplicateCollection,
  onInviteCollection,
  onNewFolder,
  onNewRequestInCollection,
  onNewRequestInFolder,
  onRenameFolder,
  onDeleteFolder,
  onReorderCollections,
  onReorderFolders,
  onReorderRequests,
  onMoveRequest,
  onLoadRequest,
  onDeleteRequest,
  onDuplicateRequest
}: Props): JSX.Element {
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<Set<number>>(new Set());
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [prevSelectedId, setPrevSelectedId] = useState<number | null>(null);
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  if (selectedCollectionId !== prevSelectedId) {
    setPrevSelectedId(selectedCollectionId);
    if (selectedCollectionId != null && !expandedCollectionIds.has(selectedCollectionId)) {
      const next = new Set(expandedCollectionIds);
      next.add(selectedCollectionId);
      setExpandedCollectionIds(next);
    }
  }

  useEffect(() => {
    if (selectedCollectionId == null) return;
    onExpandCollection(selectedCollectionId);
  }, [selectedCollectionId, onExpandCollection]);

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

  const toggleFolder = (folderId: number): void => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const getRootRequests = (collectionId: number): SavedRequest[] =>
    (requestsByCollection[collectionId] ?? []).filter((req) => req.folder_id == null);

  const getFolderRequests = (collectionId: number, folderId: number): SavedRequest[] =>
    (requestsByCollection[collectionId] ?? []).filter((req) => req.folder_id === folderId);

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

  const collectionIds = useMemo(
    () => collections.map((collection) => collectionDragId(collection.id)),
    [collections]
  );

  const handleCollectionDragStart = (event: DragStartEvent): void => {
    const collectionId = parseCollectionDragId(String(event.active.id));
    if (collectionId == null) return;
    const collection = collections.find((item) => item.id === collectionId) ?? null;
    setActiveDragCollection(collection);
  };

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
          <div className="px-2 py-1.5 text-[13px] text-muted">No collections yet</div>
        )}

        <SortableContext items={collectionIds} strategy={verticalListSortingStrategy}>
          {collectionTrees.map(({ collection, folders, rootRequests }) => {
            const expanded = expandedCollectionIds.has(collection.id);
            const selected = selectedCollectionId === collection.id;
            const loaded =
              requestsByCollection[collection.id] != null &&
              foldersByCollection[collection.id] != null;
            const collectionConnectionId = collection.connectionId ?? primaryConnectionId;
            const connectionName = connectionNamesById[collectionConnectionId];
            const connectionType = connectionTypesById[collectionConnectionId];
            const canInvite = connectionType != null && connectionType !== 'sqlite';
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
                <SortableRow id={collectionDragId(collection.id)} className={sourceRow(selected)}>
                  <button
                    className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-[10px] text-muted hover:text-text app-no-drag"
                    onClick={() => toggleCollection(collection.id)}
                    aria-label={expanded ? 'Collapse' : 'Expand'}
                  >
                    {expanded ? '▼' : '▶'}
                  </button>
                  <button
                    className="min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent py-0.5 text-left text-[13px] text-inherit app-no-drag"
                    onClick={() => onSelectCollection(collection.id)}
                    onDoubleClick={() => onConfigureCollection(collection.id)}
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{collection.name}</span>
                      {connectionName != null && (
                        <span
                          className="shrink-0 rounded bg-info/15 px-1.5 py-0.5 text-[10px] font-medium text-info"
                          title={`Stored in ${connectionName}`}
                        >
                          {connectionName}
                        </span>
                      )}
                    </span>
                  </button>
                  <RowActionsMenu
                    menuId={`collection-${collection.id}`}
                    openMenuId={openMenuId}
                    onOpenChange={setOpenMenuId}
                    items={[
                      { label: 'Settings', onSelect: () => onConfigureCollection(collection.id) },
                      { label: 'New Folder', onSelect: () => void onNewFolder(collection.id) },
                      {
                        label: 'New Request',
                        onSelect: () => void onNewRequestInCollection(collection.id)
                      },
                      { label: 'Export', onSelect: () => void onExportCollection(collection.id) },
                      {
                        label: 'Duplicate',
                        onSelect: () => void onDuplicateCollection(collection.id)
                      },
                      ...(canInvite
                        ? [
                            {
                              label: 'Invite',
                              onSelect: () => onInviteCollection(collection.id, collection.name)
                            }
                          ]
                        : []),
                      {
                        label: 'Delete',
                        variant: 'danger',
                        onSelect: () => {
                          if (confirm(`Delete collection "${collection.name}"?`)) {
                            void onDeleteCollection(collection.id);
                          }
                        }
                      }
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
                        <div className="px-2 py-1 text-[12px] text-muted">No saved requests</div>
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
                          <div className="px-2 pb-0.5 text-[11px] text-info">
                            Drop at collection root
                          </div>
                        )}
                        {isDraggingRequestHere && rootRequests.length === 0 && (
                          <div className="px-2 py-1.5 text-[12px] text-muted">Collection root</div>
                        )}
                        <SortableContext
                          items={rootRequestIds}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="flex flex-col gap-0.5">
                            {rootRequests.map((req) => (
                              <RequestRow
                                key={req.id}
                                req={req}
                                activeRequestId={activeRequestId}
                                openMenuId={openMenuId}
                                onOpenChange={setOpenMenuId}
                                folders={folders}
                                onLoadRequest={onLoadRequest}
                                onDeleteRequest={onDeleteRequest}
                                onDuplicateRequest={onDuplicateRequest}
                                onMoveRequest={(requestId, folderId) => {
                                  const targetList =
                                    folderId == null
                                      ? getRootRequests(collection.id)
                                      : getFolderRequests(collection.id, folderId);
                                  void onMoveRequest(
                                    collection.id,
                                    requestId,
                                    folderId,
                                    targetList.length
                                  );
                                }}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DropZone>

                      <SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
                        {folders.map((folder) => {
                          const folderExpanded = expandedFolderIds.has(folder.id);
                          const folderRequests = getFolderRequests(collection.id, folder.id);
                          const folderRequestIds = folderRequests.map((req) =>
                            requestDragId(req.id)
                          );
                          const folderHighlighted =
                            isRequestDragInCollection && dropTargetFolderId === folder.id;

                          return (
                            <div
                              key={folder.id}
                              className={folderHighlighted ? dropTargetHighlightClass : undefined}
                            >
                              <DropZone id={dropFolderId(folder.id)}>
                                <SortableRow
                                  id={folderDragId(folder.id)}
                                  className={sourceRow(false)}
                                >
                                  <button
                                    className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-[10px] text-muted hover:text-text app-no-drag"
                                    onClick={() => toggleFolder(folder.id)}
                                    aria-label={
                                      folderExpanded ? 'Collapse folder' : 'Expand folder'
                                    }
                                  >
                                    {folderExpanded ? '▼' : '▶'}
                                  </button>
                                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                                    {folder.name}
                                    {folderHighlighted && (
                                      <span className="ml-1.5 text-[11px] font-normal text-info">
                                        Drop here
                                      </span>
                                    )}
                                  </span>
                                  <RowActionsMenu
                                    menuId={`folder-${folder.id}`}
                                    openMenuId={openMenuId}
                                    onOpenChange={setOpenMenuId}
                                    items={[
                                      {
                                        label: 'New Request',
                                        onSelect: () =>
                                          void onNewRequestInFolder(collection.id, folder.id)
                                      },
                                      {
                                        label: 'Rename',
                                        onSelect: () =>
                                          void onRenameFolder(folder.id, collection.id)
                                      },
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
                                    ]}
                                  />
                                </SortableRow>
                              </DropZone>

                              {folderExpanded && (
                                <div className="ml-4 flex flex-col gap-0.5 py-0.5">
                                  <SortableContext
                                    items={folderRequestIds}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {folderRequests.map((req) => (
                                      <RequestRow
                                        key={req.id}
                                        req={req}
                                        activeRequestId={activeRequestId}
                                        openMenuId={openMenuId}
                                        onOpenChange={setOpenMenuId}
                                        folders={folders}
                                        onLoadRequest={onLoadRequest}
                                        onDeleteRequest={onDeleteRequest}
                                        onDuplicateRequest={onDuplicateRequest}
                                        onMoveRequest={(requestId, folderId) => {
                                          const targetList =
                                            folderId == null
                                              ? getRootRequests(collection.id)
                                              : getFolderRequests(collection.id, folderId);
                                          void onMoveRequest(
                                            collection.id,
                                            requestId,
                                            folderId,
                                            targetList.length
                                          );
                                        }}
                                      />
                                    ))}
                                  </SortableContext>
                                  {folderRequests.length === 0 && (
                                    <div className="px-2 py-1 text-[12px] text-muted">
                                      Empty folder
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
                            className={`shrink-0 rounded px-1 py-px text-[10px] font-semibold ${METHOD_CLASSES[activeDragRequest.method.toLowerCase()] ?? 'bg-info text-white'}`}
                          >
                            {activeDragRequest.method}
                          </span>
                          <span className="truncate text-[13px]">{activeDragRequest.name}</span>
                        </div>
                      ) : dragCollectionId === collection.id &&
                        activeDragKind === 'folder' &&
                        activeDragFolder ? (
                        <div className="rounded border border-separator bg-surface px-2 py-1 text-[13px] font-medium shadow-md">
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
          <div className="rounded border border-separator bg-surface px-2 py-1 text-[13px] font-medium shadow-md">
            {activeDragCollection.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
