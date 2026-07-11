import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Collection, CollectionDocument, Folder, SavedRequest } from '#/shared/types';

export interface CollectionsState {
  collections: Collection[];
  foldersByCollection: Record<number, Folder[]>;
  requestsByCollection: Record<number, SavedRequest[]>;
  documentsByCollection: Record<number, CollectionDocument[]>;
  selectedCollectionId: number | null;
  selectedFolderId: number | null;
  /** True after the first successful collections list from the main process. */
  collectionsListed: boolean;
}

const initialState: CollectionsState = {
  collections: [],
  foldersByCollection: {},
  requestsByCollection: {},
  documentsByCollection: {},
  selectedCollectionId: null,
  selectedFolderId: null,
  collectionsListed: false
};

const collectionsSlice = createSlice({
  name: 'collections',
  initialState,
  reducers: {
    /**
     * Updates the sidebar selected collection id and clears folder selection.
     */
    setSelectedCollectionId(state, action: PayloadAction<number | null>) {
      state.selectedCollectionId = action.payload;
      state.selectedFolderId = null;
    },
    /**
     * Selects a collection and optional folder for sidebar focus (e.g. breadcrumb navigation).
     */
    focusSidebarItem(
      state,
      action: PayloadAction<{ collectionId: number; folderId?: number | null }>
    ) {
      state.selectedCollectionId = action.payload.collectionId;
      state.selectedFolderId = action.payload.folderId ?? null;
    },
    /**
     * Replaces the full collections list from a refresh.
     */
    setCollections(state, action: PayloadAction<Collection[]>) {
      state.collections = action.payload;
      state.collectionsListed = true;
    },
    /**
     * Caches saved requests for one collection id.
     */
    setRequestsForCollection(
      state,
      action: PayloadAction<{ collectionId: number; requests: SavedRequest[] }>
    ) {
      state.requestsByCollection[action.payload.collectionId] = action.payload.requests;
    },
    /**
     * Caches markdown documents for one collection id.
     */
    setDocumentsForCollection(
      state,
      action: PayloadAction<{ collectionId: number; documents: CollectionDocument[] }>
    ) {
      state.documentsByCollection[action.payload.collectionId] = action.payload.documents;
    },
    /**
     * Replaces one document row in a collection cache after a successful save.
     */
    upsertDocumentInCollection(
      state,
      action: PayloadAction<{ collectionId: number; document: CollectionDocument }>
    ) {
      const { collectionId, document } = action.payload;
      const documents = state.documentsByCollection[collectionId] ?? [];
      const index = documents.findIndex((entry) => entry.id === document.id);
      if (index === -1) {
        state.documentsByCollection[collectionId] = [...documents, document];
        return;
      }
      const next = [...documents];
      next[index] = document;
      state.documentsByCollection[collectionId] = next;
    },
    /**
     * Caches folder metadata for one collection id.
     */
    setFoldersForCollection(
      state,
      action: PayloadAction<{ collectionId: number; folders: Folder[] }>
    ) {
      state.foldersByCollection[action.payload.collectionId] = action.payload.folders;
    },
    /**
     * Replaces one folder row in a collection cache after a successful save.
     */
    upsertFolderInCollection(
      state,
      action: PayloadAction<{ collectionId: number; folder: Folder }>
    ) {
      const { collectionId, folder } = action.payload;
      const folders = state.foldersByCollection[collectionId] ?? [];
      const index = folders.findIndex((entry) => entry.id === folder.id);
      if (index === -1) {
        state.foldersByCollection[collectionId] = [...folders, folder];
        return;
      }
      const next = [...folders];
      next[index] = folder;
      state.foldersByCollection[collectionId] = next;
    }
  }
});

export const {
  setSelectedCollectionId,
  focusSidebarItem,
  setCollections,
  setRequestsForCollection,
  setDocumentsForCollection,
  setFoldersForCollection,
  upsertFolderInCollection,
  upsertDocumentInCollection
} = collectionsSlice.actions;
export default collectionsSlice.reducer;
