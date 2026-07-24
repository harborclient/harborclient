import type { CollectionDocument, SavedRequest } from './types';

/**
 * Kind of sidebar row that can share a collection root or folder container.
 */
export type ContainerItemKind = 'request' | 'document';

/**
 * Stable reference to a request or markdown document in a shared container.
 */
export interface ContainerItemRef {
  kind: ContainerItemKind;
  id: number;
}

/**
 * Request or document row merged for unified sidebar ordering.
 */
export interface ContainerItem extends ContainerItemRef {
  sort_order: number;
  name: string;
}

/**
 * Returns whether an entity belongs to the given folder container.
 *
 * @param folderId - Target folder id, or null for collection root.
 * @param entityFolderId - Entity folder id, or null when stored at collection root.
 */
function inContainer(folderId: number | null, entityFolderId: number | null): boolean {
  return folderId == null ? entityFolderId == null : entityFolderId === folderId;
}

/**
 * Compares two container items for unified sidebar display order.
 *
 * @param a - First merged item.
 * @param b - Second merged item.
 */
export function compareContainerItems(a: ContainerItem, b: ContainerItem): number {
  if (a.sort_order !== b.sort_order) {
    return a.sort_order - b.sort_order;
  }
  if (a.kind !== b.kind) {
    return a.kind === 'request' ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

/**
 * Merges requests and markdown documents in a folder or collection root into one ordered list.
 *
 * @param requests - All requests in the collection.
 * @param documents - All markdown documents in the collection.
 * @param folderId - Folder container id, or null for collection root.
 * @returns Requests and documents interleaved by shared sort_order semantics.
 */
export function mergeContainerItems(
  requests: SavedRequest[],
  documents: CollectionDocument[],
  folderId: number | null
): ContainerItem[] {
  const items: ContainerItem[] = [
    ...requests
      .filter((request) => inContainer(folderId, request.folder_id ?? null))
      .map((request) => ({
        kind: 'request' as const,
        id: request.id,
        sort_order: request.sort_order,
        name: request.name
      })),
    ...documents
      .filter((document) => inContainer(folderId, document.folder_id ?? null))
      .map((document) => ({
        kind: 'document' as const,
        id: document.id,
        sort_order: document.sort_order,
        name: document.name
      }))
  ];

  return items.sort(compareContainerItems);
}

/**
 * Maps container item refs from a merged list.
 *
 * @param items - Merged container items.
 */
export function toContainerItemRefs(items: ContainerItem[]): ContainerItemRef[] {
  return items.map(({ kind, id }) => ({ kind, id }));
}
