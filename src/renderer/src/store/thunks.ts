import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import type {
  Collection,
  CollectionExportResult,
  Environment,
  KeyValue,
  SavedRequest,
  ScriptRequestContext,
  ScriptRunResult,
  ScriptTestResult,
  SendResult,
  Variable
} from '#/shared/types';
import {
  applyScriptRequestMutations,
  buildRuntimeVars,
  buildScriptSlots,
  mergeVariableSets,
  substituteWithMap
} from '#/renderer/src/store/scriptOrchestration';
import { cloneDraft, draftFromSaved } from '#/renderer/src/store/drafts';
import {
  setCollections,
  setRequestsForCollection,
  setSelectedCollectionId
} from '#/renderer/src/store/slices/collectionsSlice';
import {
  setActiveEnvironmentId,
  setEnvironments
} from '#/renderer/src/store/slices/environmentsSlice';
import { addConsoleEntry } from '#/renderer/src/store/slices/consoleSlice';
import {
  closeTabsForRequest,
  closeTabsForCollection,
  loadRequest,
  newTab,
  openTabWithDraft,
  updateActiveTabDraftAfterSave,
  updateTab
} from '#/renderer/src/store/slices/tabsSlice';
import type { AppDispatch, ThunkApiConfig } from '#/renderer/src/store/redux';
import { selectActiveTab } from '#/renderer/src/store/selectors';

export const refreshCollections = createAsyncThunk<
  Awaited<ReturnType<typeof window.api.listCollections>>,
  void,
  ThunkApiConfig
>('collections/refresh', async (_, { dispatch, getState }) => {
  const data = await window.api.listCollections();
  dispatch(setCollections(data));
  const selectedId = getState().collections.selectedCollectionId;
  if (data.length > 0 && !selectedId) {
    dispatch(setSelectedCollectionId(data[0].id));
  }
  return data;
});

export const refreshRequests = createAsyncThunk<
  Awaited<ReturnType<typeof window.api.listRequests>>,
  number,
  ThunkApiConfig
>('collections/refreshRequests', async (collectionId, { dispatch }) => {
  const data = await window.api.listRequests(collectionId);
  dispatch(setRequestsForCollection({ collectionId, requests: data }));
  return data;
});

export const refreshEnvironments = createAsyncThunk<
  Awaited<ReturnType<typeof window.api.listEnvironments>>,
  void,
  ThunkApiConfig
>('environments/refresh', async (_, { dispatch, getState }) => {
  const data = await window.api.listEnvironments();
  dispatch(setEnvironments(data));
  const activeId = getState().environments.activeEnvironmentId;
  if (activeId != null && !data.some((env) => env.id === activeId)) {
    dispatch(setActiveEnvironmentId(null));
  }
  return data;
});

export const createCollection = createAsyncThunk<Collection, string, ThunkApiConfig>(
  'collections/create',
  async (name, { dispatch }) => {
    const collection = await window.api.createCollection(name);
    await dispatch(refreshCollections());
    dispatch(setSelectedCollectionId(collection.id));
    return collection;
  }
);

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

export const exportCollection = createAsyncThunk<CollectionExportResult, number, ThunkApiConfig>(
  'collections/export',
  async (id) => {
    return window.api.exportCollection(id);
  }
);

export const importCollection = createAsyncThunk<Collection | null, void, ThunkApiConfig>(
  'collections/import',
  async (_, { dispatch }) => {
    const collection = await window.api.importCollection();
    if (!collection) return null;

    await dispatch(refreshCollections());
    dispatch(setSelectedCollectionId(collection.id));
    await dispatch(refreshRequests(collection.id));
    return collection;
  }
);

export const createEnvironment = createAsyncThunk<Environment, string, ThunkApiConfig>(
  'environments/create',
  async (name, { dispatch }) => {
    const environment = await window.api.createEnvironment(name);
    await dispatch(refreshEnvironments());
    dispatch(setActiveEnvironmentId(environment.id));
    return environment;
  }
);

export const updateEnvironment = createAsyncThunk<
  void,
  { id: number; name: string; variables: Variable[] },
  ThunkApiConfig
>('environments/update', async ({ id, name, variables }, { dispatch }) => {
  await window.api.updateEnvironment(id, name, variables);
  await dispatch(refreshEnvironments());
});

