import type {
  CollectionSummary,
  CreateDocumentInput,
  CreateFolderInput,
  CreateRequestInput,
  DeleteDocumentInput,
  DeleteFolderInput,
  DocumentSummary,
  FolderSummary,
  MoveDocumentInput,
  MoveFolderInput,
  MoveRequestInput,
  RenameDocumentInput,
  RenameFolderInput,
  ReorderContainerItemsInput,
  ReorderDocumentsInput,
  ReorderFoldersInput,
  ReorderRequestsInput,
  SavedRequestSummary,
  SetCollectionArchivedInput,
  UpdateCollectionInput
} from '@harborclient/sdk';
import type { SavedRequest } from '@harborclient/core/types';
import { defaultAuth } from '@harborclient/core/auth';
import { getFolderDescendants } from '@harborclient/core/folderTree';
import { parseHttpMethod } from '@harborclient/core/httpMethod';
import { store } from '#/renderer/src/store/redux';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { openTabWithDraft } from '#/renderer/src/store/slices/tabsSlice';
import { draftFromSaved } from '#/renderer/src/store/tabs';
import {
  createFolder,
  deleteCollection,
  deleteFolder,
  duplicateCollection,
  moveFolder,
  moveRequestToFolder,
  refreshCollectionContents,
  renameFolder,
  reorderCollections,
  reorderContainerItems,
  reorderFolders,
  reorderRequests,
  setCollectionArchived,
  updateCollection
} from '#/renderer/src/store/thunks/collections';
import {
  deleteDocument,
  moveDocumentToFolder,
  newDocumentInCollection,
  newDocumentInFolder,
  renameDocument,
  reorderDocuments
} from '#/renderer/src/store/thunks/documents';
import { deleteRequest, duplicateRequest } from '#/renderer/src/store/thunks/requests';
import { findSavedRequest, getCollectionMetadataForPlugin } from './hostRequestCommands';
import {
  toCollectionSummary,
  toDocumentSummary,
  toFolderSummary,
  toSavedRequestSummary,
  validateCollectionId
} from './hostLibraryCommands';

/**
 * Asserts that a value is a numeric database id for a plugin host call.
 *
 * @param id - Raw id from a plugin host call.
 * @param fieldName - Field name used in error messages.
 * @param methodName - Host method name used in error messages.
 * @throws When `id` is not a number.
 */
export function validateNumericId(
  id: unknown,
  fieldName: string,
  methodName: string
): asserts id is number {
  if (typeof id !== 'number' || !Number.isFinite(id)) {
    throw new Error(`harborclient.${methodName} requires a numeric ${fieldName}.`);
  }
}

/**
 * Asserts that a value is a non-empty trimmed display name.
 *
 * @param name - Raw name from a plugin host call.
 * @param methodName - Host method name used in error messages.
 * @returns Trimmed name.
 * @throws When `name` is missing or blank after trim.
 */
export function validateNonEmptyName(name: unknown, methodName: string): string {
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error(`harborclient.${methodName} requires a non-empty name.`);
  }
  return name.trim();
}

/**
 * Asserts that a value is an array of numeric ids for reorder APIs.
 *
 * @param ids - Raw ordered id list from a plugin host call.
 * @param methodName - Host method name used in error messages.
 * @returns Validated id array.
 * @throws When `ids` is not an array of numbers.
 */
export function validateOrderedIds(ids: unknown, methodName: string): number[] {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'number' || !Number.isFinite(id))) {
    throw new Error(`harborclient.${methodName} requires an array of numeric ids.`);
  }
  return ids;
}

/**
 * Resolves a nullable folder id field from a plugin payload.
 *
 * @param folderId - Raw folder id (number, null, or undefined).
 * @param methodName - Host method name used in error messages.
 * @param fieldName - Field name used in error messages.
 * @returns Folder id or null.
 * @throws When `folderId` is present but not a number or null.
 */
function validateOptionalFolderId(
  folderId: unknown,
  methodName: string,
  fieldName = 'folderId'
): number | null {
  if (folderId === undefined || folderId === null) {
    return null;
  }
  validateNumericId(folderId, fieldName, methodName);
  return folderId;
}

/**
 * Loads a full saved request by id from the store cache or storage IPC.
 *
 * @param requestId - Saved request database id.
 * @returns Full saved request row.
 * @throws When the request cannot be found.
 */
