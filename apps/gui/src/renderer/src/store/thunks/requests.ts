import { createAsyncThunk, type ThunkDispatch, type UnknownAction } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import type {
  CollectionExportResult,
  KeyValue,
  RequestExport,
  SavedRequest,
  ScriptRequestContext,
  ScriptResponseOverride,
  ScriptRunResult,
  ScriptTestResult,
  ScriptExecutionEvent,
  ScriptLogEntry,
  ScriptRunError,
  SendResult,
  Variable
} from '@harborclient/core/types';
import { defaultAuth } from '@harborclient/core/auth';
import { resolveInheritedEnvironmentVariables } from '@harborclient/core/environmentTree';
import { buildSendInput } from '@harborclient/core/requestRunner';
import { enrichScriptLogLines } from '@harborclient/core/scripting/scriptLogs';
import { applyScriptResponseOverride } from '@harborclient/core/scripting/scriptResponseOverride';
import { normalizeRequestTags } from '@harborclient/core/requestTags';
import { toPluginHttpRequest, toPluginHttpResponse } from '@harborclient/core/plugin/httpRequest';
import { emitPluginAfterSend } from '#/renderer/src/plugins/pluginAfterSendBus';
import { recordRequestHistoryFromSend } from './requestHistory';
import { SEND_REQUEST_TYPE } from './sendRequestType';
import { syncTrash } from './trash';
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
  normalizeScriptRefs,
  remintScriptRefIds
} from '@harborclient/core/scriptRefs';
import { migrateScriptEditorUiState } from '#/renderer/src/hooks/usePersistedScriptEditorUiState';
import { buildScriptRunInfo } from '@harborclient/core/types/script';
import {
  getActiveWorkflowScriptContext,
  noteWorkflowScriptDirectives
} from '#/renderer/src/workflows/workflowScriptContext';
import { saveGlobalVariables } from './settings';
import {
  cloneDraft,
  draftFromSaved,
  getDirtyTabsInCollection,
  getDirtyTabsInFolder,
  isBrowserTab,
  isMarkdownTab,
  isPageTab,
  isRequestTab,
  isTabDirty,
  resolvePersistFolderId,
  type RequestDraft,
  type RequestTab
} from '#/renderer/src/store/tabs';
import {
  setSelectedCollectionId,
  upsertRequestInCollection
} from '#/renderer/src/store/slices/collectionsSlice';
import { addConsoleEntry } from '#/renderer/src/store/slices/consoleSlice';
import {
  selectCollectionSettingsDirty,
  selectEnvironmentSettingsDirty,
  selectFolderSettingsDirty,
  selectWorkspaceSettingsDirty
} from '#/renderer/src/store/slices/navigationSlice';
import {
  openSaveRequestModal,
  setPendingLoadRequest
} from '#/renderer/src/store/slices/modalsSlice';
import {
  closeTab,
  closeTabsForRequest,
  loadRequest,
  newTab,
  openTabWithDraft,
  setSseSessionState,
  updateActiveTabDraftAfterSave,
  updateTab
} from '#/renderer/src/store/slices/tabsSlice';
import type { AppDispatch, RootState, ThunkApiConfig } from '#/renderer/src/store/redux';
import { resolveActiveCollectionTargetId } from '#/renderer/src/store/resolveActiveCollectionTargetId';
import { selectActiveTab } from '#/renderer/src/store/selectors';
import {
  moveRequestToFolder,
  refreshCollectionContents,
  refreshRequests,
  updateCollection,
  updateFolder
} from './collections';
import { openAddLivePageModalWithPrefill, updateWebsiteFromTab } from './websites';
import { updateEnvironment } from './environments';
import { tryInvokeTabSave } from '#/renderer/src/hooks/tabSaveRegistry';
import { saveMarkdownTab } from './documents';

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
    ...(req.protocol === 'sse' ? { protocol: 'sse' as const } : {}),
    method: req.method,
    url: req.url,
    headers: req.headers,
    params: req.params,
    auth: req.auth,
    userAgent: req.userAgent,
    body: req.body,
    body_type: req.body_type,
    body_raw: req.body_raw ?? null,
    body_raw_open: req.body_raw_open === true,
    pre_request_script: req.pre_request_script ?? '',
    post_request_script: req.post_request_script ?? '',
    pre_request_scripts: req.pre_request_scripts,
    post_request_scripts: req.post_request_scripts,
    comment: req.comment ?? '',
    tags: req.tags ?? '',
    marker: req.marker ?? null
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
 * Persists a request sidebar marker and updates the cached collection requests.
 */
export const setRequestSidebarMarker = createAsyncThunk<
  SavedRequest,
  { collectionId: number; id: number; marker: string | null },
  ThunkApiConfig
>('requests/setSidebarMarker', async ({ collectionId, id, marker }, { dispatch }) => {
  const request = await window.api.setRequestMarker(id, marker);
  dispatch(upsertRequestInCollection({ collectionId, request }));
  return request;
});

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
 * Optional overrides for {@link persistRequestTab} when the caller picks a
 * collection and/or folder explicitly (save-location modal).
 */
interface PersistRequestTabOptions {
  /**
   * Explicit target collection id; overrides draft and selection when provided.
   */
  collectionId?: number;

