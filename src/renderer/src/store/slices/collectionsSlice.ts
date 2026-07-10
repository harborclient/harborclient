import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Collection, Folder, SavedRequest } from '#/shared/types';

export interface CollectionsState {
  collections: Collection[];
  foldersByCollection: Record<number, Folder[]>;
  requestsByCollection: Record<number, SavedRequest[]>;
  selectedCollectionId: number | null;
  selectedFolderId: number | null;
  /** True after the first successful collections list from the main process. */
  collectionsListed: boolean;
}

const initialState: CollectionsState = {
  collections: [],
  foldersByCollection: {},
  requestsByCollection: {},
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
  setFoldersForCollection,
  upsertFolderInCollection
} = collectionsSlice.actions;
export default collectionsSlice.reducer;
