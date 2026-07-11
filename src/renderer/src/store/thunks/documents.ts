import { createAsyncThunk } from '@reduxjs/toolkit';
import type { CollectionDocument, SaveDocumentInput } from '#/shared/types';
import { isMarkdownTab, isPageTab, isTabDirty } from '#/renderer/src/store/drafts';
import {
  selectCollectionSettingsDirty,
  selectEnvironmentSettingsDirty,
  selectFolderSettingsDirty
} from '#/renderer/src/store/slices/navigationSlice';
import { closeTab, loadDocument, markMarkdownSaved } from '#/renderer/src/store/slices/tabsSlice';
import {
  setPendingLoadDocument,
  type PendingLoadDocument
} from '#/renderer/src/store/slices/modalsSlice';
import {
  setDocumentsForCollection,
  setSelectedCollectionId,
  upsertDocumentInCollection
} from '#/renderer/src/store/slices/collectionsSlice';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  beginRefreshGeneration,
  collectionRefreshKey,
  isLatestRefreshGeneration
} from '#/renderer/src/store/refreshGeneration';

/**
 * Reloads markdown documents for a single collection.
 */
export const refreshDocuments = createAsyncThunk<
  Awaited<ReturnType<typeof window.api.listDocuments>>,
  number,
  ThunkApiConfig
>('documents/refresh', async (collectionId, { dispatch, getState }) => {
  const refreshKey = collectionRefreshKey('documents', collectionId);
  const generation = beginRefreshGeneration(refreshKey);
  const data = await window.api.listDocuments(collectionId);
  if (!isLatestRefreshGeneration(refreshKey, generation)) {
    return getState().collections.documentsByCollection[collectionId] ?? [];
  }
  dispatch(setDocumentsForCollection({ collectionId, documents: data }));
  return data;
});

/**
 * Creates a new markdown document at the collection root.
 */
export const newDocumentInCollection = createAsyncThunk<
  CollectionDocument,
  { collectionId: number; name: string; content?: string },
  ThunkApiConfig
>('documents/newInCollection', async ({ collectionId, name, content }, { dispatch }) => {
  dispatch(setSelectedCollectionId(collectionId));

  const saved = await window.api.saveDocument({
    collection_id: collectionId,
    name,
    content
  });

  dispatch(upsertDocumentInCollection({ collectionId, document: saved }));
  await dispatch(refreshDocuments(collectionId));
  return saved;
});

/**
 * Creates a new markdown document inside a folder.
 */
export const newDocumentInFolder = createAsyncThunk<
  CollectionDocument,
  { collectionId: number; folderId: number; name: string; content?: string },
  ThunkApiConfig
>('documents/newInFolder', async ({ collectionId, folderId, name, content }, { dispatch }) => {
  dispatch(setSelectedCollectionId(collectionId));

  const saved = await window.api.saveDocument({
    collection_id: collectionId,
    folder_id: folderId,
    name,
    content
  });

  dispatch(upsertDocumentInCollection({ collectionId, document: saved }));
  await dispatch(refreshDocuments(collectionId));
  return saved;
});

/**
 * Renames an existing markdown document without changing its body.
 */
export const renameDocument = createAsyncThunk<
  CollectionDocument,
  { id: number; collectionId: number; name: string },
  ThunkApiConfig
>('documents/rename', async ({ id, collectionId, name }, { dispatch, getState }) => {
  const documents = getState().collections.documentsByCollection[collectionId] ?? [];
  const existing = documents.find((document) => document.id === id);
  if (!existing) {
    throw new Error(`Document not found: ${id}`);
  }

  const saved = await window.api.saveDocument({
    id,
    collection_id: collectionId,
    folder_id: existing.folder_id,
    name,
    content: existing.content,
    uuid: existing.uuid
  });

  dispatch(upsertDocumentInCollection({ collectionId, document: saved }));
  return saved;
});

/**
 * Deletes a markdown document and refreshes the collection document list.
 */
export const deleteDocument = createAsyncThunk<
  void,
  { id: number; collectionId: number },
  ThunkApiConfig