  /**
   * Explicit folder id for first-time saves into a collection.
   * `null` means collection root; `undefined` means derive from draft/selection rules.
   */
  folderId?: number | null;
}

/**
 * Persists a single request tab draft to storage and syncs tab saved state.
 *
 * @param tab - Open request tab to save.
 * @param getState - Reads current Redux state for collection selection and snippets.
 * @param dispatch - Dispatches tab updates after persistence.
 * @param options - Explicit collection and/or folder overrides from the save picker.
 * @returns The saved request from storage.
 */
async function persistRequestTab(
  tab: RequestTab,
  getState: () => RootState,
  dispatch: (action: ReturnType<typeof updateActiveTabDraftAfterSave>) => void,
  options?: PersistRequestTabOptions
): Promise<SavedRequest> {
  const state = getState();
  const currentDraft = tab.draft;
  const collectionId = options?.collectionId;
  const targetId =
    collectionId ??
    (currentDraft.id != null ? currentDraft.collection_id : undefined) ??
    resolveActiveCollectionTargetId(
      state.collections.collections,
      state.collections.selectedCollectionId
    );
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
  const persistFolderId =
    options?.folderId !== undefined
      ? options.folderId
      : sameCollection
        ? shouldUpdate
          ? resolvePersistFolderId(currentDraft, targetId, state.collections.requestsByCollection)
          : (currentDraft.folder_id ?? null)
        : null;

  const saved = await window.api.saveRequest({
    id: shouldUpdate ? currentDraft.id : undefined,
    collection_id: targetId,
    folder_id: persistFolderId,
    name: currentDraft.name,
    protocol: currentDraft.protocol === 'sse' ? 'sse' : 'http',
    method: currentDraft.method,
    url: currentDraft.url,
    headers: currentDraft.headers.filter((h) => h.key.trim() || h.value.trim()),
    params: currentDraft.params.filter((p) => p.key.trim() || p.value.trim()),
    body: currentDraft.body,
    body_type: currentDraft.body_type,
    body_raw: currentDraft.body_raw ?? null,
    body_raw_open: currentDraft.body_raw_open === true,
    pre_request_script: mirrorLegacyScriptString(preRequestScripts),
    post_request_script: mirrorLegacyScriptString(postRequestScripts),
    pre_request_scripts: preRequestScripts,
    post_request_scripts: postRequestScripts,
    comment: currentDraft.comment ?? '',
    tags: normalizeRequestTags(currentDraft.tags ?? ''),
    auth: currentDraft.auth,
    userAgent: currentDraft.userAgent ?? ''
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

    const saved = await persistRequestTab(
      activeTab,
      getState,
      dispatch,
      collectionId != null ? { collectionId } : undefined
    );
    await dispatch(refreshRequests(saved.collection_id));
    return saved;
  }
);

/**
 * Arguments for {@link saveRequestToLocation}.
 */
export interface SaveRequestLocationArgs {
  /**
   * Tab to save; defaults to the active request tab when omitted.
   */
  tabId?: string;

  /**
   * Target collection id chosen in the save-location picker.
   */
  collectionId: number;

  /**
   * Target folder id, or null for the collection root.
   */
  folderId?: number | null;
}

/**
 * Persists a request tab into an explicitly chosen collection and optional folder.
 */
export const saveRequestToLocation = createAsyncThunk<
  SavedRequest,
  SaveRequestLocationArgs,
  ThunkApiConfig
>(
  'tabs/saveRequestToLocation',
  async ({ tabId, collectionId, folderId }, { dispatch, getState }) => {
    const state = getState();
    const tab =
      tabId != null
        ? state.tabs.tabs.find((entry) => entry.tabId === tabId)
        : selectActiveTab(state);
    if (tab == null || !isRequestTab(tab)) {
      throw new Error('No active tab');
    }

    const saved = await persistRequestTab(tab, getState, dispatch, {
      collectionId,
      folderId: folderId ?? null
    });
    dispatch(setSelectedCollectionId(collectionId));
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
    await persistRequestTab(tab, getState, dispatch, { collectionId });
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
    await syncTrash(dispatch);
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
    protocol: 'http' as const,
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    body: '',
    body_type: 'none',
    body_raw: null,
    body_raw_open: false,
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    comment: '',
    tags: '',
    auth: defaultAuth(),
    userAgent: ''
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

    const preRequestScripts = remintScriptRefIds(req.pre_request_scripts ?? []);
    const postRequestScripts = remintScriptRefIds(req.post_request_scripts ?? []);

    const saved = await window.api.saveRequest({
      collection_id: req.collection_id,
      folder_id: folderId,
      name: `${req.name} (copy)`,
      protocol: req.protocol === 'sse' ? 'sse' : 'http',
      method: req.method,
      url: req.url,
      headers: req.headers,
      params: req.params,
      body: req.body,
      body_type: req.body_type,
      body_raw: req.body_raw ?? null,
      body_raw_open: req.body_raw_open === true,
      pre_request_script: mirrorLegacyScriptString(preRequestScripts),
      post_request_script: mirrorLegacyScriptString(postRequestScripts),
      pre_request_scripts: preRequestScripts,
      post_request_scripts: postRequestScripts,
      comment: req.comment ?? '',
      tags: req.tags ?? '',
      auth: req.auth,
      userAgent: req.userAgent ?? ''
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
      protocol: 'http' as const,
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      body: '',
      body_type: 'none',
      body_raw: null,
      body_raw_open: false,
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: '',
      auth: defaultAuth(),
      userAgent: ''
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
  scriptLogs: ScriptLogEntry[];
  /**
   * Ordered variable and flow-control activity from pre/post scripts.
   */
  executionEvents: ScriptExecutionEvent[];
  /**
   * Final `hc.data` bag after pre/post scripts for this send.
   */
  data: Record<string, unknown>;
  /**
   * Cookie jar rows for the request host at send time.
   */
  cookies: KeyValue[];
  /**
   * Aggregated script runtime errors, when any script failed.
   */
  scriptError?: string;
  /**
   * Structured script failures with slot metadata and mapped locations,
   * used for in-editor error reveal.
   */
  scriptErrors?: ScriptRunError[];
  /**
   * Next request name from hc.execution.setNextRequest for collection runner flow control.
   */
  scriptNextRequest?: string | null;
  /**
   * When true, hc.execution.skipRequest() skipped the HTTP send.
   */
  scriptSkipRequest: boolean;
  /**
   * Target workflow action UUID from hc.execution.workflowNextAction, if any.
   */
  scriptWorkflowNextAction?: string;
  /**
   * When true, hc.execution.workflowSkipAction() skipped the current workflow action.
   */
  scriptWorkflowSkipAction?: boolean;
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
  /**
   * When false, suppresses recording a history entry for this send. Defaults to true.
   */
  recordHistory?: boolean;
  /**
   * Open request tab that owns this send; recorded on console entries for jump-to-editor.
   */
  requestTabId?: string;
  /**
   * Execution mode. `http` (default) runs the buffered send path. `sse-open` runs
   * pre-scripts, opens an SSE session, and returns without waiting for events or
   * running post-scripts.
   */
  mode?: 'http' | 'sse-open';
}

/**
 * Maximum concatenated SSE raw bytes included in a synthetic close summary.
 */
const SSE_CLOSE_BODY_MAX_CHARS = 512_000;

/**
 * Builds an empty {@link RequestRunOutcome} used when SSE requests are skipped.
 *
 * @param error - User-facing skip reason stored on the synthetic response.
 * @returns Outcome marked as script-skipped with a zeroed response.
 */
function skippedSseOutcome(error: string): RequestRunOutcome {
  return {
    response: {
      status: 0,
      statusText: 'Skipped',
      headers: {},
      body: '',
      timeMs: 0,
      sizeBytes: 0,
      error
    },
    testResults: [],
    scriptLogs: [],
    executionEvents: [],
    data: {},
    cookies: [],
    scriptSkipRequest: true
  };
}

/**
 * Builds a synthetic {@link SendResult} summarizing a closed SSE session for the
 * response pane and optional post-script hooks.
 *
 * @param tab - Request tab that owned the session.
 * @returns Send result derived from handshake metadata and retained events.
 */
function syntheticSseCloseResult(tab: RequestTab): SendResult {
  const session = tab.sseSession;
  const openInfo = session?.openInfo;
  const raw = (session?.events ?? []).map((event) => event.raw).join('\n\n');
  const body =
    raw.length > SSE_CLOSE_BODY_MAX_CHARS
      ? `${raw.slice(0, SSE_CLOSE_BODY_MAX_CHARS)}\n\n… [truncated]`
      : raw;
  const timeMs =
    session?.openedAt != null
      ? Math.max(0, (session.closedAt ?? Date.now()) - session.openedAt)
      : 0;
  return {
    status: openInfo?.status ?? 0,
    statusText: openInfo?.statusText ?? (session?.status === 'error' ? 'Error' : 'Closed'),
    headers: openInfo?.headers ?? {},
    body,
    timeMs,
    sizeBytes: new TextEncoder().encode(body).byteLength,
    ...(session?.error ? { error: session.error } : {}),
    ...(openInfo?.timing ? { timing: openInfo.timing } : {})
  };
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
  const {
    draft: currentDraft,
    requestId,
    recordHistory = true,
    requestTabId,
    mode = 'http'
  } = args;
  const { dispatch, getState } = deps;

  if (currentDraft.protocol === 'sse' && mode === 'http') {
    return skippedSseOutcome(
      'SSE requests cannot run in the collection runner. Open the request and use Connect.'
    );
  }

  const state = getState();
  const collectionId =
    currentDraft.collection_id ??
    (currentDraft.id == null
      ? null
      : resolveActiveCollectionTargetId(
          state.collections.collections,
          state.collections.selectedCollectionId
        ));
  const collection = collectionId
    ? state.collections.collections.find((c) => c.id === collectionId)
    : undefined;
  const folderId = currentDraft.folder_id ?? null;
  const folder =
    collectionId != null && folderId != null
      ? (state.collections.foldersByCollection[collectionId] ?? []).find(
          (item) => item.id === folderId
        )
      : undefined;
  const activeEnvironmentId = state.environments.activeEnvironmentId;
  const environment = activeEnvironmentId
    ? state.environments.environments.find((env) => env.id === activeEnvironmentId)
    : undefined;
  const globalVariables = state.settings.general.globalVariables;
  let inheritedEnvironmentVariables: Variable[] = [];
  if (environment) {
    try {
      inheritedEnvironmentVariables = resolveInheritedEnvironmentVariables(
        environment,
        state.environments.environments
      );
    } catch {
      inheritedEnvironmentVariables = environment.variables.filter(
        (variable) => variable.enabled !== false
      );
    }
  }

  let runtimeVars = {
    ...buildRuntimeVars(globalVariables),
    ...buildRuntimeVars(collection?.variables ?? []),
    ...buildRuntimeVars(folder?.variables ?? []),
    ...buildRuntimeVars(inheritedEnvironmentVariables)
  };
  let globalVarSets: Record<string, string> = {};
  let collectionVarSets: Record<string, string> = {};
  let folderVarSets: Record<string, string> = {};
  let envVarSets: Record<string, string> = {};
  let runtimeVarClears: string[] = [];
  let collectionVarClears: string[] = [];
  let folderVarClears: string[] = [];
  let envVarClears: string[] = [];
  let globalVarClears: string[] = [];
  let cookieVarSets: Record<string, string> = {};
  let cookieVarClears: string[] = [];
  let scriptNextRequest: string | null | undefined;
  let scriptSkipRequest = false;
  let scriptResponseOverride: ScriptResponseOverride | undefined;
  let scriptWorkflowNextAction: string | undefined;
  let scriptWorkflowSkipAction = false;
  let collectionHeaderRows: KeyValue[] = collection
    ? (collection.headers ?? []).map((header) => ({ ...header }))
    : [];
  let folderHeaderRows: KeyValue[] = folder
    ? (folder.headers ?? []).map((header) => ({ ...header }))
    : [];
  let collectionAuthConfig = collection?.auth ? structuredClone(collection.auth) : defaultAuth();
  let folderAuthConfig = folder?.auth ? structuredClone(folder.auth) : defaultAuth();
  const allLogs: ScriptLogEntry[] = [];
  const allTests: ScriptTestResult[] = [];
  const allExecutionEvents: ScriptExecutionEvent[] = [];
  const scriptErrors: string[] = [];
  const scriptErrorDetails: ScriptRunError[] = [];
  let scriptData: Record<string, unknown> = {};

  let scriptRequest: ScriptRequestContext = {
    method: currentDraft.method,
    url: currentDraft.url,
    headers: currentDraft.headers.map((header) => ({ ...header })),
    userAgent: currentDraft.userAgent ?? '',
    params: currentDraft.params.map((param) => ({ ...param })),
    body: currentDraft.body,
    bodyType: currentDraft.body_type,
    auth: structuredClone(currentDraft.auth),
    tags: currentDraft.tags ?? '',
    comment: currentDraft.comment ?? ''
  };

  const cookieHost = hostFromUrl(substituteWithMap(currentDraft.url, runtimeVars));
  let cookieRows: KeyValue[] = cookieHost != null ? await window.api.getCookies(cookieHost) : [];
  const workflowScriptContext = getActiveWorkflowScriptContext();

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
        folder?.pre_request_scripts,
        folder?.post_request_scripts,
        currentDraft.pre_request_scripts,
        currentDraft.post_request_scripts
      ]
    );

    const phaseLogStart = allLogs.length;
    const phaseTestStart = allTests.length;
    const phaseErrorStart = scriptErrors.length;

    const injection = await window.api.runPluginBeforeScripts({
      phase,
      request: toPluginHttpRequest({
        method: scriptRequest.method,
        url: scriptRequest.url,
        headers: scriptRequest.headers,
        body: scriptRequest.body,
        bodyType: scriptRequest.bodyType,
        params: scriptRequest.params,
        sourceRequestId: currentDraft.id ?? undefined,
        sourceRequestName: currentDraft.name
      }),
      data: scriptData
    });
    scriptData = injection.data;

    const slots = buildScriptSlots(
      collection?.pre_request_scripts,
      collection?.post_request_scripts,
      folder?.pre_request_scripts,
      folder?.post_request_scripts,
      currentDraft.pre_request_scripts,
      currentDraft.post_request_scripts,
      collection?.pre_request_script ?? '',
      collection?.post_request_script ?? '',
      folder?.pre_request_script ?? '',
      folder?.post_request_script ?? '',
      currentDraft.pre_request_script,
      currentDraft.post_request_script,
      phase,
      snippetLookup,
      injection.scripts
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
          requestId: currentDraft.id ?? null,
          workflowId: workflowScriptContext?.workflowId,
          workflowActionId: workflowScriptContext?.workflowActionId,
          workflowActionIteration: workflowScriptContext?.workflowActionIteration
        }),
        collection: {
          id: collection?.id ?? null,
          name: collection?.name ?? '',
          connectionId: collection?.connectionId ?? null,
          headers: collectionHeaderRows,
          auth: collectionAuthConfig
        },
        folder: folder
          ? {
              id: folder.id,
              name: folder.name,
              headers: folderHeaderRows,
              auth: folderAuthConfig
            }
          : undefined,
        environment: {
          name: environment?.name ?? ''
        },
        data: scriptData
      });

      if (result.logs.length) {
        allLogs.push(
          ...enrichScriptLogLines(result.logs, {
            label: slot.label,
            scriptId: slot.scriptId,
            phase: slot.phase,
            scope: slot.scope
          })
        );
      }
      if (result.executionEvents.length) {
        allExecutionEvents.push(
          ...result.executionEvents.map((event) => ({ ...event, scriptName: slot.label }))
        );
      }
      if (result.tests.length) {
        allTests.push(
          ...result.tests.map((test) => ({
            ...test,
            scriptName: slot.label,
            scriptId: slot.scriptId,
            phase: slot.phase,
            scope: slot.scope
          }))
        );
      }
      if (result.error) {
        scriptErrors.push(`${slot.label}: ${result.error}`);
        scriptErrorDetails.push({
          message: result.error,
          scriptName: slot.label,
          scriptId: slot.scriptId,
          phase: slot.phase,
          scope: slot.scope,
          ...result.errorLocation
        });
      }

      scriptRequest = applyScriptRequestMutations(scriptRequest, result);
      runtimeVars = applyRuntimeVariableClears(runtimeVars, result.variableClears);
      runtimeVars = applyRuntimeVariableClears(runtimeVars, result.globalVariableClears);
      runtimeVars = applyRuntimeVariableClears(runtimeVars, result.collectionVariableClears);
      runtimeVars = applyRuntimeVariableClears(runtimeVars, result.folderVariableClears);
      runtimeVars = applyRuntimeVariableClears(runtimeVars, result.environmentVariableClears);
      runtimeVars = mergeVariableSets(runtimeVars, result.variableSets);
      runtimeVars = mergeVariableSets(runtimeVars, result.globalVariableSets);
      runtimeVars = mergeVariableSets(runtimeVars, result.collectionVariableSets);
      runtimeVars = mergeVariableSets(runtimeVars, result.folderVariableSets);
      runtimeVars = mergeVariableSets(runtimeVars, result.environmentVariableSets);
      globalVarSets = { ...globalVarSets, ...result.globalVariableSets };
      collectionVarSets = { ...collectionVarSets, ...result.collectionVariableSets };
      folderVarSets = { ...folderVarSets, ...result.folderVariableSets };
      envVarSets = { ...envVarSets, ...result.environmentVariableSets };
      runtimeVarClears = [...runtimeVarClears, ...result.variableClears];
      collectionVarClears = [...collectionVarClears, ...result.collectionVariableClears];
      folderVarClears = [...folderVarClears, ...result.folderVariableClears];
      envVarClears = [...envVarClears, ...result.environmentVariableClears];
      globalVarClears = [...globalVarClears, ...result.globalVariableClears];
      cookieVarSets = { ...cookieVarSets, ...result.cookieSets };
      cookieVarClears = [...cookieVarClears, ...result.cookieClears];
      cookieRows = applyCookieChanges(cookieRows, result.cookieSets, result.cookieClears);
      collectionHeaderRows = result.collectionHeaders;
      folderHeaderRows = result.folderHeaders;
      if (result.collectionAuth) {
        collectionAuthConfig = result.collectionAuth;
      }
      if (result.folderAuth) {
        folderAuthConfig = result.folderAuth;
      }
      if (result.nextRequest !== undefined) {
        scriptNextRequest = result.nextRequest;
      }
      if (result.skipRequest) {
        scriptSkipRequest = true;
      }
      if (result.responseOverride) {
        scriptResponseOverride = result.responseOverride;
      }
      if (result.workflowNextAction !== undefined) {
        scriptWorkflowNextAction = result.workflowNextAction;
      }
      if (result.workflowSkipAction) {
        scriptWorkflowSkipAction = true;
        scriptSkipRequest = true;
      }
      scriptData = result.data;
    }

    await window.api.runPluginAfterScripts({
      phase,
      data: scriptData,
      tests: allTests.slice(phaseTestStart).map((test) => ({
        name: test.name,
        passed: test.passed,
        ...(test.error ? { error: test.error } : {})
      })),
      logs: allLogs.slice(phaseLogStart).map((entry) => ({
        level: entry.level,
        message: entry.message,
        ...(entry.scriptName ? { scriptName: entry.scriptName } : {}),
        ...(entry.scriptId ? { scriptId: entry.scriptId } : {})
      })),
      errors: scriptErrors.slice(phaseErrorStart)
    });
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
    } else if (mode === 'sse-open') {
      const sendInput = await buildSendInput(
        {
          request: scriptRequest,
          requestIdentity: {
            id: currentDraft.id,
            name: currentDraft.name,
            bodyRaw: currentDraft.body_raw
          },
          collection: collection
            ? { ...collection, headers: collectionHeaderRows, auth: collectionAuthConfig }
            : undefined,
          folder: folder
            ? { ...folder, headers: folderHeaderRows, auth: folderAuthConfig }
            : undefined
        },
        scriptRequest,
        runtimeVars,
        {
          settings: state.settings.general,
          fetchOAuthToken: (cacheKey, config) => window.api.oauthFetchToken(cacheKey, config, false)
        }
      );

      await window.api.openSseSession(
        {
          protocol: 'sse',
          url: sendInput.url,
          headers: sendInput.headers,
          params: sendInput.params
        },
        requestId
      );

      result = {
        status: 0,
        statusText: 'Connecting',
        headers: {},
        body: '',
        timeMs: 0,
        sizeBytes: 0
      };
    } else {
      const sendInput = await buildSendInput(
        {
          request: scriptRequest,
          requestIdentity: {
            id: currentDraft.id,
            name: currentDraft.name,
            bodyRaw: currentDraft.body_raw
          },
          collection: collection
            ? { ...collection, headers: collectionHeaderRows, auth: collectionAuthConfig }
            : undefined,
          folder: folder
            ? { ...folder, headers: folderHeaderRows, auth: folderAuthConfig }
            : undefined
        },
        scriptRequest,
        runtimeVars,
        {
          settings: state.settings.general,
          fetchOAuthToken: (cacheKey, config) => window.api.oauthFetchToken(cacheKey, config, false)
        }
      );

      result = await window.api.sendRequest(sendInput, requestId);

      if (!result.error) {
        emitPluginAfterSend(toPluginHttpRequest(sendInput), toPluginHttpResponse(result));
        if (recordHistory !== false) {
          void dispatch(recordRequestHistoryFromSend({ sendInput, result }));
        }
      }
    }

    if (scriptResponseOverride) {
      result = applyScriptResponseOverride(result, scriptResponseOverride);
    }

    if (!scriptSkipRequest && mode !== 'sse-open') {
      scriptResponseOverride = undefined;
      await runScriptPhase('post', result);
      if (scriptResponseOverride) {
        result = applyScriptResponseOverride(result, scriptResponseOverride);
      }
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
              variables: applyCollectionVariableSets(
                applyVariableClears(collection.variables, collectionVarClears),
                collectionVarSets
              ),
              headers: collectionHeaderRows,
              preRequestScript: collection.pre_request_script,
              postRequestScript: collection.post_request_script,
              preRequestScripts: collection.pre_request_scripts,
              postRequestScripts: collection.post_request_scripts,
              auth: collectionAuthConfig,
              userAgent: collection.userAgent,
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

    if (folder && collectionId != null) {
      const headersChanged =
        JSON.stringify(folderHeaderRows) !== JSON.stringify(folder.headers ?? []);
      const authChanged =
        JSON.stringify(folderAuthConfig) !== JSON.stringify(folder.auth ?? defaultAuth());
      const hasFolderChanges =
        Object.keys(folderVarSets).length > 0 ||
        folderVarClears.length > 0 ||
        headersChanged ||
        authChanged;

      if (hasFolderChanges) {
        try {
          await dispatch(
            updateFolder({
              id: folder.id,
              collectionId,
              name: folder.name,
              variables: applyCollectionVariableSets(
                applyVariableClears(folder.variables, folderVarClears),
                folderVarSets
              ),
              headers: folderHeaderRows,
              preRequestScript: folder.pre_request_script,
              postRequestScript: folder.post_request_script,
              preRequestScripts: folder.pre_request_scripts,
              postRequestScripts: folder.post_request_scripts,
              auth: folderAuthConfig,
              userAgent: folder.userAgent
            })
          ).unwrap();
        } catch (err) {
          persistErrors.push(
            err instanceof Error ? err.message : 'Failed to save folder changes from script'
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
            variables: applyCollectionVariableSets(
              applyVariableClears(environment.variables, envVarClears),
              envVarSets
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
            applyCollectionVariableSets(
              applyVariableClears(globalVariables, globalVarClears),
              globalVarSets
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
            protocol: savedRequest.protocol === 'sse' ? 'sse' : 'http',
            method: savedRequest.method,
            url: savedRequest.url,
            headers: savedRequest.headers,
            params: savedRequest.params,
            body: savedRequest.body,
            body_type: savedRequest.body_type,
            body_raw: savedRequest.body_raw ?? null,
            body_raw_open: savedRequest.body_raw_open === true,
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
        requestTabId,
        result,
        logs: allLogs.length ? allLogs : undefined,
        tests: allTests.length ? allTests : undefined,
        executionEvents: allExecutionEvents.length ? allExecutionEvents : undefined,
        scriptError: scriptErrors.length ? scriptErrors.join('\n') : undefined,
        scriptErrors: scriptErrorDetails.length ? scriptErrorDetails : undefined
      })
    );

    if (persistErrors.length) {
      toast.error(`Failed to persist script changes: ${persistErrors[0]}`);
    }

    noteWorkflowScriptDirectives({
      workflowNextAction: scriptWorkflowNextAction,
      workflowSkipAction: scriptWorkflowSkipAction
    });

    return {
      response: result,
      testResults: allTests,
      scriptLogs: allLogs,
      executionEvents: allExecutionEvents,
      data: scriptData,
      cookies: cookieRows.map((row) => ({ ...row })),
      scriptError: scriptErrors.length ? scriptErrors.join('\n') : undefined,
      scriptErrors: scriptErrorDetails.length ? scriptErrorDetails : undefined,
      scriptNextRequest,
      scriptSkipRequest,
      scriptWorkflowNextAction,
      scriptWorkflowSkipAction
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
        requestTabId,
        result: errorResult,
        logs: allLogs.length ? allLogs : undefined,
        tests: allTests.length ? allTests : undefined,
        executionEvents: allExecutionEvents.length ? allExecutionEvents : undefined,
        scriptError: scriptErrors.length ? scriptErrors.join('\n') : undefined,
        scriptErrors: scriptErrorDetails.length ? scriptErrorDetails : undefined
      })
    );
    toast.error(message);

    return {
      response: errorResult,
      testResults: allTests,
      scriptLogs: allLogs,
      executionEvents: allExecutionEvents,
      data: scriptData,
      cookies: cookieRows.map((row) => ({ ...row })),
      scriptError: scriptErrors.length ? scriptErrors.join('\n') : undefined,
      scriptErrors: scriptErrorDetails.length ? scriptErrorDetails : undefined,
      scriptSkipRequest: false,
      scriptWorkflowNextAction,
      scriptWorkflowSkipAction
    };
  }
}

