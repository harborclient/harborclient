import { closestCenter, pointerWithin, type CollisionDetection } from '@dnd-kit/core';
import type { SavedRequest } from '#/shared/types';

/**
 * Kind of draggable sidebar item within a collection.
 */
export type DragKind = 'folder' | 'request';

/**
 * Parsed drag id for folder or request sortable items.
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
 * Parses a folder or request drag id into its kind and numeric id.
 *
 * @param value Raw dnd-kit item id.
 */
export function parseDragId(value: string): ParsedDragId | null {
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

/**
 * Tailwind classes applied to the active request drop target row.
 */
export const dropTargetHighlightClass = 'rounded-md ring-2 ring-info/60 bg-info/10';

/**
 * Prefers explicit drop zones under the pointer, otherwise falls back to closest center.
 */
export const collectionCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    const dropTarget = pointerCollisions.find((collision) =>
      String(collision.id).startsWith('drop:')
    );
    if (dropTarget) return [dropTarget];
  }
  return closestCenter(args);
};
