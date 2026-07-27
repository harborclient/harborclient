import type {
  Collection,
  CollectionDocument,
  Folder,
  SavedRequest
} from '@harborclient/core/types';
import type {
  CollectionSummary,
  DocumentSummary,
  FolderSummary,
  LibraryListOptions,
  LibraryTreeSnapshot,
  SavedRequestSummary
} from '@harborclient/sdk';

/**
 * Asserts that a value is a numeric collection database id.
 *
 * @param collectionId - Raw collection id from a plugin host call.
 * @param methodName - Host method name used in error messages.
 * @throws When `collectionId` is not a number.
 */
export function validateCollectionId(
  collectionId: unknown,
  methodName: string
): asserts collectionId is number {
  if (typeof collectionId !== 'number') {
    throw new Error(`harborclient.${methodName} requires a numeric collection id.`);
  }
}

/**
 * Maps a full collection row to a plugin-facing summary without settings payloads.
 *
 * @param collection - Collection from storage IPC.
 * @returns Serializable summary for sidebar trees.
 */
export function toCollectionSummary(collection: Collection): CollectionSummary {
  return {
    id: collection.id,
    uuid: collection.uuid,
    name: collection.name,
    marker: collection.marker,
    created_at: collection.created_at,
    ...(collection.connectionId !== undefined ? { connectionId: collection.connectionId } : {}),
    ...(collection.archived !== undefined ? { archived: collection.archived } : {}),
    ...(collection.deletion_locked !== undefined
      ? { deletion_locked: collection.deletion_locked }
      : {})
  };
}

/**
 * Maps a folder row to a plugin-facing summary without settings payloads.
 *
 * @param folder - Folder from storage IPC.
 * @returns Serializable summary for sidebar trees.
 */
export function toFolderSummary(folder: Folder): FolderSummary {
  return {
    id: folder.id,
    uuid: folder.uuid,
    collection_id: folder.collection_id,
    parent_folder_id: folder.parent_folder_id,
    name: folder.name,
    sort_order: folder.sort_order,
    marker: folder.marker,
    created_at: folder.created_at
  };
}

/**
 * Maps a saved request to a plugin-facing summary without body/auth.
 *
 * @param request - Saved request from storage IPC.
 * @returns Serializable summary for sidebar trees.
 */
export function toSavedRequestSummary(request: SavedRequest): SavedRequestSummary {
  return {
    id: request.id,
    uuid: request.uuid,
    collection_id: request.collection_id,
    folder_id: request.folder_id,
    name: request.name,
    method: request.method,
    sort_order: request.sort_order,
    marker: request.marker,
    created_at: request.created_at
  };
}

/**
 * Maps a document row to a plugin-facing summary without markdown content.
 *
 * @param document - Collection document from storage IPC.
 * @returns Serializable summary for sidebar trees.
 */
export function toDocumentSummary(document: CollectionDocument): DocumentSummary {
  return {
    id: document.id,
    uuid: document.uuid,
    collection_id: document.collection_id,
    folder_id: document.folder_id,
    name: document.name,
    sort_order: document.sort_order,
    marker: document.marker,
    created_at: document.created_at,
    updated_at: document.updated_at
  };
}

/**
 * Lists collection summaries for plugins, optionally including archived rows.
 *
 * @param options - Archive filter; archived collections are excluded by default.
 * @returns Collection summaries suitable for a sidebar tree.
 */
export async function listCollectionsForPlugin(
  options: LibraryListOptions = {}
): Promise<CollectionSummary[]> {
  const includeArchived = options.includeArchived === true;
  const { collections } = await window.api.listCollections();
  return collections
    .filter((collection) => includeArchived || !collection.archived)
    .map(toCollectionSummary);
}

/**
 * Lists folder summaries for one collection.
 *
 * @param collectionId - Collection database id.
 * @returns Folder summaries for the collection.
 */
export async function listFoldersForPlugin(collectionId: number): Promise<FolderSummary[]> {
  validateCollectionId(collectionId, 'listFolders');
  const folders = await window.api.listFolders(collectionId);
  return folders.map(toFolderSummary);
}

/**
 * Lists lightweight saved-request summaries for one collection.
 *
 * @param collectionId - Collection database id.
 * @returns Request summaries without body/auth payloads.
 */
export async function listRequestsForPlugin(collectionId: number): Promise<SavedRequestSummary[]> {
  validateCollectionId(collectionId, 'listRequests');
  const requests = await window.api.listRequests(collectionId);
  return requests.map(toSavedRequestSummary);
}

/**
 * Lists markdown document summaries for one collection.
 *
 * @param collectionId - Collection database id.
 * @returns Document summaries without content bodies.
 */
export async function listDocumentsForPlugin(collectionId: number): Promise<DocumentSummary[]> {
  validateCollectionId(collectionId, 'listDocuments');
  const documents = await window.api.listDocuments(collectionId);
  return documents.map(toDocumentSummary);
}

/**
 * Builds a full library tree snapshot for plugins (collections + nested contents).
 *
 * @param options - Archive filter; archived collections are excluded by default.
 * @returns Tree snapshot including backend warnings from collection listing.
 */
export async function listLibraryTreeForPlugin(
  options: LibraryListOptions = {}
): Promise<LibraryTreeSnapshot> {
  const includeArchived = options.includeArchived === true;
  const { collections, warnings } = await window.api.listCollections();
  const visible = collections.filter((collection) => includeArchived || !collection.archived);

  const nodes = await Promise.all(
    visible.map(async (collection) => {
      const [folders, requests, documents] = await Promise.all([
        window.api.listFolders(collection.id),
        window.api.listRequests(collection.id),
        window.api.listDocuments(collection.id)
      ]);
      return {
        ...toCollectionSummary(collection),
        folders: folders.map(toFolderSummary),
        requests: requests.map(toSavedRequestSummary),
        documents: documents.map(toDocumentSummary)
      };
    })
  );

  return { collections: nodes, warnings };
}