async function loadSavedRequestRow(requestId: number): Promise<SavedRequest> {
  const cached = findSavedRequest(store.getState(), requestId);
  if (cached) {
    return cached;
  }

  const { collections } = await window.api.listCollections();
  for (const collection of collections) {
    const requests = await window.api.listRequests(collection.id);
    const match = requests.find((request) => request.id === requestId);
    if (match) {
      return match;
    }
  }

  throw new Error(`Request ${requestId} was not found.`);
}

/**
 * Counts sibling requests in a target folder (or collection root) for append index.
 *
 * @param collectionId - Parent collection database id.
 * @param folderId - Target folder id, or null for collection root.
 * @returns Number of sibling requests already in the container.
 */
async function countSiblingRequests(
  collectionId: number,
  folderId: number | null
): Promise<number> {
  const cached = store.getState().collections.requestsByCollection[collectionId];
  const requests = cached ?? (await window.api.listRequests(collectionId));
  return requests.filter((request) => (request.folder_id ?? null) === folderId).length;
}

/**
 * Counts sibling documents in a target folder (or collection root) for append index.
 *
 * @param collectionId - Parent collection database id.
 * @param folderId - Target folder id, or null for collection root.
 * @returns Number of sibling documents already in the container.
 */
async function countSiblingDocuments(
  collectionId: number,
  folderId: number | null
): Promise<number> {
  const cached = store.getState().collections.documentsByCollection[collectionId];
  const documents = cached ?? (await window.api.listDocuments(collectionId));
  return documents.filter((document) => (document.folder_id ?? null) === folderId).length;
}

/**
 * Renames a collection while preserving its other settings.
 *
 * @param input - Collection id and new name.
 * @returns Updated collection summary.
 */
export async function updateCollectionForPlugin(
  input: UpdateCollectionInput
): Promise<CollectionSummary> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.updateCollection requires an input object.');
  }
  validateNumericId(input.id, 'id', 'updateCollection');
  const name = validateNonEmptyName(input.name, 'updateCollection');

  const existing = await getCollectionMetadataForPlugin(input.id);
  const updated = await store
    .dispatch(
      updateCollection({
        id: input.id,
        name,
        variables: existing.variables,
        headers: existing.headers,
        preRequestScript: existing.pre_request_script,
        postRequestScript: existing.post_request_script,
        preRequestScripts: existing.pre_request_scripts,
        postRequestScripts: existing.post_request_scripts,
        auth: existing.auth,
        userAgent: existing.userAgent
      })
    )
    .unwrap();

  return toCollectionSummary(updated);
}

/**
 * Deletes a collection without showing a host confirmation dialog.
 *
 * @param collectionId - Collection database id.
 */
export async function deleteCollectionForPlugin(collectionId: number): Promise<void> {
  validateCollectionId(collectionId, 'deleteCollection');
  await store.dispatch(deleteCollection(collectionId)).unwrap();
}

/**
 * Persists a new top-level collection order.
 *
 * @param orderedIds - Collection ids in desired order.
 */
export async function reorderCollectionsForPlugin(orderedIds: number[]): Promise<void> {
  const validated = validateOrderedIds(orderedIds, 'reorderCollections');
  await store.dispatch(reorderCollections({ orderedCollectionIds: validated })).unwrap();
}

/**
 * Archives or un-archives a collection without a host confirmation dialog.
 *
 * @param input - Collection id and archived flag.
 */
export async function setCollectionArchivedForPlugin(
  input: SetCollectionArchivedInput
): Promise<void> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.setCollectionArchived requires an input object.');
  }
  validateNumericId(input.collectionId, 'collectionId', 'setCollectionArchived');
  if (typeof input.archived !== 'boolean') {
    throw new Error('harborclient.setCollectionArchived requires a boolean archived flag.');
  }
  await store
    .dispatch(setCollectionArchived({ id: input.collectionId, archived: input.archived }))
    .unwrap();
}

/**
 * Deep-copies a collection and returns a summary of the duplicate.
 *
 * @param collectionId - Collection database id to duplicate.
 * @returns Summary of the newly created collection.
 */
export async function duplicateCollectionForPlugin(
  collectionId: number
): Promise<CollectionSummary> {
  validateCollectionId(collectionId, 'duplicateCollection');
  const created = await store.dispatch(duplicateCollection(collectionId)).unwrap();
  return toCollectionSummary(created);
}

/**
 * Creates a folder inside a collection for a plugin host call.
 *
 * @param input - Collection id, name, and optional parent folder.
 * @returns Created folder summary.
 */