/**
 * Opens an SSE session for the active (or specified) request tab without waiting
 * for a buffered response. Events arrive via {@link window.api.onSseEvent}.
 *
 * @returns Pre-script outcome, or null when the tab was missing / already sending.
 */
export const openSseStream = createAsyncThunk<
  RequestRunOutcome | null,
  string | undefined,
  ThunkApiConfig
>('tabs/openSseStream', async (tabIdArg, { dispatch, getState }) => {
  const state = getState();
  const activeTab = tabIdArg
    ? state.tabs.tabs.find((tab) => tab.tabId === tabIdArg)
    : selectActiveTab(state);
  if (!activeTab || !isRequestTab(activeTab) || activeTab.sending) {
    return null;
  }
  if (activeTab.draft.protocol !== 'sse') {
    return null;
  }

  const tabId = activeTab.tabId;
  const requestId = crypto.randomUUID();

  /**
   * Returns whether the tab still owns this SSE open attempt.
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
        scriptErrors: undefined,
        scriptNextRequest: undefined,
        scriptSkipRequest: false,
        scriptWorkflowNextAction: undefined,
        scriptWorkflowSkipAction: false,
        sendingRequestId: requestId,
        sseSession: {
          status: 'connecting',
          events: [],
          droppedCount: 0,
          openedAt: Date.now()
        }
      }
    })
  );

  try {
    const outcome = await executeRequestDraft(
      {
        draft: activeTab.draft,
        requestId,
        requestTabId: tabId,
        mode: 'sse-open',
        recordHistory: false
      },
      { dispatch, getState }
    );

    if (isRequestStillActive()) {
      dispatch(
        updateTab({
          tabId,
          updates: {
            testResults: outcome.testResults,
            scriptLogs: outcome.scriptLogs,
            executionEvents: outcome.executionEvents,
            scriptError: outcome.scriptError,
            scriptErrors: outcome.scriptErrors,
            scriptNextRequest: outcome.scriptNextRequest,
            scriptSkipRequest: outcome.scriptSkipRequest,
            scriptWorkflowNextAction: outcome.scriptWorkflowNextAction,
            scriptWorkflowSkipAction: outcome.scriptWorkflowSkipAction
          }
        })
      );
    }

    if (outcome.scriptSkipRequest && isRequestStillActive()) {
      dispatch(
        updateTab({
          tabId,
          updates: {
            sending: false,
            sendingRequestId: null,
            response: outcome.response,
            sseSession: null
          }
        })
      );
    }

    return outcome;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isRequestStillActive()) {
      dispatch(
        setSseSessionState({
          tabId,
          sseSession: {
            status: 'error',
            events: [],
            droppedCount: 0,
            openedAt: Date.now(),
            closedAt: Date.now(),
            error: message
          }
        })
      );
      dispatch(updateTab({ tabId, updates: { sending: false, sendingRequestId: null } }));
    }
    toast.error(message);
    return null;
  }
});

/**
 * Closes the SSE session owned by a request tab and stores a synthetic summary.
 *
 * @param tabId - Request tab whose session should be closed.
 */
export const closeSseStream = createAsyncThunk<void, string, ThunkApiConfig>(
  'tabs/closeSseStream',
  async (tabId, { dispatch, getState }) => {
    const tab = getState().tabs.tabs.find((t) => t.tabId === tabId);
    if (!tab || !isRequestTab(tab) || !tab.sendingRequestId) {
      return;
    }

    const requestId = tab.sendingRequestId;
    try {
      await window.api.closeSseSession(requestId);
    } catch {
      // Session may already be closed by the server or a prior cancel.
    }

    const latest = getState().tabs.tabs.find((t) => t.tabId === tabId);
    if (!latest || !isRequestTab(latest) || latest.sendingRequestId !== requestId) {
      return;
    }

    const closedSession = latest.sseSession
      ? {
          ...latest.sseSession,
          status: 'closed' as const,
          closedAt: Date.now()
        }
      : null;
    const summary = syntheticSseCloseResult({
      ...latest,
      sseSession: closedSession
    });

    dispatch(
      updateTab({
        tabId,
        updates: {
          sending: false,
          sendingRequestId: null,
          response: summary,
          sseSession: closedSession
        }
      })
    );
  }
);

/**
 * Sends the active tab request, running pre/post scripts and recording console output.
 *
 * @returns Completed send outcome, or null when the tab was missing / already sending.
 */
export const sendRequest = createAsyncThunk<
  RequestRunOutcome | null,
  string | undefined,
  ThunkApiConfig
>(SEND_REQUEST_TYPE, async (tabIdArg, { dispatch, getState }) => {
  const state = getState();
  const activeTab = tabIdArg
    ? state.tabs.tabs.find((tab) => tab.tabId === tabIdArg)
    : selectActiveTab(state);
  if (!activeTab || !isRequestTab(activeTab) || activeTab.sending) {
    return null;
  }

  if (activeTab.draft.protocol === 'sse') {
    return dispatch(openSseStream(tabIdArg ?? activeTab.tabId)).then((action) =>
      openSseStream.fulfilled.match(action) ? action.payload : null
    );
  }

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
        scriptErrors: undefined,
        scriptNextRequest: undefined,
        scriptSkipRequest: false,
        scriptWorkflowNextAction: undefined,
        scriptWorkflowSkipAction: false,
        sendingRequestId: requestId,
        sseSession: null
      }
    })
  );

  try {
    const outcome = await executeRequestDraft(
      { draft: activeTab.draft, requestId, requestTabId: tabId },
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
            scriptErrors: outcome.scriptErrors,
            scriptNextRequest: outcome.scriptNextRequest,
            scriptSkipRequest: outcome.scriptSkipRequest,
            scriptWorkflowNextAction: outcome.scriptWorkflowNextAction,
            scriptWorkflowSkipAction: outcome.scriptWorkflowSkipAction
          }
        })
      );
    }

    return outcome;
  } finally {
    if (isRequestStillActive()) {
      dispatch(updateTab({ tabId, updates: { sending: false, sendingRequestId: null } }));
    }
  }
});

