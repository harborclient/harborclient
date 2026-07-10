import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import type {
  AuthConfig,
  Collection,
  CollectionExportResult,
  Folder,
  ImportEntityResult,
  KeyValue,
  ScriptRef,
  Variable
} from '#/shared/types';
import { mirrorLegacyScriptString } from '#/shared/scriptRefs';
import { resolveImportedRunnerTargetIds } from '#/shared/collectionRunner';
import {
  focusSidebarItem as focusSidebarItemAction,
  setCollections,
  setFoldersForCollection,
  setRequestsForCollection,
  setSelectedCollectionId,
  upsertFolderInCollection
} from '#/renderer/src/store/slices/collectionsSlice';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import {
  setShowSidebar,
  bumpCustomThemesReloadNonce
} from '#/renderer/src/store/slices/navigationSlice';
import {
  closeTabsForCollection,
  closeTabsForRequest,
  openPageTab
} from '#/renderer/src/store/slices/tabsSlice';
import { importCollectionRunnerResults } from '#/renderer/src/store/slices/modalsSlice';
import type { AppDispatch, ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  beginRefreshGeneration,
  collectionRefreshKey,
  isLatestRefreshGeneration
} from '#/renderer/src/store/refreshGeneration';
import { refreshEnvironments } from '#/renderer/src/store/thunks/environments';
import { refreshSnippets } from '#/renderer/src/store/thunks/snippets';
import { syncThemeMenuNow } from '#/renderer/src/plugins/themeMenuSync';

const COLLECTIONS_REFRESH_KEY = 'collections';

/**
 * Reloads all collections from the active database and auto-selects the first when none is selected.
 */
export const refreshCollections = createAsyncThunk<Collection[], void, ThunkApiConfig>(
  'collections/refresh',
  async (_, { dispatch, getState }) => {
    const generation = beginRefreshGeneration(COLLECTIONS_REFRESH_KEY);
    const { collections, warnings } = await window.api.listCollections();
    if (!isLatestRefreshGeneration(COLLECTIONS_REFRESH_KEY, generation)) {
      return getState().collections.collections;
    }
    for (const warning of warnings) {
      toast.error(warning);
    }
    dispatch(setCollections(collections));
    const selectedId = getState().collections.selectedCollectionId;
    const selectedStillExists =
      selectedId != null && collections.some((collection) => collection.id === selectedId);
    if (selectedId != null && !selectedStillExists) {
      dispatch(setSelectedCollectionId(null));
    }
    if (collections.length > 0 && (selectedId == null || !selectedStillExists)) {
      dispatch(setSelectedCollectionId(collections[0].id));
    }
    return collections;
  }
);

/**
 * Reloads folder metadata for a single collection.
 */
export const refreshFolders = createAsyncThunk<
  Awaited<ReturnType<typeof window.api.listFolders>>,
  number,
  ThunkApiConfig
>('collections/refreshFolders', async (collectionId, { dispatch, getState }) => {
  const refreshKey = collectionRefreshKey('folders', collectionId);
  const generation = beginRefreshGeneration(refreshKey);
  const data = await window.api.listFolders(collectionId);
  if (!isLatestRefreshGeneration(refreshKey, generation)) {
    return getState().collections.foldersByCollection[collectionId] ?? [];
  }
  dispatch(setFoldersForCollection({ collectionId, folders: data }));
  return data;
});

/**
 * Reloads both folders and requests for a collection.
 */
export const refreshCollectionContents = createAsyncThunk<void, number, ThunkApiConfig>(
  'collections/refreshContents',
  async (collectionId, { dispatch }) => {
    await dispatch(refreshFolders(collectionId));
    await dispatch(refreshRequests(collectionId));
  }
);

/**
 * Reloads saved requests for a single collection.
 */
export const refreshRequests = createAsyncThunk<
  Awaited<ReturnType<typeof window.api.listRequests>>,
  number,
  ThunkApiConfig
>('collections/refreshRequests', async (collectionId, { dispatch, getState }) => {
  const refreshKey = collectionRefreshKey('requests', collectionId);
  const generation = beginRefreshGeneration(refreshKey);
  const data = await window.api.listRequests(collectionId);
  if (!isLatestRefreshGeneration(refreshKey, generation)) {
    return getState().collections.requestsByCollection[collectionId] ?? [];
  }
  dispatch(setRequestsForCollection({ collectionId, requests: data }));
  return data;
});

/**
 * Creates a collection and selects it in the sidebar.
 */
export const createCollection = createAsyncThunk<
  Collection,
  { name: string; providerId?: string },
  ThunkApiConfig
>('collections/create', async ({ name, providerId }, { dispatch }) => {
  const collection = await window.api.createCollection(name, providerId);
  await dispatch(refreshCollections());
  dispatch(setSelectedCollectionId(collection.id));
  return collection;
});

/**
 * Updates collection metadata and optionally moves it to another database connection.
 */
export const updateCollection = createAsyncThunk<
  Collection,
  {
    id: number;
    name: string;
    variables: Variable[];
    headers: KeyValue[];
    preRequestScript: string;
    postRequestScript: string;
    preRequestScripts?: ScriptRef[];
    postRequestScripts?: ScriptRef[];
    auth: AuthConfig;
    connectionId?: string;
  },
  ThunkApiConfig
