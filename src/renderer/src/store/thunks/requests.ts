import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import type {
  CollectionExportResult,
  KeyValue,
  RequestExport,
  SavedRequest,
  ScriptRequestContext,
  ScriptRunResult,
  ScriptTestResult,
  SendResult
} from '#/shared/types';
import {
  buildAuthHeaderValue,
  buildOAuthAuthHeaderValue,
  buildOAuthCacheKey,
  defaultAuth,
  resolveAuthVariables
} from '#/shared/auth';
import { toPluginHttpRequest, toPluginHttpResponse } from '#/shared/plugin/httpRequest';
import { emitPluginAfterSend } from '#/renderer/src/plugins/pluginAfterSendBus';
import {
  applyScriptRequestMutations,
  applyCollectionVariableSets,
  buildRuntimeVars,
  buildScriptSlots,
  mergeVariableSets,
  substituteWithMap
} from '#/renderer/src/scripting/scriptOrchestration';
import { saveGlobalVariables } from '#/renderer/src/store/thunks/settings';
import {
  cloneDraft,
  draftFromSaved,
  isPageTab,
  isRequestTab,
  isTabDirty
} from '#/renderer/src/store/drafts';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { addConsoleEntry } from '#/renderer/src/store/slices/consoleSlice';
import {
  selectCollectionSettingsDirty,
  selectEnvironmentSettingsDirty
} from '#/renderer/src/store/slices/navigationSlice';
import {
  openCollectionModal,
  setPendingLoadRequest
} from '#/renderer/src/store/slices/modalsSlice';
import {
  closeTab,
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
  moveRequestToFolder,
  refreshCollectionContents,
  refreshRequests,
  updateCollection
} from '#/renderer/src/store/thunks/collections';
import { updateEnvironment } from '#/renderer/src/store/thunks/environments';

/**
 * Builds a portable request export payload from a saved request.
 *
 * @param req - Saved request to export.
 * @returns Export file data without folder or database identifiers.
 */
export function buildRequestExport(req: SavedRequest): RequestExport {
  return {
    harborclientVersion: 1,
    harborclientExport: 'request',
    uuid: req.uuid,
    name: req.name,
    method: req.method,
    url: req.url,
    headers: req.headers,
    params: req.params,
    auth: req.auth,
    body: req.body,
    body_type: req.body_type,
    pre_request_script: req.pre_request_script ?? '',
    post_request_script: req.post_request_script ?? '',
    comment: req.comment ?? ''
  };
}

/**
 * Exports a saved request to a user-chosen file path.
 */
export const exportRequest = createAsyncThunk<CollectionExportResult, SavedRequest, ThunkApiConfig>(
  'requests/export',
  async (req) => {
    return window.api.exportRequest(buildRequestExport(req));
  }
);

/**
 * Payload for {@link importRequest}.
 */
export interface ImportRequestArgs {
  /**
   * Collection to add the imported request to.
   */
  collectionId: number;

  /**
   * Target folder id, or omitted/null for collection root.
   */
  folderId?: number | null;
}

/**
 * Imports a request from disk into a collection or folder and opens it in a tab.
 */
export const importRequest = createAsyncThunk<
  SavedRequest | null,
  ImportRequestArgs,
  ThunkApiConfig
>('requests/import', async ({ collectionId, folderId }, { dispatch }) => {
  const saved = await window.api.importRequest(collectionId, folderId);
  if (!saved) return null;

  dispatch(setSelectedCollectionId(collectionId));
  dispatch(openTabWithDraft(draftFromSaved(saved)));
  await dispatch(refreshCollectionContents(collectionId));
  return saved;
});

/**
 * Persists the active tab draft to the selected or specified collection.
 */
