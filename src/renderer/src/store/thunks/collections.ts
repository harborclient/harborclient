import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import type {
  Collection,
  CollectionExportResult,
  Folder,
  KeyValue,
  Variable
} from '#/shared/types';
import {
  setCollections,
  setFoldersForCollection,
  setRequestsForCollection,
  setSelectedCollectionId
} from '#/renderer/src/store/slices/collectionsSlice';
import { closeTabsForCollection, closeTabsForRequest } from '#/renderer/src/store/slices/tabsSlice';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';

/** Reloads all collections from the active database and auto-selects the first when none is selected. */
export const refreshCollections = createAsyncThunk<Collection[], void, ThunkApiConfig>(
  'collections/refresh',
  async (_, { dispatch, getState }) => {
    const { collections, warnings } = await window.api.listCollections();
    for (const warning of warnings) {
      toast.error(warning);
    }
    dispatch(setCollections(collections));
    const selectedId = getState().collections.selectedCollectionId;
    if (collections.length > 0 && !selectedId) {
      dispatch(setSelectedCollectionId(collections[0].id));
    }
    return collections;
  }
);

/** Reloads folder metadata for a single collection. */
export const refreshFolders = createAsyncThunk<
  Awaited<ReturnType<typeof window.api.listFolders>>,
  number,
  ThunkApiConfig
>('collections/refreshFolders', async (collectionId, { dispatch }) => {
  const data = await window.api.listFolders(collectionId);
  dispatch(setFoldersForCollection({ collectionId, folders: data }));
  return data;
});

/** Reloads both folders and requests for a collection. */
export const refreshCollectionContents = createAsyncThunk<void, number, ThunkApiConfig>(
  'collections/refreshContents',
  async (collectionId, { dispatch }) => {
    await dispatch(refreshFolders(collectionId));
    await dispatch(refreshRequests(collectionId));
  }
);

/** Reloads saved requests for a single collection. */
export const refreshRequests = createAsyncThunk<
  Awaited<ReturnType<typeof window.api.listRequests>>,
  number,
  ThunkApiConfig
>('collections/refreshRequests', async (collectionId, { dispatch }) => {
  const data = await window.api.listRequests(collectionId);
  dispatch(setRequestsForCollection({ collectionId, requests: data }));
  return data;
});

/** Creates a collection and selects it in the sidebar. */
export const createCollection = createAsyncThunk<Collection, string, ThunkApiConfig>(
  'collections/create',
  async (name, { dispatch }) => {
    const collection = await window.api.createCollection(name);
    await dispatch(refreshCollections());
    dispatch(setSelectedCollectionId(collection.id));
    return collection;
  }
);

/** Updates collection metadata and optionally moves it to another database connection. */
export const updateCollection = createAsyncThunk<
  Collection,
  {
    id: number;
    name: string;
    variables: Variable[];
    headers: KeyValue[];
    preRequestScript: string;
    postRequestScript: string;
    connectionId?: string;
  },
  ThunkApiConfig
>(
  'collections/update',
  async (
    { id, name, variables, headers, preRequestScript, postRequestScript, connectionId },
    { dispatch, getState }
  ) => {
    const state = getState();
    const collection = state.collections.collections.find((item) => item.id === id);
    const primaryConnectionId = await window.api.getActiveDatabaseId();
    const currentConnectionId = collection?.connectionId ?? primaryConnectionId;

    await window.api.updateCollection(
      id,
      name,
      variables,
      headers,
      preRequestScript,
      postRequestScript
    );

    if (connectionId && connectionId !== currentConnectionId) {
      dispatch(closeTabsForCollection(id));
      const moved = await window.api.moveCollection(id, connectionId);
      await dispatch(refreshCollections());
      dispatch(setSelectedCollectionId(moved.id));
      await dispatch(refreshRequests(moved.id));
      return moved;
    }

    await dispatch(refreshCollections());
    const refreshed = getState().collections.collections.find((item) => item.id === id);
    if (!refreshed) {
      throw new Error(`Collection not found after update: ${id}`);
    }
    return refreshed;
  }
);