>(
  'collections/update',
  async (
    {
      id,
      name,
      variables,
      headers,
      preRequestScript,
      postRequestScript,
      preRequestScripts = [],
      postRequestScripts = [],
      auth,
      connectionId
    },
    { dispatch, getState }
  ) => {
    const legacyPre =
      preRequestScripts.length > 0 ? mirrorLegacyScriptString(preRequestScripts) : preRequestScript;
    const legacyPost =
      postRequestScripts.length > 0
        ? mirrorLegacyScriptString(postRequestScripts)
        : postRequestScript;
    const state = getState();
    const collection = state.collections.collections.find((item) => item.id === id);
    const primaryConnectionId = await window.api.getActiveStorageId();
    const currentConnectionId = collection?.connectionId ?? primaryConnectionId;

    if (connectionId && connectionId !== currentConnectionId) {
      await window.api.moveCollection(id, connectionId);
      dispatch(closeTabsForCollection(id));

      let updated: Collection;
      try {
        updated = await window.api.updateCollection(
          id,
          name,
          variables,
          headers,
          legacyPre,
          legacyPost,
          auth,
          preRequestScripts,
          postRequestScripts
        );
      } catch (err) {
        await dispatch(refreshCollections());
        throw new Error(
          'Collection was moved to the new database, but your settings could not be saved. Open collection settings and save again.',
          { cause: err }
        );
      }

      await dispatch(refreshCollections());
      dispatch(setSelectedCollectionId(updated.id));
      await dispatch(refreshRequests(updated.id));
      return updated;
    }

    await window.api.updateCollection(
      id,
      name,
      variables,
      headers,
      legacyPre,
      legacyPost,
      auth,
      preRequestScripts,
      postRequestScripts
    );

    await dispatch(refreshCollections());
    const refreshed = getState().collections.collections.find((item) => item.id === id);
    if (!refreshed) {
      throw new Error(`Collection not found after update: ${id}`);
    }
    return refreshed;
  }
);

/**
 * Deletes a collection and clears selection when it was active.
 */
export const deleteCollection = createAsyncThunk<void, number, ThunkApiConfig>(
  'collections/delete',
  async (id, { dispatch, getState }) => {
    await window.api.deleteCollection(id);
    dispatch(closeTabsForCollection(id));
    if (getState().collections.selectedCollectionId === id) {
      dispatch(setSelectedCollectionId(null));
    }
    await dispatch(refreshCollections());
  }
);

/**
 * Deep-copies a collection and places the duplicate directly below the original.
 */
export const duplicateCollection = createAsyncThunk<Collection, number, ThunkApiConfig>(
  'collections/duplicate',
  async (id, { dispatch, getState }) => {
    const created = await window.api.duplicateCollection(id);
    await dispatch(refreshCollections());

    const collections = getState().collections.collections;
    const sourceIndex = collections.findIndex((item) => item.id === id);
    if (sourceIndex >= 0) {
      const orderedIds = collections.map((item) => item.id);
      orderedIds.splice(sourceIndex + 1, 0, created.id);
      const dedupedIds = orderedIds.filter(
        (collectionId, index) => orderedIds.indexOf(collectionId) === index
      );
      await dispatch(reorderCollections({ orderedCollectionIds: dedupedIds }));
    }

    dispatch(setSelectedCollectionId(created.id));
    await dispatch(refreshCollectionContents(created.id));
    return created;
  }
);

/**
 * Exports a collection to a user-chosen file path.
 */
export const exportCollection = createAsyncThunk<CollectionExportResult, number, ThunkApiConfig>(
  'collections/export',
  async (id) => {
    return window.api.exportCollection(id);
  }
);

/**
 * Imports a collection from disk and refreshes sidebar state.
 */
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

/**
 * Imports a collection, request, or environment from File -> Import.
 */
export const importFromMenu = createAsyncThunk<ImportEntityResult | null, void, ThunkApiConfig>(
  'collections/importFromMenu',
  async (_, { dispatch, getState }) => {
    const selectedId = getState().collections.selectedCollectionId;
    const result = await window.api.importEntity(selectedId);
    if (!result) return null;

    switch (result.kind) {
      case 'collection': {
        await dispatch(refreshCollections());
        dispatch(setSelectedCollectionId(result.collection.id));
        await dispatch(refreshCollectionContents(result.collection.id));
        toast.success(result.action === 'updated' ? 'Collection updated' : 'Collection imported');
        break;
      }
      case 'request': {
        if (selectedId != null) {
          await dispatch(refreshRequests(selectedId));
        }
        toast.success(result.action === 'updated' ? 'Request updated' : 'Request imported');
        break;
      }
      case 'environment': {
        await dispatch(refreshEnvironments());
        dispatch(setActiveEnvironmentId(result.environment.id));
        toast.success(result.action === 'updated' ? 'Environment updated' : 'Environment imported');
        break;
      }
      case 'run-results': {
        const state = getState();
        const { collectionId, requestId } = resolveImportedRunnerTargetIds(
          result.data,
          state.collections.collections,
          state.collections.requestsByCollection
        );
        dispatch(
          importCollectionRunnerResults({
            ...result.data,
            collectionId,
            requestId
          })
        );
        dispatch(
          openPageTab({
            type: 'collection-runner',
            collectionId: collectionId > 0 ? collectionId : 0
          })
        );
        toast.success('Run results imported');
        break;
      }
      case 'snippet': {
        await dispatch(refreshSnippets());
        dispatch(openPageTab({ type: 'snippets' }));
        toast.success(result.action === 'updated' ? 'Snippet updated' : 'Snippet imported');
        break;
      }
      case 'theme': {
        dispatch(bumpCustomThemesReloadNonce());
        await syncThemeMenuNow();
        dispatch(openPageTab({ type: 'themes' }));
        toast.success(result.action === 'updated' ? 'Theme updated' : 'Theme imported');
        break;
      }
    }

    return result;
  }
);