export const saveRequest = createAsyncThunk<SavedRequest, number | undefined, ThunkApiConfig>(
  'tabs/saveRequest',
  async (collectionId, { dispatch, getState }) => {
    const state = getState();
    const activeTab = selectActiveTab(state);
    if (!activeTab || !isRequestTab(activeTab)) throw new Error('No active tab');

    const currentDraft = activeTab.draft;
    // An already-saved request must persist back to its own collection. Falling
    // back to the currently-selected collection would create a copy there and
    // leave the original (e.g. a git-backed request) stale, so the draft's own
    // collection takes precedence unless an explicit target was passed in.
    const targetId =
      collectionId ??
      (currentDraft.id != null ? currentDraft.collection_id : undefined) ??
      state.collections.selectedCollectionId;
    if (targetId == null) {
      throw new Error('Select a collection first');
    }

    const sameCollection = currentDraft.collection_id === targetId;
    const shouldUpdate = currentDraft.id != null && sameCollection;
    // Folders are scoped to a single collection, so a folder_id is only valid when
    // saving back into the draft's own collection. Saving into a different collection
    // creates a copy at the root; carrying the source folder_id would reference a
    // folder that does not exist in the target and fail with "Folder not found".
    const saved = await window.api.saveRequest({
      id: shouldUpdate ? currentDraft.id : undefined,
      collection_id: targetId,
      folder_id: sameCollection ? (currentDraft.folder_id ?? null) : null,
      name: currentDraft.name,
      method: currentDraft.method,
      url: currentDraft.url,
      headers: currentDraft.headers.filter((h) => h.key.trim() || h.value.trim()),
      params: currentDraft.params.filter((p) => p.key.trim() || p.value.trim()),
      body: currentDraft.body,
      body_type: currentDraft.body_type,
      pre_request_script: currentDraft.pre_request_script ?? '',
      post_request_script: currentDraft.post_request_script ?? '',
      comment: currentDraft.comment ?? '',
      auth: currentDraft.auth
    });

    const savedDraft = cloneDraft(draftFromSaved(saved));
    dispatch(updateActiveTabDraftAfterSave({ tabId: activeTab.tabId, savedDraft }));
    await dispatch(refreshRequests(targetId));
    return saved;
  }
);

/**
 * Deletes a saved request and closes any editor tabs showing it.
 */
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

/**
 * Creates a new saved request inside a folder and opens it in a tab.
 */
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
    comment: '',
    auth: defaultAuth()
  });

  dispatch(openTabWithDraft(draftFromSaved(saved)));
  await dispatch(refreshCollectionContents(collectionId));
  return saved;
});

/**
 * Duplicates a saved request in the same collection/folder and opens it in a tab.
 */
export const duplicateRequest = createAsyncThunk<SavedRequest, SavedRequest, ThunkApiConfig>(
  'tabs/duplicateRequest',
  async (req, { dispatch, getState }) => {
    dispatch(setSelectedCollectionId(req.collection_id));

    const requests = getState().collections.requestsByCollection[req.collection_id] ?? [];
    const folderId = req.folder_id ?? null;
    const siblings = requests.filter((r) => (r.folder_id ?? null) === folderId);
    const sourceIndex = siblings.findIndex((r) => r.id === req.id);

    const saved = await window.api.saveRequest({
      collection_id: req.collection_id,
      folder_id: folderId,
      name: `${req.name} (copy)`,
      method: req.method,
      url: req.url,
      headers: req.headers,
      params: req.params,
      body: req.body,
      body_type: req.body_type,
      pre_request_script: req.pre_request_script ?? '',
      post_request_script: req.post_request_script ?? '',
      comment: req.comment ?? '',
      auth: req.auth
    });

    if (sourceIndex >= 0) {
      await dispatch(
        moveRequestToFolder({
          collectionId: req.collection_id,
          requestId: saved.id,
          folderId,
          index: sourceIndex + 1
        })
      ).unwrap();
    }

    dispatch(openTabWithDraft(draftFromSaved(saved)));
    await dispatch(refreshCollectionContents(req.collection_id));
    return saved;
  }
);

/**
 * Creates a new saved request at the collection root and opens it in a tab.
 */
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
      comment: '',
      auth: defaultAuth()
    });

    dispatch(openTabWithDraft(draftFromSaved(saved)));
    await dispatch(refreshCollectionContents(collectionId));
    return saved;
  }
);

/**
 * Sends the active tab request, running pre/post scripts and recording console output.
 */
