import {
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  type ClientRect,
  type CollisionDetection
} from '@dnd-kit/core';
import {
  mergeContainerItems,
  type ContainerItem,
  type ContainerItemRef
} from '#/shared/collectionContainerOrder';
import type { CollectionDocument, SavedRequest } from '#/shared/types';

export type { ContainerItem, ContainerItemRef };
export { mergeContainerItems };

/**
 * Sorts markdown documents alphabetically by display name (case-insensitive).
 *
 * @param documents Documents in a single container (collection root or folder).
 * @returns A new array sorted by name; equal names keep relative order.
 */
export function sortContainerDocuments(documents: CollectionDocument[]): CollectionDocument[] {
  return [...documents].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

/**
 * Kind of draggable sidebar item within a collection.
 */
export type DragKind = 'folder' | 'request' | 'document';

/**
 * Parsed drag id for folder, request, or document sortable items.
 */
export interface ParsedDragId {
  kind: DragKind;
  id: number;
}

/**
 * Builds a stable drag id for a collection row.
 *
 * @param collectionId Registry collection id.
 */
export function collectionDragId(collectionId: number): string {
  return `collection:${collectionId}`;
}

/**
 * Builds a stable drag id for a folder row.
 *
 * @param folderId Folder id within a collection.
 */
export function folderDragId(folderId: number): string {
  return `folder:${folderId}`;
}

/**
 * Builds a stable drag id for a saved request row.
 *
 * @param requestId Saved request id.
 */
export function requestDragId(requestId: number): string {
  return `request:${requestId}`;
}

/**
 * Builds a stable drag id for a markdown document row.
 *
 * @param documentId Saved document id.
 */
export function documentDragId(documentId: number): string {
  return `document:${documentId}`;
}

/**
 * Builds a stable drag id for a merged request or document row.
 *
 * @param item - Container item reference.
 */
export function containerItemDragId(item: ContainerItemRef): string {
  return item.kind === 'request' ? requestDragId(item.id) : documentDragId(item.id);
}

/**
 * Builds a droppable id for the collection root container.
 *
 * @param collectionId Registry collection id.
 */
export function dropRootId(collectionId: number): string {
  return `drop:root:${collectionId}`;
}

/**
 * Builds a droppable id for a folder container.
 *
 * @param folderId Folder id within a collection.
 */
export function dropFolderId(folderId: number): string {
  return `drop:folder:${folderId}`;
}

/**
 * Parses a folder, request, or document drag id into its kind and numeric id.
 *
 * @param value Raw dnd-kit item id.
 */
export function parseDragId(value: string): ParsedDragId | null {
  const [kind, idValue] = value.split(':');
  if (kind !== 'folder' && kind !== 'request' && kind !== 'document') return null;
  if (idValue === '') return null;
  const id = Number(idValue);
  if (!Number.isFinite(id)) return null;
  return { kind, id };
}

/**
 * Parses a collection drag id into its numeric collection id.
 *
 * @returns The collection id, or null when the value is not a collection drag id.
 */
export function parseCollectionDragId(value: string): number | null {
  if (!value.startsWith('collection:')) return null;
  const id = Number(value.slice('collection:'.length));
  return Number.isFinite(id) ? id : null;
}

/**
 * Parses a drop target id into its folder id or collection id.
 *
 * @param value The drag id to parse.
 * @returns The folder id or collection id, or null when the value is not a valid drop target.
 */
export function parseDropTarget(
  value: string
): { folderId: number | null; collectionId?: number } | null {
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
export function resolveRequestDropTarget(
  overId: string,
  requests: SavedRequest[],
  documents: CollectionDocument[] = []
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

  if (parsed.kind === 'document') {
    const document = documents.find((doc) => doc.id === parsed.id);
    if (!document) return undefined;
    return document.folder_id ?? null;
  }

  return undefined;
}

/**
 * Resolves which folder container a markdown document would drop into from the current over id.
 *
 * @param overId Active dnd-kit over id.
 * @param documents Documents in the collection being dragged within.
 * @param requests Requests in the same collection, used when hovering a request row.
 * @returns folder id, null for collection root, or undefined when not a valid target.
 */
export function resolveDocumentDropTarget(
  overId: string,
  documents: CollectionDocument[],
  requests: SavedRequest[]
): number | null | undefined {
  const overDrop = parseDropTarget(overId);
  if (overDrop) return overDrop.folderId;

  const parsed = parseDragId(overId);
  if (!parsed) return undefined;

  if (parsed.kind === 'folder') return parsed.id;

  if (parsed.kind === 'document') {
    const document = documents.find((doc) => doc.id === parsed.id);
    if (!document) return undefined;
    return document.folder_id ?? null;
  }

  if (parsed.kind === 'request') {
    const request = requests.find((req) => req.id === parsed.id);
    if (!request) return undefined;
    return request.folder_id ?? null;
  }

  return undefined;
}

/**
 * Resolves the unified insertion index for a drop target within a merged container list.
 *
 * @param items - Current merged container order.
 * @param overId - Active dnd-kit over id.
 * @returns Zero-based unified index, or undefined when the target is invalid.
 */
export function findUnifiedIndex(items: ContainerItemRef[], overId: string): number | undefined {
  if (parseDropTarget(overId) != null) {
    return items.length;
  }

  const parsed = parseDragId(overId);
  if (!parsed) return undefined;

  if (parsed.kind === 'folder') {
    return items.length;
  }

  const index = items.findIndex((item) => item.kind === parsed.kind && item.id === parsed.id);
  return index >= 0 ? index : undefined;
}

/**
 * Tailwind classes applied to the active request drop target row.
 */
export const dropTargetHighlightClass = 'rounded-md ring-2 ring-info/60 bg-info/10';

/**
 * Whether a collision id refers to a sortable request or document row.
 *
 * @param id dnd-kit collision id.
 */
export function isSortableRowCollisionId(id: string): boolean {
  return id.startsWith('request:') || id.startsWith('document:');
}

/**
 * Whether a collision id refers to a container drop zone or folder header.
 *
 * @param id dnd-kit collision id.
 */
export function isContainerDropCollisionId(id: string): boolean {
  return id.startsWith('drop:') || id.startsWith('folder:');
}

/**
 * Returns whether the center of a droppable rect lies inside a container rect.
 * Used to find sortable rows that belong to a hovered drop zone.
 *
 * @param rect Droppable bounding rect.
 * @param container Container bounding rect.
 */
export function rectCenterWithin(rect: ClientRect, container: ClientRect): boolean {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  return (
    centerX >= container.left &&
    centerX <= container.right &&
    centerY >= container.top &&
    centerY <= container.bottom
  );
}

/**
 * Ref-like holder for the active sidebar drag kind.
 */
export interface ActiveDragKindRef {
  current: DragKind | null;
}

/**
 * Mutable drag kind updated synchronously on drag start/end for collision detection.
 */
const activeDragKindHolder: ActiveDragKindRef = { current: null };

/**
 * Sets the active sidebar drag kind for inner collection collision detection.
 *
 * @param kind Dragged item kind, or null when drag ends.
 */
export function setCollectionSidebarDragKind(kind: DragKind | null): void {
  activeDragKindHolder.current = kind;
}

/**
 * Builds collision detection for the per-collection sidebar DndContext.
 * Request and document drags resolve to the nearest row inside the hovered
 * container so drops land at the correct index even when a gap opens under the
 * pointer; folder drags use closest-center sortable collisions so sibling
 * folders animate out of the way.
 *
 * @param activeDragKindRef Ref updated synchronously on drag start/end.
 */
export function createCollectionCollisionDetection(
  activeDragKindRef: ActiveDragKindRef
): CollisionDetection {
  return (args) => {
    const activeDragKind = activeDragKindRef.current;
    if (activeDragKind === 'folder') {
      return closestCenter(args);
    }

    const pointerCollisions = pointerWithin(args);
    const intersections = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
    const overId = getFirstCollision(intersections, 'id');
    if (overId == null) {
      return closestCenter(args);
    }

    const overIdStr = String(overId);
    if (isSortableRowCollisionId(overIdStr)) {
      return [{ id: overId }];
    }

    if (isContainerDropCollisionId(overIdStr)) {
      const containerRect = args.droppableRects.get(overId);
      if (containerRect) {
        const rowContainers = args.droppableContainers.filter((container) => {
          if (!isSortableRowCollisionId(String(container.id))) {
            return false;
          }
          const rect = args.droppableRects.get(container.id);
          return rect != null && rectCenterWithin(rect, containerRect);
        });
        if (rowContainers.length > 0) {
          const rowCollisions = closestCenter({
            ...args,
            droppableContainers: rowContainers
          });
          if (rowCollisions.length > 0) {
            return rowCollisions;
          }
        }
      }
      return [{ id: overId }];
    }

    return closestCenter(args);
  };
}

/**
 * Collision detection wired to {@link setCollectionSidebarDragKind}.
 */
export const collectionCollisionDetectionWithDragKind =
  createCollectionCollisionDetection(activeDragKindHolder);

/**
 * Default collision detection when no drag kind context is available.
 */
export const collectionCollisionDetection = createCollectionCollisionDetection({ current: null });
