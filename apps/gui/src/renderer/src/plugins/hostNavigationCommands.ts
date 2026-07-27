import type { CollectionDocument } from '@harborclient/core/types';
import { store } from '#/renderer/src/store/redux';
import { openCollectionRunner, openShareModal } from '#/renderer/src/store/slices/modalsSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { focusSidebarItem } from '#/renderer/src/store/thunks/collections';
import { requestLoadDocument } from '#/renderer/src/store/thunks/documents';
import { loadTrustedKeys } from '#/renderer/src/store/thunks/modals';
import { validateNumericId } from './hostLibraryMutations';
import { findCachedDocument, sidebarFocusPayloadForDocument } from './sidebarSelectionMapping';

/**
 * Resolves a collection display name from the Redux cache.
 *
 * @param collectionId - Collection database id.
 * @returns Collection name, or a fallback label when the row is not cached.
 */
function resolveCollectionName(collectionId: number): string {
  const collection = store
    .getState()
    .collections.collections.find((entry) => entry.id === collectionId);
  return collection?.name ?? `Collection ${collectionId}`;
}

/**
 * Loads a markdown document by id from the store cache or storage IPC.
 *
 * @param documentId - Collection document database id.
 * @returns Full document row.
 * @throws When the document cannot be found.
 */
async function loadDocumentRow(documentId: number): Promise<CollectionDocument> {
  const cached = findCachedDocument(store.getState(), documentId);
  if (cached) {
    return cached;
  }

  const { collections } = await window.api.listCollections();
  for (const collection of collections) {
    const documents = await window.api.listDocuments(collection.id);
    const match = documents.find((document) => document.id === documentId);
    if (match) {
      return match;
    }
  }
  throw new Error(`Document ${documentId} was not found.`);
}

/**
 * Opens a saved markdown document or focuses an existing tab for it.
 *
 * Also focuses the parent collection/folder in the sidebar.
 *
 * @param documentId - Collection document database id.
 */
export async function loadDocumentForPlugin(documentId: number): Promise<void> {
  validateNumericId(documentId, 'documentId', 'loadDocument');
  const doc = await loadDocumentRow(documentId);
  store.dispatch(focusSidebarItem(sidebarFocusPayloadForDocument(doc)));
  void store.dispatch(requestLoadDocument({ doc }));
}

/**
 * Opens collection settings in a page tab.
 *
 * @param collectionId - Collection database id.
 */
export function openCollectionSettingsForPlugin(collectionId: number): void {
  validateNumericId(collectionId, 'collectionId', 'openCollectionSettings');
  store.dispatch(openPageTab({ type: 'collection', id: collectionId }));
}

/**
 * Opens the collection runner for an entire collection.
 *
 * @param collectionId - Collection database id.
 */
export function openCollectionRunnerForPlugin(collectionId: number): void {
  validateNumericId(collectionId, 'collectionId', 'openCollectionRunner');
  const collectionName = resolveCollectionName(collectionId);
  store.dispatch(openCollectionRunner({ collectionId, collectionName }));
  store.dispatch(openPageTab({ type: 'collection-runner', collectionId }));
}

/**
 * Opens the share-collection modal for a collection.
 *
 * @param collectionId - Collection database id.
 */
export function openShareModalForPlugin(collectionId: number): void {
  validateNumericId(collectionId, 'collectionId', 'openShareModal');
  const collectionName = resolveCollectionName(collectionId);
  store.dispatch(openShareModal({ collectionId, collectionName }));
  void store.dispatch(loadTrustedKeys());
}
