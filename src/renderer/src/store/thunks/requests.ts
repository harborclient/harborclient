import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import type {
  SavedRequest,
  ScriptRequestContext,
  ScriptRunResult,
  ScriptTestResult,
  SendResult
} from '#/shared/types';
import {
  applyScriptRequestMutations,
  buildRuntimeVars,
  buildScriptSlots,
  mergeVariableSets,
  substituteWithMap
} from '#/renderer/src/store/scriptOrchestration';
import { cloneDraft, draftFromSaved } from '#/renderer/src/store/drafts';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { addConsoleEntry } from '#/renderer/src/store/slices/consoleSlice';
import {
  closeOverlay,
  selectCollectionSettingsDirty,
  selectEnvironmentSettingsDirty
} from '#/renderer/src/store/slices/navigationSlice';
import {
  openCollectionModal,
  setPendingLoadRequest
} from '#/renderer/src/store/slices/modalsSlice';
import {
  closeTabsForRequest,
  loadRequest,
  newTab,
  openTabWithDraft,
  updateActiveTabDraftAfterSave,
  updateTab
} from '#/renderer/src/store/slices/tabsSlice';
import type { AppDispatch, ThunkApiConfig } from '#/renderer/src/store/redux';
import { selectActiveTab } from '#/renderer/src/store/selectors';
import {
  refreshCollectionContents,
  refreshRequests
} from '#/renderer/src/store/thunks/collections';

/** Persists the active tab draft to the selected or specified collection. */
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
      folder_id: currentDraft.folder_id ?? null,
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

/** Deletes a saved request and closes any editor tabs showing it. */
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

/** Creates a new saved request inside a folder and opens it in a tab. */
export const newRequestInFolder = createAsyncThunk<
  SavedRequest,
  { collectionId: number; folderId: number },
  ThunkApiConfig
>('tabs/newRequestInFolder', async ({ collectionId, folderId }, { dispatch }) => {
  dispatch(setSelectedCollectionId(collectionId));

  const saved = await window.api.saveRequest({
    collection_id: collectionId,
    folder_id: folderId,
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
  await dispatch(refreshCollectionContents(collectionId));
  return saved;
});

/** Creates a new saved request at the collection root and opens it in a tab. */
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
    await dispatch(refreshCollectionContents(collectionId));
    return saved;
  }
);

/** Sends the active tab request, running pre/post scripts and recording console output. */
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

/** Cancels the in-flight HTTP request for the active tab. */
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

/** Opens a saved request in a tab (sync action wrapper). */
export function dispatchLoadRequest(dispatch: AppDispatch, req: SavedRequest): void {
  dispatch(loadRequest(req));
}

/** Opens a new blank request tab (sync action wrapper). */
export function dispatchNewRequest(dispatch: AppDispatch): void {
  dispatch(newTab());
}

/** Loads a saved request, prompting when settings overlays have unsaved edits. */
export const requestLoadRequest = createAsyncThunk<void, SavedRequest, ThunkApiConfig>(
  'modals/requestLoadRequest',
  async (req, { dispatch, getState }) => {
    const state = getState();
    const mainView = state.navigation.mainView;
    const collectionDirty = mainView.type === 'collection' && selectCollectionSettingsDirty(state);
    const environmentDirty =
      mainView.type === 'environment' && selectEnvironmentSettingsDirty(state);

    if (collectionDirty || environmentDirty) {
      dispatch(setPendingLoadRequest(req));
      return;
    }

    dispatch(closeOverlay());
    dispatch(loadRequest(req));
  }
);

/** Saves the current draft from the menu, prompting for a collection when none is selected. */
export const saveFromMenu = createAsyncThunk<void, void, ThunkApiConfig>(
  'requests/saveFromMenu',
  async (_, { dispatch, getState }) => {
    const selectedCollectionId = getState().collections.selectedCollectionId;
    if (selectedCollectionId == null) {
      dispatch(openCollectionModal({ mode: 'create-and-save' }));
      return;
    }
    await dispatch(saveRequest()).unwrap();
    toast.success('Request saved');
  }
);
