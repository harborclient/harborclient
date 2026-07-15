import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import type { ContainerItemRef } from '#/shared/collectionContainerOrder';
import type {
  AuthConfig,
  Collection,
  CollectionDocument,
  CollectionExportResult,
  Folder,
  GitRequestDiffFileEntry,
  ImportEntityResult,
  KeyValue,
  ScriptRef,
  StorageConnection,
  Variable
} from '#/shared/types';
import {
  resolveGitChangeSidebarTarget,
  type GitChangeSidebarTarget
} from '#/renderer/src/git/resolveGitChangeSidebarTarget';
import { mirrorLegacyScriptString } from '#/shared/scriptRefs';
import { resolveImportedRunnerTargetIds } from '#/shared/collectionRunner';
import {
  focusSidebarItem as focusSidebarItemAction,
  moveContainerItemLocal,
  reorderCollectionsLocal,
  reorderContainerItemsLocal,
  reorderFoldersLocal,
  setCollections,
  setFoldersForCollection,
  setRequestsForCollection,
  setSelectedCollectionId,
  updateCollectionColor,
  upsertDocumentInCollection,
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
  openPageTab,
  syncRequestFolderInTabs
} from '#/renderer/src/store/slices/tabsSlice';
import { importCollectionRunnerResults } from '#/renderer/src/store/slices/modalsSlice';
import type { AppDispatch, ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  beginRefreshGeneration,
  collectionRefreshKey,
  isLatestRefreshGeneration
} from '#/renderer/src/store/refreshGeneration';
import { refreshEnvironments } from './environments';
import { refreshDocuments } from './documents';
import { refreshSnippets } from './snippets';
import { setTabGroups } from '#/renderer/src/store/slices/tabGroupSlice';
import { syncTrash } from './trash';
import { syncThemeMenuNow } from '#/renderer/src/plugins/themeMenuSync';
import {
  getRegisteredImportExtensions,
  getImportHandlerSnapshot,
  runPluginImportHandlers
} from '#/renderer/src/plugins/pluginImportHandlers';
import { logImportVerbose } from '#/renderer/src/import/importVerboseLog';
import { defaultDraft, isRequestTab, isTabDirty, type Tab } from '#/renderer/src/store/drafts';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { requestLoadDocument } from './documents';
import { requestLoadRequest } from './requests';

const COLLECTIONS_REFRESH_KEY = 'collections';

/**
 * Returns true when a tab is the initial pristine unsaved default request tab.
 *
 * @param tab - Open tab from startup hydration.
 * @returns True when the tab matches a fresh default draft with no saved id or URL.
 */
export function isPristineDefaultRequestTab(tab: Tab): boolean {
  if (!isRequestTab(tab) || isTabDirty(tab)) {
    return false;
  }

  const { draft } = tab;
  if (draft.id != null) {
    return false;
  }
  if (draft.name !== defaultDraft().name) {
    return false;
  }

  return draft.url.trim().length === 0;
}

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
    await dispatch(refreshDocuments(collectionId));
  }
);

/**
 * Opens the first built-in seeded request after a true first-run import.
 *
 * Consumes the one-shot target from main-process storage, loads collection contents,
 * replaces the pristine default blank tab, and focuses the saved request tab.
 */
