import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  mergeContainerItems,
  toContainerItemRefs,
  type ContainerItemRef
} from '#/shared/collectionContainerOrder';
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
    },
    /**
     * Optimistically reorders top-level collections to match drag-and-drop before IPC persistence.
     */
    reorderCollectionsLocal(state, action: PayloadAction<{ orderedCollectionIds: number[] }>) {
      const { orderedCollectionIds } = action.payload;
      if (orderedCollectionIds.length !== state.collections.length) {
        return;
      }

      const collectionsById = new Map(
        state.collections.map((collection) => [collection.id, collection])
      );
      const reordered = orderedCollectionIds.map((id) => collectionsById.get(id));
      if (reordered.some((collection) => collection == null)) {
        return;
      }

      state.collections = reordered as Collection[];
    },
    /**
     * Optimistically reorders folders within one collection before IPC persistence.
     */
    reorderFoldersLocal(
      state,
      action: PayloadAction<{ collectionId: number; orderedFolderIds: number[] }>
    ) {
      const { collectionId, orderedFolderIds } = action.payload;
      const folders = state.foldersByCollection[collectionId] ?? [];
      if (orderedFolderIds.length !== folders.length) {
        return;
      }

      const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
      const reordered = orderedFolderIds.map((id) => foldersById.get(id));
      if (reordered.some((folder) => folder == null)) {
        return;
      }

      state.foldersByCollection[collectionId] = reordered as Folder[];
    },
    /**
     * Optimistically rewrites unified container sort_order values before IPC persistence.
     */
    reorderContainerItemsLocal(
      state,
      action: PayloadAction<{
        collectionId: number;
        folderId: number | null;
        items: ContainerItemRef[];
      }>
    ) {
      const { collectionId, items } = action.payload;
      const requests = state.requestsByCollection[collectionId] ?? [];
      const documents = state.documentsByCollection[collectionId] ?? [];

      items.forEach((item, index) => {
        if (item.kind === 'request') {
          const request = requests.find((entry) => entry.id === item.id);
          if (request != null) {
            request.sort_order = index;
          }
          return;
        }

        const document = documents.find((entry) => entry.id === item.id);
        if (document != null) {
          document.sort_order = index;
        }
      });
    },
    /**
     * Optimistically moves a request or document into another folder container before IPC persistence.
     */
    moveContainerItemLocal(
      state,
      action: PayloadAction<{
        collectionId: number;
        kind: 'request' | 'document';
        id: number;
        targetFolderId: number | null;
        index: number;
      }>
    ) {
      const { collectionId, kind, id, targetFolderId, index } = action.payload;
      const requests = state.requestsByCollection[collectionId] ?? [];
      const documents = state.documentsByCollection[collectionId] ?? [];

      let sourceFolderId: number | null = null;
      if (kind === 'request') {
        const request = requests.find((entry) => entry.id === id);
        if (request == null) {
          return;
        }
        sourceFolderId = request.folder_id ?? null;
        request.folder_id = targetFolderId;
      } else {
        const document = documents.find((entry) => entry.id === id);
        if (document == null) {
          return;
        }
        sourceFolderId = document.folder_id ?? null;
        document.folder_id = targetFolderId;
      }

      const assignContainerSortOrder = (containerRefs: ContainerItemRef[]): void => {
        containerRefs.forEach((item, sortOrder) => {
          if (item.kind === 'request') {
            const request = requests.find((entry) => entry.id === item.id);
            if (request != null) {
              request.sort_order = sortOrder;
            }
            return;
          }

          const document = documents.find((entry) => entry.id === item.id);
          if (document != null) {
            document.sort_order = sortOrder;
          }
        });
      };

      const movedRef: ContainerItemRef = { kind, id };
      const targetRefs = toContainerItemRefs(
        mergeContainerItems(requests, documents, targetFolderId)
      ).filter((item) => !(item.kind === kind && item.id === id));
      const clampedIndex = Math.min(Math.max(0, index), targetRefs.length);
      targetRefs.splice(clampedIndex, 0, movedRef);
      assignContainerSortOrder(targetRefs);

      if (sourceFolderId !== targetFolderId) {
        const sourceRefs = toContainerItemRefs(
          mergeContainerItems(requests, documents, sourceFolderId)
        );
        assignContainerSortOrder(sourceRefs);
      }
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
  upsertDocumentInCollection,
  reorderCollectionsLocal,
  reorderFoldersLocal,
  reorderContainerItemsLocal,
  moveContainerItemLocal
} = collectionsSlice.actions;
export default collectionsSlice.reducer;