export const deleteEnvironment = createAsyncThunk<void, number, ThunkApiConfig>(
  'environments/delete',
  async (id, { dispatch, getState }) => {
    await window.api.deleteEnvironment(id);
    if (getState().environments.activeEnvironmentId === id) {
      dispatch(setActiveEnvironmentId(null));
    }
    await dispatch(refreshEnvironments());
  }
);

export const saveRequest = createAsyncThunk<SavedRequest, number | undefined, ThunkApiConfig>(
  'tabs/saveRequest',
  async (collectionId, { dispatch, getState }) => {
    const state = getState();
    const activeTab = selectActiveTab(state);
    if (!activeTab) throw new Error('No active tab');

    const targetId = collectionId ?? state.collections.selectedCollectionId;
    if (targetId == null) {
      throw new Error('Select a collection first');
    }

    const currentDraft = activeTab.draft;
    const shouldUpdate = currentDraft.id != null && currentDraft.collection_id === targetId;
    const saved = await window.api.saveRequest({
      id: shouldUpdate ? currentDraft.id : undefined,
      collection_id: targetId,
      name: currentDraft.name,
      method: currentDraft.method,
      url: currentDraft.url,
      headers: currentDraft.headers.filter((h) => h.key.trim() || h.value.trim()),
      params: currentDraft.params.filter((p) => p.key.trim() || p.value.trim()),
      body: currentDraft.body,
      body_type: currentDraft.body_type,
      pre_request_script: currentDraft.pre_request_script ?? '',
      post_request_script: currentDraft.post_request_script ?? '',
      comment: currentDraft.comment ?? ''
    });

    const savedDraft = cloneDraft(draftFromSaved(saved));
    dispatch(updateActiveTabDraftAfterSave({ tabId: activeTab.tabId, savedDraft }));
    await dispatch(refreshRequests(targetId));
    return saved;
  }
);

export const deleteRequest = createAsyncThunk<void, number, ThunkApiConfig>(
  'tabs/deleteRequest',
  async (id, { dispatch, getState }) => {
    await window.api.deleteRequest(id);
    await window.api.deleteRequestEditorTab(String(id));
    dispatch(closeTabsForRequest(id));

    const selectedCollectionId = getState().collections.selectedCollectionId;
    if (selectedCollectionId) {
      await dispatch(refreshRequests(selectedCollectionId));
    }
  }
);

export const newRequestInCollection = createAsyncThunk<SavedRequest, number, ThunkApiConfig>(
  'tabs/newRequestInCollection',
  async (collectionId, { dispatch }) => {
    dispatch(setSelectedCollectionId(collectionId));

    const saved = await window.api.saveRequest({
      collection_id: collectionId,
      name: 'Untitled Request',
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      body: '',
      body_type: 'none',
      pre_request_script: '',
      post_request_script: '',
      comment: ''
    });

    dispatch(openTabWithDraft(draftFromSaved(saved)));
    await dispatch(refreshRequests(collectionId));
    return saved;
  }
);