export async function createFolderForPlugin(input: CreateFolderInput): Promise<FolderSummary> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.createFolder requires an input object.');
  }
  validateNumericId(input.collectionId, 'collectionId', 'createFolder');
  const name = validateNonEmptyName(input.name, 'createFolder');
  const parentFolderId =
    input.parentFolderId === undefined
      ? undefined
      : validateOptionalFolderId(input.parentFolderId, 'createFolder', 'parentFolderId');

  const folder = await store
    .dispatch(
      createFolder({
        collectionId: input.collectionId,
        name,
        ...(parentFolderId !== undefined ? { parentFolderId } : {})
      })
    )
    .unwrap();

  return toFolderSummary(folder);
}

/**
 * Renames a folder for a plugin host call.
 *
 * @param input - Folder id, collection id, and new name.
 * @returns Updated folder summary.
 */
export async function renameFolderForPlugin(input: RenameFolderInput): Promise<FolderSummary> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.renameFolder requires an input object.');
  }
  validateNumericId(input.folderId, 'folderId', 'renameFolder');
  validateNumericId(input.collectionId, 'collectionId', 'renameFolder');
  const name = validateNonEmptyName(input.name, 'renameFolder');

  const folder = await store
    .dispatch(
      renameFolder({
        id: input.folderId,
        collectionId: input.collectionId,
        name
      })
    )
    .unwrap();

  return toFolderSummary(folder);
}

/**
 * Deletes a folder subtree for a plugin host call without a confirmation dialog.
 *
 * Gathers descendant request ids so open editor tabs are closed like the built-in tree.
 *
 * @param input - Folder id and parent collection id.
 */
export async function deleteFolderForPlugin(input: DeleteFolderInput): Promise<void> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.deleteFolder requires an input object.');
  }
  validateNumericId(input.folderId, 'folderId', 'deleteFolder');
  validateNumericId(input.collectionId, 'collectionId', 'deleteFolder');

  const folders = await window.api.listFolders(input.collectionId);
  const requests = await window.api.listRequests(input.collectionId);
  const subtreeFolderIds = new Set([
    input.folderId,
    ...getFolderDescendants(input.folderId, folders).map((folder) => folder.id)
  ]);
  const requestIds = requests
    .filter((request) => request.folder_id != null && subtreeFolderIds.has(request.folder_id))
    .map((request) => request.id);

  await store
    .dispatch(
      deleteFolder({
        id: input.folderId,
        collectionId: input.collectionId,
        requestIds
      })
    )
    .unwrap();
}

/**
 * Moves a folder beneath a new parent for a plugin host call.
 *
 * @param input - Move target and optional sort order.
 * @returns Updated folder summary.
 */
export async function moveFolderForPlugin(input: MoveFolderInput): Promise<FolderSummary> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.moveFolder requires an input object.');
  }
  validateNumericId(input.collectionId, 'collectionId', 'moveFolder');
  validateNumericId(input.folderId, 'folderId', 'moveFolder');
  const parentFolderId = validateOptionalFolderId(
    input.parentFolderId,
    'moveFolder',
    'parentFolderId'
  );
  if (input.sortOrder !== undefined) {
    validateNumericId(input.sortOrder, 'sortOrder', 'moveFolder');
  }

  const folder = await store
    .dispatch(
      moveFolder({
        collectionId: input.collectionId,
        folderId: input.folderId,
        parentFolderId,
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {})
      })
    )
    .unwrap();

  return toFolderSummary(folder);
}

/**
 * Persists a new folder order within a collection container.
 *
 * @param input - Collection id, parent folder, and ordered sibling ids.
 */
export async function reorderFoldersForPlugin(input: ReorderFoldersInput): Promise<void> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.reorderFolders requires an input object.');
  }
  validateNumericId(input.collectionId, 'collectionId', 'reorderFolders');
  const parentFolderId = validateOptionalFolderId(
    input.parentFolderId,
    'reorderFolders',
    'parentFolderId'
  );
  const orderedFolderIds = validateOrderedIds(input.orderedFolderIds, 'reorderFolders');

  await store
    .dispatch(
      reorderFolders({
        collectionId: input.collectionId,
        parentFolderId,
        orderedFolderIds
      })
    )
    .unwrap();
}

/**
 * Creates a saved request and opens it in an editor tab (matches built-in sidebar).
 *
 * @param input - Collection id, optional folder, and optional draft fields.
 * @returns Created request summary.
 */