export const sendRequest = createAsyncThunk<void, void, ThunkApiConfig>(
  'tabs/sendRequest',
  async (_, { dispatch, getState }) => {
    const state = getState();
    const activeTab = selectActiveTab(state);
    if (!activeTab || !isRequestTab(activeTab) || activeTab.sending) return;

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
    const globalVariables = state.settings.general.globalVariables;

    let runtimeVars = {
      ...buildRuntimeVars(globalVariables),
      ...buildRuntimeVars(collection?.variables ?? []),
      ...buildRuntimeVars(environment?.variables ?? [])
    };
    let globalVarSets: Record<string, string> = {};
    let collectionVarSets: Record<string, string> = {};
    let envVarSets: Record<string, string> = {};
    let collectionHeaderRows: KeyValue[] = collection
      ? (collection.headers ?? []).map((header) => ({ ...header }))
      : [];
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

    /**
     * Runs pre- or post-request scripts for one phase slot.
     */
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
          variables: runtimeVars,
          collection: {
            id: collection?.id ?? null,
            name: collection?.name ?? '',
            headers: collectionHeaderRows
          },
          environment: {
            name: environment?.name ?? ''
          }
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
        runtimeVars = mergeVariableSets(runtimeVars, result.globalVariableSets);
        runtimeVars = mergeVariableSets(runtimeVars, result.collectionVariableSets);
        runtimeVars = mergeVariableSets(runtimeVars, result.environmentVariableSets);
        globalVarSets = { ...globalVarSets, ...result.globalVariableSets };
        collectionVarSets = { ...collectionVarSets, ...result.collectionVariableSets };
        envVarSets = { ...envVarSets, ...result.environmentVariableSets };
        collectionHeaderRows = result.collectionHeaders;
      }
    };

    /**
     * Returns whether the tab still owns the in-flight send.
     */
    const isRequestStillActive = (): boolean => {
      const tab = getState().tabs.tabs.find((t) => t.tabId === tabId);
      return tab != null && isRequestTab(tab) && tab.sendingRequestId === requestId;
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
      const collectionHeaders = collectionHeaderRows.map((header) => ({
        ...header,
        value: substituteWithMap(header.value, runtimeVars)
      }));
      const draftHeaders = scriptRequest.headers.map((header) => ({
        ...header,
        value: substituteWithMap(header.value, runtimeVars)
      }));
      const effectiveAuth =
        currentDraft.auth.type !== 'none' ? currentDraft.auth : (collection?.auth ?? defaultAuth());
      const resolvedAuth = resolveAuthVariables(effectiveAuth, (text) =>
        substituteWithMap(text, runtimeVars)
      );
      let authValue = buildAuthHeaderValue(resolvedAuth);
      const manualHasAuth = [...collectionHeaders, ...draftHeaders].some(
        (header) =>
          header.enabled &&
          header.key.trim().toLowerCase() === 'authorization' &&
          header.value.trim() !== ''
      );
      if (!authValue && resolvedAuth.type === 'oauth2' && !manualHasAuth) {
        const usesRequestAuth = currentDraft.auth.type === 'oauth2';
        const cacheKey =
          usesRequestAuth && currentDraft.id != null
            ? buildOAuthCacheKey('request', currentDraft.id)
            : !usesRequestAuth && collection?.id != null
              ? buildOAuthCacheKey('collection', collection.id)
              : '';
        const tokenResult = await window.api.oauthFetchToken(cacheKey, resolvedAuth.oauth2, false);
        authValue = buildOAuthAuthHeaderValue(tokenResult);
        if (!authValue) {
          throw new Error('OAuth token response contained an invalid access token.');
        }
      }
      const headers =
        authValue && !manualHasAuth
          ? [
              { key: 'Authorization', value: authValue, enabled: true },
              ...collectionHeaders,
              ...draftHeaders
            ]
          : [...collectionHeaders, ...draftHeaders];
      const params = scriptRequest.params.map((param) => ({
        ...param,
        value: substituteWithMap(param.value, runtimeVars)
      }));
      const body = substituteWithMap(scriptRequest.body, runtimeVars);

      const sendInput = {
        method: scriptRequest.method,
        url: resolvedUrl,
        headers,
        params,
        body,
        bodyType: scriptRequest.bodyType,
        ...(currentDraft.id != null ? { sourceRequestId: currentDraft.id } : {}),
        ...(currentDraft.name.trim() ? { sourceRequestName: currentDraft.name } : {})
      };

      const result = await window.api.sendRequest(sendInput, requestId);

      if (!result.error) {
        emitPluginAfterSend(toPluginHttpRequest(sendInput), toPluginHttpResponse(result));
      }

      await runScriptPhase('post', result);

      const persistErrors: string[] = [];

      if (collection) {
        const headersChanged =
          JSON.stringify(collectionHeaderRows) !== JSON.stringify(collection.headers ?? []);
        const hasCollectionChanges = Object.keys(collectionVarSets).length > 0 || headersChanged;

        if (hasCollectionChanges) {
          try {
            await dispatch(
              updateCollection({
                id: collection.id,
                name: collection.name,
                variables: applyCollectionVariableSets(collection.variables, collectionVarSets),
                headers: collectionHeaderRows,
                preRequestScript: collection.pre_request_script,
                postRequestScript: collection.post_request_script,
                auth: collection.auth,
                connectionId: collection.connectionId
              })
            ).unwrap();
          } catch (err) {
            persistErrors.push(
              err instanceof Error ? err.message : 'Failed to save collection changes from script'
            );
          }
        }
      }

      if (environment && Object.keys(envVarSets).length > 0) {
        try {
          await dispatch(
            updateEnvironment({
              id: environment.id,
              name: environment.name,
              variables: applyCollectionVariableSets(environment.variables, envVarSets)
            })
          ).unwrap();
        } catch (err) {
          persistErrors.push(
            err instanceof Error ? err.message : 'Failed to save environment changes from script'
          );
        }
      }

      if (Object.keys(globalVarSets).length > 0) {
        try {
          await dispatch(
            saveGlobalVariables(applyCollectionVariableSets(globalVariables, globalVarSets))
          ).unwrap();
        } catch (err) {
          persistErrors.push(
            err instanceof Error
              ? err.message
              : 'Failed to save global variable changes from script'
          );
        }
      }

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

        if (persistErrors.length) {
          toast.error(`Failed to persist script changes: ${persistErrors[0]}`);
        }
      }
    } catch (err) {
      if (isRequestStillActive()) {
        const message = err instanceof Error ? err.message : String(err);
        const errorResult: SendResult = {
          status: 0,
          statusText: 'Error',
          headers: {},
          body: '',
          timeMs: 0,
          sizeBytes: 0,
          error: message
        };

        dispatch(
          updateTab({
            tabId,
            updates: { response: errorResult, testResults: allTests }
          })
        );
        dispatch(
          addConsoleEntry({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            requestName: currentDraft.name,
            collectionName: collection?.name,
            result: errorResult,
            logs: allLogs.length ? allLogs : undefined,
            tests: allTests.length ? allTests : undefined,
            scriptError: scriptErrors.length ? scriptErrors.join('\n') : undefined
          })
        );
        toast.error(message);
      }
    } finally {
      if (isRequestStillActive()) {
        dispatch(updateTab({ tabId, updates: { sending: false, sendingRequestId: null } }));
      }
    }
  }
);