export const sendRequest = createAsyncThunk<void, void, ThunkApiConfig>(
  'tabs/sendRequest',
  async (_, { dispatch, getState }) => {
    const state = getState();
    const activeTab = selectActiveTab(state);
    if (!activeTab) return;

    const tabId = activeTab.tabId;
    const requestId = crypto.randomUUID();
    const currentDraft = activeTab.draft;
    const collectionId = currentDraft.collection_id ?? state.collections.selectedCollectionId;
    const collection = collectionId
      ? state.collections.collections.find((c) => c.id === collectionId)
      : undefined;
    const activeEnvironmentId = state.environments.activeEnvironmentId;
    const environment = activeEnvironmentId
      ? state.environments.environments.find((env) => env.id === activeEnvironmentId)
      : undefined;

    let runtimeVars = {
      ...buildRuntimeVars(collection?.variables ?? []),
      ...buildRuntimeVars(environment?.variables ?? [])
    };
    const allLogs: string[] = [];
    const allTests: ScriptTestResult[] = [];
    const scriptErrors: string[] = [];

    let scriptRequest: ScriptRequestContext = {
      method: currentDraft.method,
      url: currentDraft.url,
      headers: currentDraft.headers.map((header) => ({ ...header })),
      params: currentDraft.params.map((param) => ({ ...param })),
      body: currentDraft.body,
      bodyType: currentDraft.body_type
    };

    const runScriptPhase = async (phase: 'pre' | 'post', response?: SendResult): Promise<void> => {
      const slots = buildScriptSlots(
        collection?.pre_request_script ?? '',
        collection?.post_request_script ?? '',
        currentDraft.pre_request_script,
        currentDraft.post_request_script,
        phase
      );

      for (const slot of slots) {
        const scriptSource = substituteWithMap(slot.source, runtimeVars);
        const result: ScriptRunResult = await window.api.runScript({
          phase: slot.phase,
          script: scriptSource,
          request: scriptRequest,
          response,
          variables: runtimeVars
        });

        if (result.logs.length) {
          allLogs.push(`[${slot.label}]`, ...result.logs);
        }
        if (result.tests.length) {
          allTests.push(...result.tests);
        }
        if (result.error) {
          scriptErrors.push(`${slot.label}: ${result.error}`);
        }

        scriptRequest = applyScriptRequestMutations(scriptRequest, result);
        runtimeVars = mergeVariableSets(runtimeVars, result.variableSets);
      }
    };

    const isRequestStillActive = (): boolean => {
      const tab = getState().tabs.tabs.find((t) => t.tabId === tabId);
      return tab?.sendingRequestId === requestId;
    };

    dispatch(
      updateTab({
        tabId,
        updates: { sending: true, response: null, testResults: [], sendingRequestId: requestId }
      })
    );

    try {
      await runScriptPhase('pre');

      const resolvedUrl = substituteWithMap(scriptRequest.url, runtimeVars);
      const collectionHeaders = collection
        ? (collection.headers ?? []).map((header) => ({
            ...header,
            value: substituteWithMap(header.value, runtimeVars)
          }))
        : [];
      const draftHeaders = scriptRequest.headers.map((header) => ({
        ...header,
        value: substituteWithMap(header.value, runtimeVars)
      }));
      const headers = [...collectionHeaders, ...draftHeaders];
      const params = scriptRequest.params.map((param) => ({
        ...param,
        value: substituteWithMap(param.value, runtimeVars)
      }));
      const body = substituteWithMap(scriptRequest.body, runtimeVars);

      const result = await window.api.sendRequest(
        {
          method: scriptRequest.method,
          url: resolvedUrl,
          headers,
          params,
          body,
          bodyType: scriptRequest.bodyType
        },
        requestId
      );

      await runScriptPhase('post', result);

      if (isRequestStillActive()) {
        dispatch(
          updateTab({
            tabId,
            updates: { response: result, testResults: allTests }
          })
        );
        dispatch(
          addConsoleEntry({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            requestName: currentDraft.name,
            collectionName: collection?.name,
            result,
            logs: allLogs.length ? allLogs : undefined,
            tests: allTests.length ? allTests : undefined,
            scriptError: scriptErrors.length ? scriptErrors.join('\n') : undefined
          })
        );

        if (scriptErrors.length) {
          toast.error(`Script error: ${scriptErrors[0]}`);
        }
      }
    } finally {
      if (isRequestStillActive()) {
        dispatch(updateTab({ tabId, updates: { sending: false, sendingRequestId: null } }));
      }
    }
  }
);

export const cancelRequest = createAsyncThunk<void, void, ThunkApiConfig>(
  'tabs/cancelRequest',
  async (_, { dispatch, getState }) => {
    const activeTab = selectActiveTab(getState());
    if (!activeTab?.sendingRequestId) return;

    const { tabId, sendingRequestId } = activeTab;
    await window.api.cancelRequest(sendingRequestId);
    dispatch(
      updateTab({
        tabId,
        updates: { sending: false, sendingRequestId: null }
      })
    );
  }
);

/** Dispatches initial data loads on app mount. */
export function initializeStore(dispatch: AppDispatch): void {
  void dispatch(refreshCollections());
  void dispatch(refreshEnvironments());
}

/** Opens a saved request in a tab (sync action wrapper). */
export function dispatchLoadRequest(dispatch: AppDispatch, req: SavedRequest): void {
  dispatch(loadRequest(req));
}

/** Opens a new blank request tab (sync action wrapper). */
export function dispatchNewRequest(dispatch: AppDispatch): void {
  dispatch(newTab());
}