export async function createRequestForPlugin(
  input: CreateRequestInput
): Promise<SavedRequestSummary> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.createRequest requires an input object.');
  }
  validateNumericId(input.collectionId, 'collectionId', 'createRequest');
  const folderId = validateOptionalFolderId(input.folderId, 'createRequest');

  const name =
    typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'Untitled Request';
  let method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' = 'GET';
  if (input.method !== undefined) {
    const parsed = parseHttpMethod(input.method);
    if (!parsed) {
      throw new Error('harborclient.createRequest method must be a valid HTTP method.');
    }
    method = parsed;
  }
  const url = typeof input.url === 'string' ? input.url : '';

  store.dispatch(setSelectedCollectionId(input.collectionId));

  const saved = await window.api.saveRequest({
    collection_id: input.collectionId,
    ...(folderId !== null ? { folder_id: folderId } : {}),
    name,
    method,
    url,
    headers: [],
    params: [],
    body: '',
    body_type: 'none',
    body_raw: null,
    body_raw_open: false,
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    comment: '',
    tags: '',
    auth: defaultAuth(),
    userAgent: ''
  });

  store.dispatch(openTabWithDraft(draftFromSaved(saved)));
  await store.dispatch(refreshCollectionContents(input.collectionId));

  return toSavedRequestSummary(saved);
}

/**
 * Deletes a saved request without a host confirmation dialog.
 *
 * @param requestId - Saved request database id.
 */
export async function deleteRequestForPlugin(requestId: number): Promise<void> {
  validateNumericId(requestId, 'requestId', 'deleteRequest');
  await store.dispatch(deleteRequest(requestId)).unwrap();
}

/**
 * Duplicates a saved request and opens the copy in an editor tab.
 *
 * @param requestId - Saved request database id to duplicate.
 * @returns Summary of the duplicated request.
 */
export async function duplicateRequestForPlugin(requestId: number): Promise<SavedRequestSummary> {
  validateNumericId(requestId, 'requestId', 'duplicateRequest');
  const source = await loadSavedRequestRow(requestId);
  const saved = await store.dispatch(duplicateRequest(source)).unwrap();
  return toSavedRequestSummary(saved);
}

/**
 * Moves a saved request to another folder or the collection root.
 *
 * @param input - Request id, target folder, and optional index.
 */
export async function moveRequestForPlugin(input: MoveRequestInput): Promise<void> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.moveRequest requires an input object.');
  }
  validateNumericId(input.collectionId, 'collectionId', 'moveRequest');
  validateNumericId(input.requestId, 'requestId', 'moveRequest');
  const folderId = validateOptionalFolderId(input.folderId, 'moveRequest');
  let index: number;
  if (input.index === undefined) {
    index = await countSiblingRequests(input.collectionId, folderId);
  } else {
    validateNumericId(input.index, 'index', 'moveRequest');
    index = input.index;
  }

  await store
    .dispatch(
      moveRequestToFolder({
        collectionId: input.collectionId,
        requestId: input.requestId,
        folderId,
        index
      })
    )
    .unwrap();
}

/**
 * Persists a new request order within a folder or collection root.
 *
 * @param input - Collection id, folder id, and ordered request ids.
 */
export async function reorderRequestsForPlugin(input: ReorderRequestsInput): Promise<void> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.reorderRequests requires an input object.');
  }
  validateNumericId(input.collectionId, 'collectionId', 'reorderRequests');
  const folderId = validateOptionalFolderId(input.folderId, 'reorderRequests');
  const orderedRequestIds = validateOrderedIds(input.orderedRequestIds, 'reorderRequests');

  await store
    .dispatch(
      reorderRequests({
        collectionId: input.collectionId,
        folderId,
        orderedRequestIds
      })
    )
    .unwrap();
}

/**
 * Creates a markdown document for a plugin host call (does not open a tab).
 *
 * @param input - Collection id, name, and optional folder/content.
 * @returns Created document summary.
 */
export async function createDocumentForPlugin(
  input: CreateDocumentInput
): Promise<DocumentSummary> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.createDocument requires an input object.');
  }
  validateNumericId(input.collectionId, 'collectionId', 'createDocument');
  const name = validateNonEmptyName(input.name, 'createDocument');
  const folderId = validateOptionalFolderId(input.folderId, 'createDocument');
  const content = typeof input.content === 'string' ? input.content : undefined;

  const saved =
    folderId === null
      ? await store
          .dispatch(
            newDocumentInCollection({
              collectionId: input.collectionId,
              name,
              ...(content !== undefined ? { content } : {})
            })
          )
          .unwrap()
      : await store
          .dispatch(
            newDocumentInFolder({
              collectionId: input.collectionId,
              folderId,
              name,
              ...(content !== undefined ? { content } : {})
            })
          )
          .unwrap();

  return toDocumentSummary(saved);
}