/**
 * Cancels the in-flight HTTP request or SSE session owned by a specific tab.
 */
export const cancelRequest = createAsyncThunk<void, string, ThunkApiConfig>(
  'tabs/cancelRequest',
  async (tabId, { dispatch, getState }) => {
    const tab = getState().tabs.tabs.find((t) => t.tabId === tabId);
    if (!tab || !isRequestTab(tab) || !tab.sendingRequestId) return;

    if (tab.draft.protocol === 'sse' || tab.sseSession != null) {
      await dispatch(closeSseStream(tabId));
      return;
    }

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
  activate?: boolean;
}

/**
 * Loads a saved request, prompting when collection, folder, or environment settings have unsaved edits.
 */
export const requestLoadRequest = createAsyncThunk<void, RequestLoadRequestArgs, ThunkApiConfig>(
  'modals/requestLoadRequest',
  async ({ req, skipSettingsCheck = false, activate = true }, { dispatch, getState }) => {
    const state = getState();
    const activeTab = state.tabs.tabs.find((tab) => tab.tabId === state.tabs.activeTabId);
    const collectionDirty =
      activeTab != null &&
      isPageTab(activeTab) &&
      activeTab.page.type === 'collection' &&
      (isTabDirty(activeTab) || selectCollectionSettingsDirty(state));
    const environmentDirty =
      activeTab != null &&
      isPageTab(activeTab) &&
      activeTab.page.type === 'environment' &&
      selectEnvironmentSettingsDirty(state);
    const folderDirty =
      activeTab != null &&
      isPageTab(activeTab) &&
      activeTab.page.type === 'folder' &&
      (isTabDirty(activeTab) || selectFolderSettingsDirty(state));
    const workspaceDirty =
      activeTab != null &&
      isPageTab(activeTab) &&
      activeTab.page.type === 'workspace' &&
      selectWorkspaceSettingsDirty(state);

    if (
      !skipSettingsCheck &&
      (collectionDirty || environmentDirty || folderDirty || workspaceDirty)
    ) {
      dispatch(setPendingLoadRequest({ req, reason: 'settings' }));
      return;
    }

    dispatch(loadRequest({ req, activate }));
  }
);

/**
 * Saves the active tab from the menu: registered form handlers first, then
 * markdown, browser website, or request persistence. No-ops when the active
 * tab has nothing to save.
 */
export const saveFromMenu = createAsyncThunk<void, void, ThunkApiConfig>(
  'requests/saveFromMenu',
  async (_, { dispatch, getState }) => {
    const state = getState();
    const activeTab = selectActiveTab(state);
    const activeTabId = state.tabs.activeTabId;

    if (activeTabId != null && tryInvokeTabSave(activeTabId)) {
      return;
    }

    if (activeTab && isMarkdownTab(activeTab)) {
      if (!isTabDirty(activeTab)) {
        return;
      }

      await dispatch(saveMarkdownTab(activeTab.tabId)).unwrap();
      toast.success('Document saved');
      return;
    }

    if (activeTab && isBrowserTab(activeTab)) {
      if (activeTab.websiteId != null) {
        await dispatch(updateWebsiteFromTab(activeTab.tabId));
        return;
      }
      dispatch(openAddLivePageModalWithPrefill());
      return;
    }

    if (!activeTab || !isRequestTab(activeTab)) {
      return;
    }

    if (activeTab.draft.id == null || activeTab.draft.collection_id == null) {
      dispatch(openSaveRequestModal({ tabId: activeTab.tabId }));
      return;
    }
    await dispatch(saveRequest()).unwrap();
    toast.success('Request saved');
  }
);
