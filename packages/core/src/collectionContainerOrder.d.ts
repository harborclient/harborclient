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
 * Compares two container items for unified sidebar display order.
 *
 * @param a - First merged item.
 * @param b - Second merged item.
 */
export declare function compareContainerItems(a: ContainerItem, b: ContainerItem): number;
/**
 * Merges requests and markdown documents in a folder or collection root into one ordered list.
 *
 * @param requests - All requests in the collection.
 * @param documents - All markdown documents in the collection.
 * @param folderId - Folder container id, or null for collection root.
 * @returns Requests and documents interleaved by shared sort_order semantics.
 */
export declare function mergeContainerItems(
  requests: SavedRequest[],
  documents: CollectionDocument[],
  folderId: number | null
): ContainerItem[];
/**
 * Maps container item refs from a merged list.
 *
 * @param items - Merged container items.
 */
export declare function toContainerItemRefs(items: ContainerItem[]): ContainerItemRef[];
//# sourceMappingURL=collectionContainerOrder.d.ts.map
