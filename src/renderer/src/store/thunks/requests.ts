import { createAsyncThunk, type ThunkDispatch, type UnknownAction } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import type {
  CollectionExportResult,
  KeyValue,
  RequestExport,
  SavedRequest,
  ScriptRequestContext,
  ScriptRunResult,
  ScriptTestResult,
  ScriptExecutionEvent,
  SendResult
} from '#/shared/types';
import {
  buildAuthHeaderValue,
  buildOAuthAuthHeaderValue,
  buildOAuthCacheKey,
  defaultAuth,
  resolveAuthVariables
} from '#/shared/auth';
import { normalizeRequestTags } from '#/shared/requestTags';
import { toPluginHttpRequest, toPluginHttpResponse } from '#/shared/plugin/httpRequest';
import { emitPluginAfterSend } from '#/renderer/src/plugins/pluginAfterSendBus';
import {
  applyScriptRequestMutations,
  applyCollectionVariableSets,
  applyRuntimeVariableClears,
  applyVariableClears,
  applyCookieChanges,
  buildRuntimeVars,
  buildScriptSlots,
  mergeVariableSets,
  substituteWithMap
} from '#/renderer/src/scripting/scriptOrchestration';
import { hostFromUrl } from '#/renderer/src/ui/Main/RequestEditor/Editor/cookieHost';
import {
  buildSnippetLookup,
  buildScriptModuleMap
} from '#/renderer/src/scripting/scriptResolution';
import {
  autoNameUnnamedScripts,
  mergeScriptRefsUiState,
  mirrorLegacyScriptString,
  normalizeScriptRefs
} from '#/shared/scriptRefs';
import { migrateScriptEditorUiState } from '#/renderer/src/hooks/usePersistedScriptEditorUiState';
import { buildScriptRunInfo } from '#/shared/types/script';
import { saveGlobalVariables } from '#/renderer/src/store/thunks/settings';
import {
  cloneDraft,
  draftFromSaved,
  getDirtyTabsInCollection,
  getDirtyTabsInFolder,
  isPageTab,
  isRequestTab,
  isTabDirty,
  type RequestDraft,
  type RequestTab
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
import type { AppDispatch, RootState, ThunkApiConfig } from '#/renderer/src/store/redux';
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
    pre_request_scripts: req.pre_request_scripts,
    post_request_scripts: req.post_request_scripts,
    comment: req.comment ?? '',
    tags: req.tags ?? ''
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
 * Persists a single request tab draft to storage and syncs tab saved state.
 *
 * @param tab - Open request tab to save.
 * @param getState - Reads current Redux state for collection selection and snippets.
 * @param dispatch - Dispatches tab updates after persistence.
 * @param collectionId - Explicit target collection id; overrides draft and selection when provided.
 * @returns The saved request from storage.
 */
async function persistRequestTab(
  tab: RequestTab,
  getState: () => RootState,
  dispatch: (action: ReturnType<typeof updateActiveTabDraftAfterSave>) => void,
  collectionId?: number
): Promise<SavedRequest> {
  const state = getState();
  const currentDraft = tab.draft;
  const targetId =
    collectionId ??
    (currentDraft.id != null ? currentDraft.collection_id : undefined) ??
    state.collections.selectedCollectionId;
  if (targetId == null) {
    throw new Error('Select a collection first');
  }

  const sameCollection = currentDraft.collection_id === targetId;
  const shouldUpdate = currentDraft.id != null && sameCollection;
  const preRequestScripts = autoNameUnnamedScripts(
    normalizeScriptRefs(currentDraft.pre_request_scripts),
    getState().snippets.snippets
  );
  const postRequestScripts = autoNameUnnamedScripts(
    normalizeScriptRefs(currentDraft.post_request_scripts),
    getState().snippets.snippets
  );

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
    pre_request_script: mirrorLegacyScriptString(preRequestScripts),
    post_request_script: mirrorLegacyScriptString(postRequestScripts),
    pre_request_scripts: preRequestScripts,
    post_request_scripts: postRequestScripts,
    comment: currentDraft.comment ?? '',
    tags: normalizeRequestTags(currentDraft.tags ?? ''),
    auth: currentDraft.auth
  });

  const savedDraft = cloneDraft(draftFromSaved(saved));

  const preMerge = mergeScriptRefsUiState(
    currentDraft.pre_request_scripts,
    savedDraft.pre_request_scripts
  );
  savedDraft.pre_request_scripts = preMerge.merged;

  const postMerge = mergeScriptRefsUiState(
    currentDraft.post_request_scripts,
    savedDraft.post_request_scripts
  );
  savedDraft.post_request_scripts = postMerge.merged;

  for (const migration of [...preMerge.idMigrations, ...postMerge.idMigrations]) {
    migrateScriptEditorUiState(migration.from, migration.to);
  }

  dispatch(updateActiveTabDraftAfterSave({ tabId: tab.tabId, savedDraft }));
  return saved;
}