/**
 * Cancels the in-flight HTTP request owned by a specific tab.
 */
export const cancelRequest = createAsyncThunk<void, string, ThunkApiConfig>(
  'tabs/cancelRequest',
  async (tabId, { dispatch, getState }) => {
    const tab = getState().tabs.tabs.find((t) => t.tabId === tabId);
    if (!tab || !isRequestTab(tab) || !tab.sendingRequestId) return;

    await window.api.cancelRequest(tab.sendingRequestId);
    dispatch(
      updateTab({
        tabId,
        updates: { sending: false, sendingRequestId: null }
      })
    );
  }
);

/**
 * Cancels any in-flight send for a tab, then removes it from the tab bar.
 */
export const closeRequestTab = createAsyncThunk<void, string, ThunkApiConfig>(
  'tabs/closeRequestTab',
  async (tabId, { dispatch, getState }) => {
    const tab = getState().tabs.tabs.find((t) => t.tabId === tabId);
    if (tab && isRequestTab(tab) && tab.sendingRequestId) {
      await dispatch(cancelRequest(tabId));
    }
    dispatch(closeTab(tabId));
  }
);

/**
 * Opens a saved request in a tab (sync action wrapper).
 */
export function dispatchLoadRequest(dispatch: AppDispatch, req: SavedRequest): void {
  dispatch(loadRequest(req));
}

/**
 * Opens a new blank request tab (sync action wrapper).
 */
export function dispatchNewRequest(dispatch: AppDispatch): void {
  dispatch(newTab());
}

/**
 * Payload for {@link requestLoadRequest}.
 */
export interface RequestLoadRequestArgs {
  req: SavedRequest;
  skipSettingsCheck?: boolean;
  forceReload?: boolean;
}

/**
 * Loads a saved request, prompting when settings or tab drafts have unsaved edits.
 */
export const requestLoadRequest = createAsyncThunk<void, RequestLoadRequestArgs, ThunkApiConfig>(
  'modals/requestLoadRequest',
  async ({ req, skipSettingsCheck = false, forceReload = false }, { dispatch, getState }) => {
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

    if (!skipSettingsCheck && (collectionDirty || environmentDirty)) {
      dispatch(setPendingLoadRequest({ req, reason: 'settings' }));
      return;
    }

    const existing = state.tabs.tabs.find((t) => isRequestTab(t) && t.draft.id === req.id);
    if (!forceReload && existing && isTabDirty(existing)) {
      dispatch(setPendingLoadRequest({ req, reason: 'dirty-tab' }));
      return;
    }

    dispatch(loadRequest(req));
  }
);

/**
 * Saves the current draft from the menu, prompting for a collection when none is selected.
 */
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