export const openSeededBuiltinRequestIfNeeded = createAsyncThunk<void, void, ThunkApiConfig>(
  'collections/openSeededBuiltinRequestIfNeeded',
  async (_, { dispatch, getState }) => {
    const target = await window.api.consumeBuiltinCollectionOpenRequestTarget();
    if (target == null) {
      return;
    }

    let state = getState();
    const collection = state.collections.collections.find(
      (entry) => entry.uuid === target.collectionUuid
    );
    if (collection == null) {
      return;
    }

    dispatch(setSelectedCollectionId(collection.id));
    await dispatch(refreshCollectionContents(collection.id));

    state = getState();
    const request = (state.collections.requestsByCollection[collection.id] ?? []).find(
      (entry) => entry.uuid === target.requestUuid
    );
    if (request == null) {
      return;
    }

    for (const tab of state.tabs.tabs) {
      if (isPristineDefaultRequestTab(tab)) {
        dispatch(closeTab(tab.tabId));
      }
    }

    await dispatch(
      requestLoadRequest({
        req: request,
        skipSettingsCheck: true,
        activate: true
      })
    );
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
 * Persists a git connection for a new collection and mounts it.
 */
export const createGitConnectionForCollection = createAsyncThunk<
  StorageConnection & { type: 'git' },
  {
    name: string;
    repoPath: string;
    url: string;
    branch: string;
    subdir?: string;
    initGitRepo?: boolean;
  },
  ThunkApiConfig
>(
  'collections/createGitConnection',
  async ({ name, repoPath, url, branch, subdir = '', initGitRepo = false }) => {
    const trimmedRepoPath = repoPath.trim();
    const trimmedUrl = url.trim();
    const trimmedBranch = branch.trim() || 'main';

    if (initGitRepo) {
      await window.api.gitInitRepo(trimmedRepoPath, trimmedUrl, trimmedBranch);
    }

    const connectionId = crypto.randomUUID();
    const connection: StorageConnection = {
      id: connectionId,
      name: name.trim() || 'Git collection',
      type: 'git',
      collectionDiscoverySkipped: true,
      settings: {
        repoPath: trimmedRepoPath,
        url: trimmedUrl,
        branch: trimmedBranch,
        subdir: subdir.trim(),
        auth: { kind: 'pat', username: 'token' }
      }
    };
    await window.api.saveStorageConnection(connection);
    const connections = await window.api.listStorageConnections();
    const saved = connections.find((item) => item.id === connectionId);
    if (!saved || saved.type !== 'git') {
      throw new Error('Failed to save git connection.');
    }
    return saved;
  }
);

/**
 * Creates a collection in an existing git connection and selects it in the sidebar.
 */
export const createGitCollection = createAsyncThunk<
  Collection,
  { name: string; connectionId: string },
  ThunkApiConfig
>('collections/createGitCollection', async ({ name, connectionId }, { dispatch }) => {
  const collection = await window.api.createCollection(name, connectionId);
  await dispatch(refreshCollections());
  dispatch(setSelectedCollectionId(collection.id));
  return collection;
});

/**
 * Removes a git connection that was created for collection setup but never linked to a collection.
 */
export const deleteOrphanGitConnection = createAsyncThunk<void, string, ThunkApiConfig>(
  'collections/deleteOrphanGitConnection',
  async (connectionId) => {
    await window.api.deleteStorageConnection(connectionId);
  }
);

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
      await dispatch(refreshCollectionContents(updated.id));
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
    await syncTrash(dispatch);
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
    const pluginExtensions = getRegisteredImportExtensions();
    const handlerSnapshot = getImportHandlerSnapshot();
    logImportVerbose('menu thunk start', {
      pluginExtensions,
      handlerCount: handlerSnapshot.length,
      handlers: handlerSnapshot
    });
    const result = await window.api.importEntity(selectedId, pluginExtensions);
    if (!result) {
      logImportVerbose('menu thunk canceled');
      return null;
    }

    logImportVerbose('menu thunk result', { kind: result.kind });

    if (result.kind === 'plugin-file') {
      await runPluginImportHandlers(result.file);
      logImportVerbose('menu thunk plugin handler completed', {
        fileName: result.file.name,
        extension: result.file.extension
      });
      return null;
    }

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
      case 'tab_group': {
        dispatch(setTabGroups(result.tabGroups));
        toast.success('Tab group imported');
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
  dispatch(reorderCollectionsLocal({ orderedCollectionIds }));
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
  await syncTrash(dispatch);
});

/**
 * Persists a new folder order for a collection.
 */
export const reorderFolders = createAsyncThunk<
  void,
  { collectionId: number; orderedFolderIds: number[] },
  ThunkApiConfig
>('collections/reorderFolders', async ({ collectionId, orderedFolderIds }, { dispatch }) => {
  dispatch(reorderFoldersLocal({ collectionId, orderedFolderIds }));
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
    dispatch(
      reorderContainerItemsLocal({
        collectionId,
        folderId,
        items: orderedRequestIds.map((id) => ({ kind: 'request', id }))
      })
    );
    await window.api.reorderRequests(collectionId, folderId, orderedRequestIds);
    await dispatch(refreshRequests(collectionId));
  }
);

/**
 * Persists unified sidebar order for requests and markdown documents in one container.
 */
export const reorderContainerItems = createAsyncThunk<
  void,
  { collectionId: number; folderId: number | null; items: ContainerItemRef[] },
  ThunkApiConfig
>('collections/reorderContainerItems', async ({ collectionId, folderId, items }, { dispatch }) => {
  dispatch(reorderContainerItemsLocal({ collectionId, folderId, items }));
  await window.api.reorderContainerItems(collectionId, folderId, items);
  await dispatch(refreshRequests(collectionId));
  await dispatch(refreshDocuments(collectionId));
});

/**
 * Moves a request into a folder (or back to the collection root) at a specific index.
 */
export const moveRequestToFolder = createAsyncThunk<
  void,
  { collectionId: number; requestId: number; folderId: number | null; index: number },
  ThunkApiConfig
>('collections/moveRequest', async ({ collectionId, requestId, folderId, index }, { dispatch }) => {
  dispatch(
    moveContainerItemLocal({
      collectionId,
      kind: 'request',
      id: requestId,
      targetFolderId: folderId,
      index
    })
  );
  await window.api.moveRequest(requestId, folderId, index);
  await dispatch(refreshRequests(collectionId));
  await dispatch(refreshDocuments(collectionId));
  dispatch(syncRequestFolderInTabs({ requestId, folderId }));
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

/**
 * Persists a collection sidebar color and updates the cached list row.
 */
export const setSidebarItemColor = createAsyncThunk<
  Collection,
  { kind: 'collection'; id: number; color: string | null },
  ThunkApiConfig
>('collections/setSidebarColor', async ({ id, color }, { dispatch }) => {
  const collection = await window.api.setCollectionColor(id, color);
  dispatch(updateCollectionColor(collection));
  return collection;
});

/**
 * Persists a folder sidebar color and updates the cached collection folders.
 */
export const setFolderSidebarColor = createAsyncThunk<
  Folder,
  { collectionId: number; id: number; color: string | null },
  ThunkApiConfig
>('collections/setFolderSidebarColor', async ({ collectionId, id, color }, { dispatch }) => {
  const folder = await window.api.setFolderColor(id, color);
  dispatch(upsertFolderInCollection({ collectionId, folder }));
  return folder;
});

/**
 * Persists a document sidebar color and updates the cached collection documents.
 */
export const setDocumentSidebarColor = createAsyncThunk<
  CollectionDocument,
  { collectionId: number; id: number; color: string | null },
  ThunkApiConfig
>('collections/setDocumentSidebarColor', async ({ collectionId, id, color }, { dispatch }) => {
  const document = await window.api.setDocumentColor(id, color);
  dispatch(upsertDocumentInCollection({ collectionId, document }));
  return document;
});

/**
 * Payload for {@link focusGitChangeInCollectionSidebar}.
 */
export interface FocusGitChangeInCollectionSidebarArgs {
  /**
   * Changed file entry selected in the Git sidebar.
   */
  file: GitRequestDiffFileEntry;

  /**
   * Stable uuid for the active git-backed collection.
   */
  collectionUuid: string;
}

/**
 * Reveals a git change in the collections sidebar and opens its item in a background tab.
 */
export const focusGitChangeInCollectionSidebar = createAsyncThunk<
  GitChangeSidebarTarget | null,
  FocusGitChangeInCollectionSidebarArgs,
  ThunkApiConfig
>(
  'collections/focusGitChangeInCollectionSidebar',
  async ({ file, collectionUuid }, { dispatch, getState }) => {
    const state = getState();
    const collection = state.collections.collections.find((entry) => entry.uuid === collectionUuid);
    if (collection == null) {
      return null;
    }

    await dispatch(refreshCollectionContents(collection.id));

    const refreshedState = getState();
    const target = resolveGitChangeSidebarTarget(file, collectionUuid, {
      collections: refreshedState.collections.collections,
      requestsByCollection: refreshedState.collections.requestsByCollection,
      documentsByCollection: refreshedState.collections.documentsByCollection
    });
    if (target == null) {
      return null;
    }

    dispatch(setShowSidebar(true));
    dispatch(
      focusSidebarItemAction({
        collectionId: target.collectionId,
        folderId: target.folderId
      })
    );

    if (target.kind === 'request') {
      const request = (
        refreshedState.collections.requestsByCollection[target.collectionId] ?? []
      ).find((entry) => entry.id === target.id);
      if (request == null) {
        return null;
      }
      await dispatch(
        requestLoadRequest({ req: request, activate: false, skipSettingsCheck: true })
      );
      return target;
    }

    const document = (
      refreshedState.collections.documentsByCollection[target.collectionId] ?? []
    ).find((entry) => entry.id === target.id);
    if (document == null) {
      return null;
    }

    await dispatch(
      requestLoadDocument({ doc: document, activate: false, skipSettingsCheck: true })
    );
    return target;
  }
);