/**
 * Persists a new sidebar order for collections.
 */
export const reorderCollections = createAsyncThunk<
  void,
  { orderedCollectionIds: number[] },
  ThunkApiConfig
>('collections/reorderCollections', async ({ orderedCollectionIds }, { dispatch }) => {
  await window.api.reorderCollections(orderedCollectionIds);
  await dispatch(refreshCollections());
});

/**
 * Creates a folder inside a collection.
 */
export const createFolder = createAsyncThunk<
  Folder,
  { collectionId: number; name: string },
  ThunkApiConfig
>('collections/createFolder', async ({ collectionId, name }, { dispatch }) => {
  const folder = await window.api.createFolder(collectionId, name);
  await dispatch(refreshFolders(collectionId));
  return folder;
});

/**
 * Renames an existing folder.
 */
export const renameFolder = createAsyncThunk<
  Folder,
  { id: number; collectionId: number; name: string },
  ThunkApiConfig
>('collections/renameFolder', async ({ id, collectionId, name }, { dispatch }) => {
  const folder = await window.api.renameFolder(id, name);
  await dispatch(refreshFolders(collectionId));
  return folder;
});

/**
 * Updates folder metadata including variables, headers, auth, and scripts.
 */
export const updateFolder = createAsyncThunk<
  Folder,
  {
    id: number;
    collectionId: number;
    name: string;
    variables: Variable[];
    headers: KeyValue[];
    preRequestScript: string;
    postRequestScript: string;
    preRequestScripts?: ScriptRef[];
    postRequestScripts?: ScriptRef[];
    auth: AuthConfig;
  },
  ThunkApiConfig
>(
  'collections/updateFolder',
  async (
    {
      id,
      collectionId,
      name,
      variables,
      headers,
      preRequestScript,
      postRequestScript,
      preRequestScripts = [],
      postRequestScripts = [],
      auth
    },
    { dispatch }
  ) => {
    const legacyPre =
      preRequestScripts.length > 0 ? mirrorLegacyScriptString(preRequestScripts) : preRequestScript;
    const legacyPost =
      postRequestScripts.length > 0
        ? mirrorLegacyScriptString(postRequestScripts)
        : postRequestScript;
    const folder = await window.api.updateFolder(
      id,
      name,
      variables,
      headers,
      legacyPre,
      legacyPost,
      auth,
      preRequestScripts,
      postRequestScripts
    );
    dispatch(upsertFolderInCollection({ collectionId, folder }));
    await dispatch(refreshFolders(collectionId));
    return folder;
  }
);

/**
 * Deletes a folder and closes any open tabs for requests it contained.
 */
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

/**
 * Persists a new folder order for a collection.
 */
export const reorderFolders = createAsyncThunk<
  void,
  { collectionId: number; orderedFolderIds: number[] },
  ThunkApiConfig
>('collections/reorderFolders', async ({ collectionId, orderedFolderIds }, { dispatch }) => {
  await window.api.reorderFolders(collectionId, orderedFolderIds);
  await dispatch(refreshFolders(collectionId));
});

/**
 * Persists a new request order within a folder or the collection root.
 */
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

/**
 * Moves a request into a folder (or back to the collection root) at a specific index.
 */
export const moveRequestToFolder = createAsyncThunk<
  void,
  { collectionId: number; requestId: number; folderId: number | null; index: number },
  ThunkApiConfig
>('collections/moveRequest', async ({ collectionId, requestId, folderId, index }, { dispatch }) => {
  await window.api.moveRequest(requestId, folderId, index);
  await dispatch(refreshRequests(collectionId));
});

/**
 * Focuses a collection or folder in the sidebar (breadcrumb navigation).
 *
 * @param payload - Collection id and optional folder id to highlight.
 * @returns Thunk that reveals the sidebar and loads collection contents.
 */
export function focusSidebarItem(payload: {
  collectionId: number;
  folderId?: number | null;
}): (dispatch: AppDispatch) => void {
  return (dispatch) => {
    dispatch(setShowSidebar(true));
    dispatch(focusSidebarItemAction(payload));
    void dispatch(refreshCollectionContents(payload.collectionId));
  };
}
