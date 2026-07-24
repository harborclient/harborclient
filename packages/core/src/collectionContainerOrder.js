/**
 * Returns whether an entity belongs to the given folder container.
 *
 * @param folderId - Target folder id, or null for collection root.
 * @param entityFolderId - Entity folder id, or null when stored at collection root.
 */
function inContainer(folderId, entityFolderId) {
    return folderId == null ? entityFolderId == null : entityFolderId === folderId;
}
/**
 * Compares two container items for unified sidebar display order.
 *
 * @param a - First merged item.
 * @param b - Second merged item.
 */
export function compareContainerItems(a, b) {
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
export function mergeContainerItems(requests, documents, folderId) {
    const items = [
        ...requests
            .filter((request) => inContainer(folderId, request.folder_id ?? null))
            .map((request) => ({
            kind: 'request',
            id: request.id,
            sort_order: request.sort_order,
            name: request.name
        })),
        ...documents
            .filter((document) => inContainer(folderId, document.folder_id ?? null))
            .map((document) => ({
            kind: 'document',
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
export function toContainerItemRefs(items) {
    return items.map(({ kind, id }) => ({ kind, id }));
}
//# sourceMappingURL=collectionContainerOrder.js.map