>('documents/delete', async ({ id, collectionId }, { dispatch }) => {
  await window.api.deleteDocument(id);
  await dispatch(refreshDocuments(collectionId));
});

/**
 * Persists a new document order within a folder or the collection root.
 */
export const reorderDocuments = createAsyncThunk<
  void,
  { collectionId: number; folderId: number | null; orderedDocumentIds: number[] },
  ThunkApiConfig
>('documents/reorder', async ({ collectionId, folderId, orderedDocumentIds }, { dispatch }) => {
  await window.api.reorderDocuments(collectionId, folderId, orderedDocumentIds);
  await dispatch(refreshDocuments(collectionId));
});

/**
 * Payload for {@link requestLoadDocument}.
 */
export interface RequestLoadDocumentArgs {
  doc: CollectionDocument;
  skipSettingsCheck?: boolean;
  forceReload?: boolean;
  activate?: boolean;
}

/**
 * Persists document fields for create, rename, or autosave updates.
 */
export const saveDocument = createAsyncThunk<CollectionDocument, SaveDocumentInput, ThunkApiConfig>(
  'documents/save',
  async (input, { dispatch }) => {
    const saved = await window.api.saveDocument(input);
    dispatch(upsertDocumentInCollection({ collectionId: input.collection_id, document: saved }));
    return saved;
  }
);

/**
 * Persists the markdown content for an open document tab.
 */
export const saveMarkdownTab = createAsyncThunk<CollectionDocument, string, ThunkApiConfig>(
  'documents/saveMarkdownTab',
  async (tabId, { dispatch, getState }) => {
    const tab = getState().tabs.tabs.find((entry) => entry.tabId === tabId);
    if (!tab || !isMarkdownTab(tab)) {
      throw new Error('No markdown tab');
    }

    const saved = await dispatch(
      saveDocument({
        id: tab.docId,
        collection_id: tab.collectionId,
        folder_id: tab.folderId,
        name: tab.name,
        content: tab.content
      })
    ).unwrap();

    dispatch(
      markMarkdownSaved({
        tabId,
        content: saved.content,
        name: saved.name
      })
    );

    return saved;
  }
);

/**
 * Closes a markdown tab after optional cleanup hooks.
 */
export const closeMarkdownTab = createAsyncThunk<void, string, ThunkApiConfig>(
  'tabs/closeMarkdownTab',
  async (tabId, { dispatch }) => {
    dispatch(closeTab(tabId));
  }
);

/**
 * Loads a saved markdown document, prompting when settings or tab content has unsaved edits.
 */
export const requestLoadDocument = createAsyncThunk<void, RequestLoadDocumentArgs, ThunkApiConfig>(
  'modals/requestLoadDocument',
  async (
    { doc, skipSettingsCheck = false, forceReload = false, activate = true },
    { dispatch, getState }
  ) => {
    const state = getState();
    const activeTab = state.tabs.tabs.find((tab) => tab.tabId === state.tabs.activeTabId);
    const collectionDirty =
      activeTab != null &&
      isPageTab(activeTab) &&
      activeTab.page.type === 'collection' &&
      selectCollectionSettingsDirty(state);
    const environmentDirty =
      activeTab != null &&
      isPageTab(activeTab) &&
      activeTab.page.type === 'environment' &&
      selectEnvironmentSettingsDirty(state);
    const folderDirty =
      activeTab != null &&
      isPageTab(activeTab) &&
      activeTab.page.type === 'folder' &&
      selectFolderSettingsDirty(state);

    if (!skipSettingsCheck && (collectionDirty || environmentDirty || folderDirty)) {
      const pending: PendingLoadDocument = { doc, reason: 'settings' };
      dispatch(setPendingLoadDocument(pending));
      return;
    }

    const existing = state.tabs.tabs.find((tab) => isMarkdownTab(tab) && tab.docId === doc.id);
    if (!forceReload && existing && isTabDirty(existing)) {
      const pending: PendingLoadDocument = { doc, reason: 'dirty-tab' };
      dispatch(setPendingLoadDocument(pending));
      return;
    }

    dispatch(loadDocument({ doc, activate }));
  }
);