/**
 * Persists the active tab draft to the selected or specified collection.
 */
export const saveRequest = createAsyncThunk<SavedRequest, number | undefined, ThunkApiConfig>(
  'tabs/saveRequest',
  async (collectionId, { dispatch, getState }) => {
    const activeTab = selectActiveTab(getState());
    if (!activeTab || !isRequestTab(activeTab)) throw new Error('No active tab');

    const saved = await persistRequestTab(activeTab, getState, dispatch, collectionId);
    await dispatch(refreshRequests(saved.collection_id));
    return saved;
  }
);

/**
 * Payload for {@link saveAllDirtyRequests}.
 */
export interface SaveAllDirtyRequestsArgs {
  /**
   * Collection whose unsaved open tabs should be saved.
   */
  collectionId: number;

  /**
   * When set, only tabs in this folder are saved; omit for the whole collection.
   */
  folderId?: number;
}

/**
 * Result of {@link saveAllDirtyRequests}.
 */
export interface SaveAllDirtyRequestsResult {
  /**
   * Number of tabs successfully persisted.
   */
  savedCount: number;
}

/**
 * Saves every dirty open request tab in a collection or folder scope.
 */
export const saveAllDirtyRequests = createAsyncThunk<
  SaveAllDirtyRequestsResult,
  SaveAllDirtyRequestsArgs,
  ThunkApiConfig
>('tabs/saveAllDirtyRequests', async ({ collectionId, folderId }, { dispatch, getState }) => {
  const tabs =
    folderId != null
      ? getDirtyTabsInFolder(getState().tabs.tabs, collectionId, folderId)
      : getDirtyTabsInCollection(getState().tabs.tabs, collectionId);

  if (tabs.length === 0) {
    return { savedCount: 0 };
  }

  for (const tab of tabs) {
    await persistRequestTab(tab, getState, dispatch, collectionId);
  }

  await dispatch(refreshCollectionContents(collectionId));
  return { savedCount: tabs.length };
});

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
    pre_request_scripts: [],
    post_request_scripts: [],
    comment: '',
    tags: '',
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
      pre_request_scripts: req.pre_request_scripts ?? [],
      post_request_scripts: req.post_request_scripts ?? [],
      comment: req.comment ?? '',
      tags: req.tags ?? '',
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
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: '',
      auth: defaultAuth()
    });

    dispatch(openTabWithDraft(draftFromSaved(saved)));
    await dispatch(refreshCollectionContents(collectionId));
    return saved;
  }
);

/**
 * Outcome of executing a request draft without touching editor tabs.
 */
export interface RequestRunOutcome {
  /**
   * HTTP response or synthetic skipped/error result from the send pipeline.
   */
  response: SendResult;
  /**
   * Post-request script test assertions collected during the run.
   */
  testResults: ScriptTestResult[];
  /**
   * Console output captured from pre/post scripts.
   */
  scriptLogs: string[];
  /**
   * Ordered variable and flow-control activity from pre/post scripts.
   */
  executionEvents: ScriptExecutionEvent[];
  /**
   * Aggregated script runtime errors, when any script failed.
   */
  scriptError?: string;
  /**
   * Next request name from hc.execution.setNextRequest for collection runner flow control.
   */
  scriptNextRequest?: string | null;
  /**
   * When true, hc.execution.skipRequest() skipped the HTTP send.
   */
  scriptSkipRequest: boolean;
}