/** Deletes a collection and clears selection when it was active. */
export const deleteCollection = createAsyncThunk<void, number, ThunkApiConfig>(
  'collections/delete',
  async (id, { dispatch, getState }) => {
    await window.api.deleteCollection(id);
    if (getState().collections.selectedCollectionId === id) {
      dispatch(setSelectedCollectionId(null));
    }
    await dispatch(refreshCollections());
  }
);

/** Exports a collection to a user-chosen file path. */
export const exportCollection = createAsyncThunk<CollectionExportResult, number, ThunkApiConfig>(
  'collections/export',
  async (id) => {
    return window.api.exportCollection(id);
  }
);

/** Imports a collection from disk and refreshes sidebar state. */
export const importCollection = createAsyncThunk<Collection | null, void, ThunkApiConfig>(
  'collections/import',
  async (_, { dispatch }) => {
    const collection = await window.api.importCollection();
    if (!collection) return null;

    await dispatch(refreshCollections());
    dispatch(setSelectedCollectionId(collection.id));
    await dispatch(refreshCollectionContents(collection.id));
    return collection;
  }
);

/** Creates a folder inside a collection. */
export const createFolder = createAsyncThunk<
  Folder,
  { collectionId: number; name: string },
  ThunkApiConfig
>('collections/createFolder', async ({ collectionId, name }, { dispatch }) => {
  const folder = await window.api.createFolder(collectionId, name);
  await dispatch(refreshFolders(collectionId));
  return folder;
});

/** Renames an existing folder. */
export const renameFolder = createAsyncThunk<
  Folder,
  { id: number; collectionId: number; name: string },
  ThunkApiConfig
>('collections/renameFolder', async ({ id, collectionId, name }, { dispatch }) => {
  const folder = await window.api.renameFolder(id, name);
  await dispatch(refreshFolders(collectionId));
  return folder;
});

/** Deletes a folder and closes any open tabs for requests it contained. */
export const deleteFolder = createAsyncThunk<
  void,
  { id: number; collectionId: number; requestIds: number[] },
  ThunkApiConfig
>('collections/deleteFolder', async ({ id, collectionId, requestIds }, { dispatch }) => {
  for (const requestId of requestIds) {
    await window.api.deleteRequestEditorTab(String(requestId));
    dispatch(closeTabsForRequest(requestId));
  }
  await window.api.deleteFolder(id);
  await dispatch(refreshCollectionContents(collectionId));
});

/** Persists a new folder order for a collection. */
export const reorderFolders = createAsyncThunk<
  void,
  { collectionId: number; orderedFolderIds: number[] },
  ThunkApiConfig
>('collections/reorderFolders', async ({ collectionId, orderedFolderIds }, { dispatch }) => {
  await window.api.reorderFolders(collectionId, orderedFolderIds);
  await dispatch(refreshFolders(collectionId));
});

/** Persists a new request order within a folder or the collection root. */
export const reorderRequests = createAsyncThunk<
  void,
  { collectionId: number; folderId: number | null; orderedRequestIds: number[] },
  ThunkApiConfig
>(
  'collections/reorderRequests',
  async ({ collectionId, folderId, orderedRequestIds }, { dispatch }) => {
    await window.api.reorderRequests(collectionId, folderId, orderedRequestIds);
    await dispatch(refreshRequests(collectionId));
  }
);

/** Moves a request into a folder (or back to the collection root) at a specific index. */
export const moveRequestToFolder = createAsyncThunk<
  void,
  { collectionId: number; requestId: number; folderId: number | null; index: number },
  ThunkApiConfig
>('collections/moveRequest', async ({ collectionId, requestId, folderId, index }, { dispatch }) => {
  await window.api.moveRequest(requestId, folderId, index);
  await dispatch(refreshRequests(collectionId));
});