/**
 * Renames a markdown document without changing its body.
 *
 * @param input - Document id, collection id, and new name.
 * @returns Updated document summary.
 */
export async function renameDocumentForPlugin(
  input: RenameDocumentInput
): Promise<DocumentSummary> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.renameDocument requires an input object.');
  }
  validateNumericId(input.id, 'id', 'renameDocument');
  validateNumericId(input.collectionId, 'collectionId', 'renameDocument');
  const name = validateNonEmptyName(input.name, 'renameDocument');

  const saved = await store
    .dispatch(
      renameDocument({
        id: input.id,
        collectionId: input.collectionId,
        name
      })
    )
    .unwrap();

  return toDocumentSummary(saved);
}

/**
 * Deletes a markdown document without a host confirmation dialog.
 *
 * @param input - Document id and parent collection id.
 */
export async function deleteDocumentForPlugin(input: DeleteDocumentInput): Promise<void> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.deleteDocument requires an input object.');
  }
  validateNumericId(input.id, 'id', 'deleteDocument');
  validateNumericId(input.collectionId, 'collectionId', 'deleteDocument');

  await store.dispatch(deleteDocument({ id: input.id, collectionId: input.collectionId })).unwrap();
}

/**
 * Moves a markdown document to another folder or the collection root.
 *
 * @param input - Document id, target folder, and optional index.
 */
export async function moveDocumentForPlugin(input: MoveDocumentInput): Promise<void> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.moveDocument requires an input object.');
  }
  validateNumericId(input.collectionId, 'collectionId', 'moveDocument');
  validateNumericId(input.documentId, 'documentId', 'moveDocument');
  const folderId = validateOptionalFolderId(input.folderId, 'moveDocument');
  let index: number;
  if (input.index === undefined) {
    index = await countSiblingDocuments(input.collectionId, folderId);
  } else {
    validateNumericId(input.index, 'index', 'moveDocument');
    index = input.index;
  }

  await store
    .dispatch(
      moveDocumentToFolder({
        collectionId: input.collectionId,
        documentId: input.documentId,
        folderId,
        index
      })
    )
    .unwrap();
}

/**
 * Persists a new document order within a folder or collection root.
 *
 * @param input - Collection id, folder id, and ordered document ids.
 */
export async function reorderDocumentsForPlugin(input: ReorderDocumentsInput): Promise<void> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.reorderDocuments requires an input object.');
  }
  validateNumericId(input.collectionId, 'collectionId', 'reorderDocuments');
  const folderId = validateOptionalFolderId(input.folderId, 'reorderDocuments');
  const orderedDocumentIds = validateOrderedIds(input.orderedDocumentIds, 'reorderDocuments');

  await store
    .dispatch(
      reorderDocuments({
        collectionId: input.collectionId,
        folderId,
        orderedDocumentIds
      })
    )
    .unwrap();
}

/**
 * Asserts that a value is an array of container item refs for mixed reorder APIs.
 *
 * @param items - Raw item list from a plugin host call.
 * @param methodName - Host method name used in error messages.
 * @returns Validated item refs.
 * @throws When `items` is not an array of `{ kind, id }` refs.
 */
export function validateContainerItemRefs(
  items: unknown,
  methodName: string
): ReorderContainerItemsInput['items'] {
  if (!Array.isArray(items)) {
    throw new Error(`harborclient.${methodName} requires an items array.`);
  }
  const validated: ReorderContainerItemsInput['items'] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      throw new Error(`harborclient.${methodName} requires items with kind and id.`);
    }
    const { kind, id } = item as { kind?: unknown; id?: unknown };
    if (kind !== 'request' && kind !== 'document') {
      throw new Error(`harborclient.${methodName} requires item kind "request" or "document".`);
    }
    validateNumericId(id, 'id', methodName);
    validated.push({ kind, id });
  }
  return validated;
}

/**
 * Persists interleaved request + document order in one folder or collection root.
 *
 * @param input - Collection id, folder id, and ordered item refs.
 */
export async function reorderContainerItemsForPlugin(
  input: ReorderContainerItemsInput
): Promise<void> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.reorderContainerItems requires an input object.');
  }
  validateNumericId(input.collectionId, 'collectionId', 'reorderContainerItems');
  const folderId = validateOptionalFolderId(input.folderId, 'reorderContainerItems');
  const items = validateContainerItemRefs(input.items, 'reorderContainerItems');

  await store
    .dispatch(
      reorderContainerItems({
        collectionId: input.collectionId,
        folderId,
        items
      })
    )
    .unwrap();
}