/**
 * Arguments for {@link executeRequestDraft}.
 */
export interface ExecuteRequestDraftArgs {
  /**
   * Request draft to send, including saved id and collection metadata when available.
   */
  draft: RequestDraft;
  /**
   * Correlation id passed to the main-process HTTP layer for cancellation.
   */
  requestId: string;
}

/**
 * Runs pre/post scripts, sends HTTP, persists script side effects, and records console output
 * for a request draft without creating or mutating editor tabs.
 *
 * @param args - Draft and in-flight request id for the send pipeline.
 * @param deps - Redux dispatch and state accessors.
 * @returns Response, script output, and runner flow-control fields from the completed run.
 */
export async function executeRequestDraft(
  args: ExecuteRequestDraftArgs,
  deps: { dispatch: ThunkDispatch<RootState, unknown, UnknownAction>; getState: () => RootState }
): Promise<RequestRunOutcome> {
  const { draft: currentDraft, requestId } = args;
  const { dispatch, getState } = deps;
  const state = getState();
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
  let runtimeVarClears: string[] = [];
  let collectionVarClears: string[] = [];
  let envVarClears: string[] = [];
  let globalVarClears: string[] = [];
  let cookieVarSets: Record<string, string> = {};
  let cookieVarClears: string[] = [];
  let scriptNextRequest: string | null | undefined;
  let scriptSkipRequest = false;
  let collectionHeaderRows: KeyValue[] = collection
    ? (collection.headers ?? []).map((header) => ({ ...header }))
    : [];
  let collectionAuthConfig = collection?.auth ? structuredClone(collection.auth) : defaultAuth();
  const allLogs: string[] = [];
  const allTests: ScriptTestResult[] = [];
  const allExecutionEvents: ScriptExecutionEvent[] = [];
  const scriptErrors: string[] = [];
  let scriptData: Record<string, unknown> = {};

  let scriptRequest: ScriptRequestContext = {
    method: currentDraft.method,
    url: currentDraft.url,
    headers: currentDraft.headers.map((header) => ({ ...header })),
    params: currentDraft.params.map((param) => ({ ...param })),
    body: currentDraft.body,
    bodyType: currentDraft.body_type,
    auth: structuredClone(currentDraft.auth),
    tags: currentDraft.tags ?? '',
    comment: currentDraft.comment ?? ''
  };

  const cookieHost = hostFromUrl(substituteWithMap(currentDraft.url, runtimeVars));
  let cookieRows: KeyValue[] = cookieHost != null ? await window.api.getCookies(cookieHost) : [];

  /**
   * Runs pre- or post-request scripts for one phase slot.
   */
  const runScriptPhase = async (phase: 'pre' | 'post', response?: SendResult): Promise<void> => {
    const snippetLookup = buildSnippetLookup(state.snippets.snippets);
    const { modules: snippetModules, conflicts: snippetModuleConflicts } = buildScriptModuleMap(
      state.snippets.snippets,
      [
        collection?.pre_request_scripts,
        collection?.post_request_scripts,
        currentDraft.pre_request_scripts,
        currentDraft.post_request_scripts
      ]
    );
    const slots = buildScriptSlots(
      collection?.pre_request_scripts,
      collection?.post_request_scripts,
      currentDraft.pre_request_scripts,
      currentDraft.post_request_scripts,
      collection?.pre_request_script ?? '',
      collection?.post_request_script ?? '',
      currentDraft.pre_request_script,
      currentDraft.post_request_script,
      phase,
      snippetLookup
    );

    for (const slot of slots) {
      const scriptSource = substituteWithMap(slot.source, runtimeVars);
      const substitutedSnippetModules = Object.fromEntries(
        Object.entries(snippetModules).map(([name, code]) => [
          name,
          substituteWithMap(code, runtimeVars)
        ])
      );
      const result: ScriptRunResult = await window.api.runScript({
        phase: slot.phase,
        script: scriptSource,
        snippetModules: substitutedSnippetModules,
        snippetModuleConflicts,
        request: scriptRequest,
        response,
        variables: runtimeVars,
        cookies: cookieRows,
        info: buildScriptRunInfo(slot.phase, {
          requestName: currentDraft.name,
          requestId: currentDraft.id ?? null
        }),
        collection: {
          id: collection?.id ?? null,
          name: collection?.name ?? '',
          headers: collectionHeaderRows,
          auth: collectionAuthConfig
        },
        environment: {
          name: environment?.name ?? ''
        },
        data: scriptData
      });

      if (result.logs.length) {
        allLogs.push(`[${slot.label}]`, ...result.logs);
      }
      if (result.executionEvents.length) {
        allExecutionEvents.push(
          ...result.executionEvents.map((event) => ({ ...event, scriptName: slot.label }))
        );
      }
      if (result.tests.length) {
        allTests.push(...result.tests.map((test) => ({ ...test, scriptName: slot.label })));
      }
      if (result.error) {
        scriptErrors.push(`${slot.label}: ${result.error}`);
      }

      scriptRequest = applyScriptRequestMutations(scriptRequest, result);
      runtimeVars = mergeVariableSets(runtimeVars, result.variableSets);
      runtimeVars = mergeVariableSets(runtimeVars, result.globalVariableSets);
      runtimeVars = mergeVariableSets(runtimeVars, result.collectionVariableSets);
      runtimeVars = mergeVariableSets(runtimeVars, result.environmentVariableSets);
      runtimeVars = applyRuntimeVariableClears(runtimeVars, result.variableClears);
      runtimeVars = applyRuntimeVariableClears(runtimeVars, result.globalVariableClears);
      runtimeVars = applyRuntimeVariableClears(runtimeVars, result.collectionVariableClears);
      runtimeVars = applyRuntimeVariableClears(runtimeVars, result.environmentVariableClears);
      globalVarSets = { ...globalVarSets, ...result.globalVariableSets };
      collectionVarSets = { ...collectionVarSets, ...result.collectionVariableSets };
      envVarSets = { ...envVarSets, ...result.environmentVariableSets };
      runtimeVarClears = [...runtimeVarClears, ...result.variableClears];
      collectionVarClears = [...collectionVarClears, ...result.collectionVariableClears];
      envVarClears = [...envVarClears, ...result.environmentVariableClears];
      globalVarClears = [...globalVarClears, ...result.globalVariableClears];
      cookieVarSets = { ...cookieVarSets, ...result.cookieSets };
      cookieVarClears = [...cookieVarClears, ...result.cookieClears];
      cookieRows = applyCookieChanges(cookieRows, result.cookieSets, result.cookieClears);
      collectionHeaderRows = result.collectionHeaders;
      if (result.collectionAuth) {
        collectionAuthConfig = result.collectionAuth;
      }
      if (result.nextRequest !== undefined) {
        scriptNextRequest = result.nextRequest;
      }
      if (result.skipRequest) {
        scriptSkipRequest = true;
      }
      scriptData = result.data;
    }
  };

  try {
    await runScriptPhase('pre');

    let result: SendResult;

    if (scriptSkipRequest) {
      result = {
        status: 0,
        statusText: 'Skipped',
        headers: {},
        body: '',
        timeMs: 0,
        sizeBytes: 0,
        error: 'Request skipped by script'
      };
    } else {
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
        scriptRequest.auth && scriptRequest.auth.type !== 'none'
          ? scriptRequest.auth
          : collectionAuthConfig;
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
        const usesRequestAuth = scriptRequest.auth?.type === 'oauth2';
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

      result = await window.api.sendRequest(sendInput, requestId);

      if (!result.error) {
        emitPluginAfterSend(toPluginHttpRequest(sendInput), toPluginHttpResponse(result));
      }

      await runScriptPhase('post', result);
    }

    const persistErrors: string[] = [];

    if (
      cookieHost != null &&
      (Object.keys(cookieVarSets).length > 0 || cookieVarClears.length > 0)
    ) {
      try {
        await window.api.setCookies(
          cookieHost,
          applyCookieChanges(cookieRows, cookieVarSets, cookieVarClears)
        );
      } catch (err) {
        persistErrors.push(
          err instanceof Error ? err.message : 'Failed to save cookie changes from script'
        );
      }
    }

    if (collection) {
      const headersChanged =
        JSON.stringify(collectionHeaderRows) !== JSON.stringify(collection.headers ?? []);
      const authChanged =
        JSON.stringify(collectionAuthConfig) !== JSON.stringify(collection.auth ?? defaultAuth());
      const hasCollectionChanges =
        Object.keys(collectionVarSets).length > 0 ||
        collectionVarClears.length > 0 ||
        headersChanged ||
        authChanged;

      if (hasCollectionChanges) {
        try {
          await dispatch(
            updateCollection({
              id: collection.id,
              name: collection.name,
              variables: applyVariableClears(
                applyCollectionVariableSets(collection.variables, collectionVarSets),
                collectionVarClears
              ),
              headers: collectionHeaderRows,
              preRequestScript: collection.pre_request_script,
              postRequestScript: collection.post_request_script,
              preRequestScripts: collection.pre_request_scripts,
              postRequestScripts: collection.post_request_scripts,
              auth: collectionAuthConfig,
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

    if (environment && (Object.keys(envVarSets).length > 0 || envVarClears.length > 0)) {
      try {
        await dispatch(
          updateEnvironment({
            id: environment.id,
            name: environment.name,
            variables: applyVariableClears(
              applyCollectionVariableSets(environment.variables, envVarSets),
              envVarClears
            )
          })
        ).unwrap();
      } catch (err) {
        persistErrors.push(
          err instanceof Error ? err.message : 'Failed to save environment changes from script'
        );
      }
    }

    if (Object.keys(globalVarSets).length > 0 || globalVarClears.length > 0) {
      try {
        await dispatch(
          saveGlobalVariables(
            applyVariableClears(
              applyCollectionVariableSets(globalVariables, globalVarSets),
              globalVarClears
            )
          )
        ).unwrap();
      } catch (err) {
        persistErrors.push(
          err instanceof Error ? err.message : 'Failed to save global variable changes from script'
        );
      }
    }

    if (currentDraft.id != null && collectionId != null) {
      const savedRequests = state.collections.requestsByCollection[collectionId] ?? [];
      const savedRequest = savedRequests.find((request) => request.id === currentDraft.id);
      const normalizedTags = normalizeRequestTags(scriptRequest.tags ?? '');
      const normalizedComment = scriptRequest.comment ?? '';
      const notesChanged =
        savedRequest != null &&
        (normalizeRequestTags(savedRequest.tags ?? '') !== normalizedTags ||
          (savedRequest.comment ?? '') !== normalizedComment);

      if (notesChanged) {
        try {
          await window.api.saveRequest({
            id: savedRequest.id,
            collection_id: savedRequest.collection_id,
            folder_id: savedRequest.folder_id ?? null,
            name: savedRequest.name,
            method: savedRequest.method,
            url: savedRequest.url,
            headers: savedRequest.headers,
            params: savedRequest.params,
            body: savedRequest.body,
            body_type: savedRequest.body_type,
            pre_request_script: savedRequest.pre_request_script ?? '',
            post_request_script: savedRequest.post_request_script ?? '',
            pre_request_scripts: savedRequest.pre_request_scripts ?? [],
            post_request_scripts: savedRequest.post_request_scripts ?? [],
            comment: normalizedComment,
            tags: normalizedTags,
            auth: savedRequest.auth
          });
          await dispatch(refreshRequests(collectionId)).unwrap();

          const openTab = getState().tabs.tabs.find(
            (tab) => isRequestTab(tab) && tab.draft.id === currentDraft.id
          );
          if (openTab && isRequestTab(openTab)) {
            dispatch(
              updateTab({
                tabId: openTab.tabId,
                updates: {
                  draft: {
                    ...openTab.draft,
                    tags: normalizedTags,
                    comment: normalizedComment
                  }
                }
              })
            );
          }
        } catch (err) {
          persistErrors.push(
            err instanceof Error ? err.message : 'Failed to save request notes from script'
          );
        }
      }
    }

    dispatch(
      addConsoleEntry({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        requestName: currentDraft.name,
        collectionName: collection?.name,
        result,
        logs: allLogs.length ? allLogs : undefined,
        tests: allTests.length ? allTests : undefined,
        executionEvents: allExecutionEvents.length ? allExecutionEvents : undefined,
        scriptError: scriptErrors.length ? scriptErrors.join('\n') : undefined
      })
    );

    if (scriptErrors.length) {
      toast.error(`Script error: ${scriptErrors[0]}`);
    }

    if (persistErrors.length) {
      toast.error(`Failed to persist script changes: ${persistErrors[0]}`);
    }

    return {
      response: result,
      testResults: allTests,
      scriptLogs: allLogs,
      executionEvents: allExecutionEvents,
      scriptError: scriptErrors.length ? scriptErrors.join('\n') : undefined,
      scriptNextRequest,
      scriptSkipRequest
    };
  } catch (err) {
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
      addConsoleEntry({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        requestName: currentDraft.name,
        collectionName: collection?.name,
        result: errorResult,
        logs: allLogs.length ? allLogs : undefined,
        tests: allTests.length ? allTests : undefined,
        executionEvents: allExecutionEvents.length ? allExecutionEvents : undefined,
        scriptError: scriptErrors.length ? scriptErrors.join('\n') : undefined
      })
    );
    toast.error(message);

    return {
      response: errorResult,
      testResults: allTests,
      scriptLogs: allLogs,
      executionEvents: allExecutionEvents,
      scriptError: scriptErrors.length ? scriptErrors.join('\n') : undefined,
      scriptSkipRequest: false
    };
  }
}

/**
 * Sends the active tab request, running pre/post scripts and recording console output.
 */
export const sendRequest = createAsyncThunk<void, string | undefined, ThunkApiConfig>(
  'tabs/sendRequest',
  async (tabIdArg, { dispatch, getState }) => {
    const state = getState();
    const activeTab = tabIdArg
      ? state.tabs.tabs.find((tab) => tab.tabId === tabIdArg)
      : selectActiveTab(state);
    if (!activeTab || !isRequestTab(activeTab) || activeTab.sending) return;

    const tabId = activeTab.tabId;
    const requestId = crypto.randomUUID();

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
        updates: {
          sending: true,
          response: null,
          testResults: [],
          scriptLogs: [],
          executionEvents: [],
          scriptError: undefined,
          scriptNextRequest: undefined,
          scriptSkipRequest: false,
          sendingRequestId: requestId
        }
      })
    );

    try {
      const outcome = await executeRequestDraft(
        { draft: activeTab.draft, requestId },
        { dispatch, getState }
      );

      if (isRequestStillActive()) {
        dispatch(
          updateTab({
            tabId,
            updates: {
              response: outcome.response,
              testResults: outcome.testResults,
              scriptLogs: outcome.scriptLogs,
              executionEvents: outcome.executionEvents,
              scriptError: outcome.scriptError,
              scriptNextRequest: outcome.scriptNextRequest,
              scriptSkipRequest: outcome.scriptSkipRequest
            }
          })
        );
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
  dispatch(loadRequest({ req }));
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
  activate?: boolean;
}

/**
 * Loads a saved request, prompting when settings or tab drafts have unsaved edits.
 */
export const requestLoadRequest = createAsyncThunk<void, RequestLoadRequestArgs, ThunkApiConfig>(
  'modals/requestLoadRequest',
  async (
    { req, skipSettingsCheck = false, forceReload = false, activate = true },
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

    if (!skipSettingsCheck && (collectionDirty || environmentDirty)) {
      dispatch(setPendingLoadRequest({ req, reason: 'settings' }));
      return;
    }

    const existing = state.tabs.tabs.find((t) => isRequestTab(t) && t.draft.id === req.id);
    if (!forceReload && existing && isTabDirty(existing)) {
      dispatch(setPendingLoadRequest({ req, reason: 'dirty-tab' }));
      return;
    }

    dispatch(loadRequest({ req, activate }));
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
