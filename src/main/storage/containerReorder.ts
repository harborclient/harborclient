import {
  mergeContainerItems,
  toContainerItemRefs,
  type ContainerItemRef
} from '#/shared/collectionContainerOrder';
import type { CollectionDocument, SavedRequest } from '#/shared/types';

/**
 * Removes one item from a container item order list.
 *
 * @param items - Ordered container items.
 * @param kind - Kind of item to remove.
 * @param id - Id of item to remove.
 */
export function removeContainerItemRef(
  items: ContainerItemRef[],
  kind: ContainerItemRef['kind'],
  id: number
): ContainerItemRef[] {
  return items.filter((item) => !(item.kind === kind && item.id === id));
}

/**
 * Builds the current unified order for a collection container.
 *
 * @param requests - All requests in the collection.
 * @param documents - All markdown documents in the collection.
 * @param folderId - Folder container id, or null for collection root.
 */
export function listContainerItemRefs(
  requests: SavedRequest[],
  documents: CollectionDocument[],
  folderId: number | null
): ContainerItemRef[] {
  return toContainerItemRefs(mergeContainerItems(requests, documents, folderId));
}

/**
 * Inserts a container item at a unified index and returns the next order.
 *
 * @param items - Existing container order without the moved item.
 * @param item - Item to insert.
 * @param index - Zero-based unified insertion index.
 */
export function insertContainerItemRef(
  items: ContainerItemRef[],
  item: ContainerItemRef,
  index: number
): ContainerItemRef[] {
  const next = [...items];
  const clampedIndex = Math.max(0, Math.min(index, next.length));
  next.splice(clampedIndex, 0, item);
  return next;
}

/**
 * Planned source and destination orders for moving one item between containers.
 */
export interface ContainerMovePlan {
  sourceOrder?: ContainerItemRef[];
  destinationOrder: ContainerItemRef[];
}

/**
 * Builds the next container orders for a unified move operation.
 *
 * @param requests - All requests in the collection.
 * @param documents - All markdown documents in the collection.
 * @param item - Item being moved.
 * @param sourceFolderId - Current folder container, or null for collection root.
 * @param destinationFolderId - Destination folder container, or null for collection root.
 * @param index - Zero-based unified index within the destination container.
 */
export function planContainerItemMove(
  requests: SavedRequest[],
  documents: CollectionDocument[],
  item: ContainerItemRef,
  sourceFolderId: number | null,
  destinationFolderId: number | null,
  index: number
): ContainerMovePlan {
  const sourceOrder = listContainerItemRefs(requests, documents, sourceFolderId);
  const withoutItem = removeContainerItemRef(sourceOrder, item.kind, item.id);

  if (sourceFolderId === destinationFolderId) {
    return {
      destinationOrder: insertContainerItemRef(withoutItem, item, index)
    };
  }

  const destinationBase = removeContainerItemRef(
    listContainerItemRefs(requests, documents, destinationFolderId),
    item.kind,
    item.id
  );

  return {
    sourceOrder: withoutItem,
    destinationOrder: insertContainerItemRef(destinationBase, item, index)
  };
}

/**
 * Validates that every ordered item exists in the collection before reordering.
 *
 * Folder membership is not checked because {@link IStorage.reorderContainerItems}
 * assigns `folder_id` and `sort_order` for every listed item, including items
 * moving into the container from another folder.
 *
 * @param collectionId - Expected collection id.
 * @param folderId - Target folder id, or null for collection root (unused; kept for call-site clarity).
 * @param items - Proposed container order.
 * @param requests - All requests in the collection.
 * @param documents - All documents in the collection.
 * @throws When an item is missing from the collection or duplicated in the order.
 */
export function assertContainerItemOrder(
  collectionId: number,
  folderId: number | null,
  items: ContainerItemRef[],
  requests: SavedRequest[],
  documents: CollectionDocument[]
): void {
  void folderId;

  const requestById = new Map(requests.map((request) => [request.id, request]));
  const documentById = new Map(documents.map((document) => [document.id, document]));
  const seen = new Set<string>();

  for (const item of items) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate container item: ${key}`);
    }
    seen.add(key);

    if (item.kind === 'request') {
      const request = requestById.get(item.id);
      if (!request || request.collection_id !== collectionId) {
        throw new Error(`Request not found in collection: ${item.id}`);
      }
      continue;
    }

    const document = documentById.get(item.id);
    if (!document || document.collection_id !== collectionId) {
      throw new Error(`Document not found in collection: ${item.id}`);
    }
  }
}
