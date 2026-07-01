import type {
  KeyValue,
  SaveRequestInput,
  SavedRequest,
  SendRequestInput,
  SendResult
} from '#/shared/types';
import type {
  CreateCollectionPayload,
  CreateCollectionRequest,
  CreateCollectionResult,
  OpenRequestDraftParam,
  OpenRequestDraftPayload
} from '@harborclient/sdk';
export type { OpenRequestDraftPayload } from '@harborclient/sdk';
import { getRequestsInRunOrder } from '#/shared/collectionRunner';
import type { Collection } from '#/shared/types';
import { parseHttpMethod } from '#/shared/httpMethod';
import { defaultAuth } from '#/shared/auth';
import { store } from '#/renderer/src/store/redux';
import type { RootState } from '#/renderer/src/store/redux';
import {
  defaultDraft,
  emptyKeyValue,
  isRequestTab,
  normalizeDraft,
  type RequestDraft
} from '#/renderer/src/store/drafts';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { openTabWithDraft, setActiveTab, updateTab } from '#/renderer/src/store/slices/tabsSlice';
import { requestLoadRequest, sendRequest } from '#/renderer/src/store/thunks/requests';
import {
  createCollection,
  createFolder,
  refreshCollectionContents
} from '#/renderer/src/store/thunks/collections';
import { registerCommand } from '#/renderer/src/plugins/createPluginContext';
import { addConsoleEntry } from '#/renderer/src/store/slices/consoleSlice';
import { emitPluginAfterSend } from '#/renderer/src/plugins/pluginAfterSendBus';
import { toPluginHttpRequest, toPluginHttpResponse } from '#/shared/plugin/httpRequest';

const HOST_PLUGIN_ID = 'harborclient';

/**
 * Payload accepted by {@link logRequestToConsole} from renderer plugins.
 */
export interface PluginConsoleLogPayload {
  /** Display name shown in the footer console row. */
  requestName: string;
  /** Optional collection label prefixed in the console row. */
  collectionName?: string;
  /** Send result metadata matching normal request sends. */
  result: SendResult;
}

/**
 * Validates a plugin console log payload before dispatching to Redux.
 *
 * @param payload - Raw payload from a plugin host call.
 */
export function validatePluginConsoleLogPayload(payload: unknown): PluginConsoleLogPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('harborclient.logRequestToConsole requires a payload object.');
  }

  const { requestName, collectionName, result } = payload as PluginConsoleLogPayload;
  const trimmedName = typeof requestName === 'string' ? requestName.trim() : '';
  if (!trimmedName) {
    throw new Error('harborclient.logRequestToConsole requires a non-empty requestName.');
  }
  if (!result || typeof result !== 'object') {
    throw new Error('harborclient.logRequestToConsole requires a result object.');
  }
  if (typeof result.status !== 'number' || typeof result.timeMs !== 'number') {
    throw new Error(
      'harborclient.logRequestToConsole requires numeric result.status and result.timeMs.'
    );
  }

  return {
    requestName: trimmedName,
    collectionName: typeof collectionName === 'string' ? collectionName : undefined,
    result
  };
}

/**
 * Sends one HTTP request through the main-process pipeline on behalf of a plugin.
 *
 * Uses the same IPC path as the Send button, so requests are not subject to the
 * renderer's CORS restrictions. Failures are returned as an error
 * {@link SendResult} rather than thrown, so batch callers (load tests) stay
 * resilient.
 *
 * @param input - Request configuration to execute.
 * @returns Response metadata, or an error result when the send fails.
 */
export async function sendHttpRequestForPlugin(input: SendRequestInput): Promise<SendResult> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.sendHttpRequest requires a request input object.');
  }
  if (typeof input.url !== 'string' || !input.url.trim()) {
    throw new Error('harborclient.sendHttpRequest requires a non-empty url.');
  }

  try {
    const result = await window.api.sendRequest(input);
    if (!result.error) {
      emitPluginAfterSend(toPluginHttpRequest(input), toPluginHttpResponse(result));
    }
    return result;
  } catch (error) {
    return {
      status: 0,
      statusText: 'Error',
      headers: {},
      body: '',
      timeMs: 0,
      sizeBytes: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Appends one request result to the footer console log from a renderer plugin.
 *
 * @param payload - Console entry fields supplied by the plugin.
 */
export function logRequestToConsole(payload: PluginConsoleLogPayload): void {
  const validated = validatePluginConsoleLogPayload(payload);
  store.dispatch(
    addConsoleEntry({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      requestName: validated.requestName,
      collectionName: validated.collectionName,
      result: validated.result
    })
  );
}

/**
 * Clears the last HTTP response on the active request tab so plugin-only response
 * panels can replace the standard Body/Headers view.
 */
export function clearActiveResponse(): void {
  const { activeTabId } = store.getState().tabs;
  if (!activeTabId) {
    return;
  }

  store.dispatch(
    updateTab({
      tabId: activeTabId,
      updates: { response: null, testResults: [] }
    })
  );
}

/**
 * Finds a saved collection request in the Redux cache.
 *
 * @param state - Current renderer store state.
 * @param requestId - Saved request database id.
 * @returns Matching saved request, if loaded in memory.
 */
export function findSavedRequest(state: RootState, requestId: number): SavedRequest | undefined {
  for (const requests of Object.values(state.collections.requestsByCollection)) {
    const match = requests.find((request) => request.id === requestId);
    if (match) {
      return match;
    }
  }
  return undefined;
}

/**
 * Converts a flat header map into editable key-value rows.
 *
 * @param headers - Header map from plugin HTTP hooks.
 * @returns Key-value rows suitable for a request draft.
 */
function headersToKeyValues(headers: Record<string, string> | undefined): KeyValue[] {
  if (!headers) {
    return [emptyKeyValue()];
  }
  const rows = Object.entries(headers).map(([key, value]) => ({
    key,
    value,
    enabled: true
  }));
  return rows.length > 0 ? rows : [emptyKeyValue()];
}

/**
 * Converts captured query params into editable key-value rows.
 *
 * @param params - Enabled query params from a sent request.
 * @returns Key-value rows suitable for a request draft.
 */
function paramsToKeyValues(params: OpenRequestDraftParam[] | undefined): KeyValue[] {
  if (!params?.length) {
    return [emptyKeyValue()];
  }
  const rows = params.map((param) => ({
    key: param.key,
    value: param.value,
    enabled: true
  }));
  return rows.length > 0 ? rows : [emptyKeyValue()];
}

/**
 * Builds a request draft from a plugin-provided open payload.
 *
 * @param payload - Partial draft fields captured at send time.
 * @returns Normalized draft for a new editor tab.
 */
export function draftFromOpenPayload(payload: OpenRequestDraftPayload): RequestDraft {
  const parsedMethod = payload.method ? parseHttpMethod(payload.method) : null;
  const method = parsedMethod ?? defaultDraft().method;
  const bodyType = payload.bodyType ?? (payload.body?.trim() ? 'text' : 'none');

  return normalizeDraft({
    ...defaultDraft(),
    name: payload.name?.trim() || 'Recent Request',
    method,
    url: payload.url ?? '',
    headers: headersToKeyValues(payload.headers),
    params: paramsToKeyValues(payload.params),
    body: payload.body ?? '',
    body_type: bodyType,
    auth: defaultAuth()
  });
}

/**
 * Opens a saved collection request or focuses an existing tab for it.
 *
 * @param requestId - Saved request database id.
 */
export function loadSavedRequest(requestId: number): void {
  const state = store.getState();
  const openTab = state.tabs.tabs.find((tab) => isRequestTab(tab) && tab.draft.id === requestId);
  if (openTab) {
    store.dispatch(setActiveTab(openTab.tabId));
    return;
  }

  const saved = findSavedRequest(state, requestId);
  if (!saved) {
    throw new Error(`Request ${requestId} is not available. Open its collection first.`);
  }

  void store.dispatch(requestLoadRequest({ req: saved }));
}

/**
 * Opens a new request tab seeded with captured send metadata.
 *
 * @param payload - Partial draft fields from a recent request entry.
 */
export function openRequestDraft(payload: OpenRequestDraftPayload): void {
  store.dispatch(openTabWithDraft(draftFromOpenPayload(payload)));
}

/**
 * Sends the active request editor tab using the same pipeline as the Send button.
 */
export function triggerSendRequest(): void {
  void store.dispatch(sendRequest());
}

/**
 * Validates and normalizes a plugin bulk-collection payload.
 *
 * @param payload - Raw payload from a plugin host command.
 * @returns Normalized collection name and request rows.
 */
export function validateCreateCollectionPayload(payload: unknown): CreateCollectionPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('harborclient.createCollection requires a payload object.');
  }

  const { name, requests } = payload as CreateCollectionPayload;
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    throw new Error('Collection name is required.');
  }
  if (!Array.isArray(requests)) {
    throw new Error('Collection requests must be an array.');
  }

  return { name: trimmedName, requests };
}

/**
 * Returns sorted unique folder names referenced by plugin request rows.
 *
 * @param requests - Request rows that may include folder names.
 * @returns Distinct non-empty folder names in locale order.
 */
export function uniqueFolderNames(requests: CreateCollectionRequest[]): string[] {
  const folders = new Set<string>();
  for (const request of requests) {
    const folder = typeof request.folder === 'string' ? request.folder.trim() : '';
    if (folder) {
      folders.add(folder);
    }
  }
  return [...folders].sort((left, right) => left.localeCompare(right));
}

/**
 * Maps a plugin request row into a save payload for the active database.
 *
 * @param request - Request row from a plugin bulk-collection import.
 * @param collectionId - Target collection database id.
 * @param folderId - Folder id when grouped, or null for collection root.
 * @returns Input accepted by {@link window.api.saveRequest}.
 */
export function pluginRequestToSaveInput(
  request: CreateCollectionRequest,
  collectionId: number,
  folderId: number | null
): SaveRequestInput {
  const trimmedName = typeof request.name === 'string' ? request.name.trim() : '';
  if (!trimmedName) {
    throw new Error('Each request must have a non-empty name.');
  }

  const method = parseHttpMethod(request.method) ?? 'GET';
  const body = typeof request.body === 'string' ? request.body : '';
  const bodyType = request.bodyType ?? (body.trim() ? 'text' : 'none');

  return {
    collection_id: collectionId,
    folder_id: folderId,
    name: trimmedName,
    method,
    url: typeof request.url === 'string' ? request.url : '',
    headers: headersToKeyValues(request.headers),
    params: paramsToKeyValues(request.params),
    body,
    body_type: bodyType,
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    comment: typeof request.comment === 'string' ? request.comment : ''
  };
}

/**
 * Bulk-creates a collection with folders and saved requests supplied by a plugin.
 *
 * @param payload - Collection name and request rows to persist.
 * @returns Database id of the created collection.
 */
export async function createCollectionFromPlugin(
  payload: CreateCollectionPayload
): Promise<CreateCollectionResult> {
  const validated = validateCreateCollectionPayload(payload);
  const collection = await store.dispatch(createCollection({ name: validated.name })).unwrap();

  const folderIds = new Map<string, number>();
  for (const folderName of uniqueFolderNames(validated.requests)) {
    const folder = await store
      .dispatch(createFolder({ collectionId: collection.id, name: folderName }))
      .unwrap();
    folderIds.set(folderName, folder.id);
  }

  for (const request of validated.requests) {
    const folderName = typeof request.folder === 'string' ? request.folder.trim() : '';
    const folderId = folderName ? (folderIds.get(folderName) ?? null) : null;
    const saveInput = pluginRequestToSaveInput(request, collection.id, folderId);
    await window.api.saveRequest(saveInput);
  }

  store.dispatch(setSelectedCollectionId(collection.id));
  await store.dispatch(refreshCollectionContents(collection.id));

  return { collectionId: collection.id };
}

/**
 * Returns saved requests for a collection or folder in sidebar run order.
 *
 * @param collectionId - Collection database id.
 * @param folderId - Folder id for folder runs; omit for the full collection.
 */
export async function listCollectionRequestsForPlugin(
  collectionId: number,
  folderId?: number | null
): Promise<SavedRequest[]> {
  const [requests, folders] = await Promise.all([
    window.api.listRequests(collectionId),
    window.api.listFolders(collectionId)
  ]);
  return getRequestsInRunOrder(collectionId, folderId, requests, folders);
}

/**
 * Returns collection metadata needed by plugins to resolve saved requests.
 *
 * @param collectionId - Collection database id.
 */
export async function getCollectionMetadataForPlugin(collectionId: number): Promise<Collection> {
  const { collections } = await window.api.listCollections();
  const collection = collections.find((entry) => entry.id === collectionId);
  if (!collection) {
    throw new Error(`Collection ${collectionId} was not found.`);
  }
  return collection;
}

/**
 * Registers host commands that let plugins open request editor tabs.
 *
 * @returns Disposer that unregisters the host request commands.
 */
export function registerHostRequestCommands(): () => void {
  const disposables = [
    registerCommand(HOST_PLUGIN_ID, 'loadRequest', (requestId) => {
      if (typeof requestId !== 'number') {
        throw new Error('harborclient.loadRequest requires a numeric request id.');
      }
      loadSavedRequest(requestId);
    }),
    registerCommand(HOST_PLUGIN_ID, 'openRequestDraft', (payload) => {
      if (!payload || typeof payload !== 'object') {
        throw new Error('harborclient.openRequestDraft requires a draft payload object.');
      }
      openRequestDraft(payload as OpenRequestDraftPayload);
    }),
    registerCommand(HOST_PLUGIN_ID, 'sendRequest', () => {
      triggerSendRequest();
    }),
    registerCommand(HOST_PLUGIN_ID, 'createCollection', async (payload) => {
      await createCollectionFromPlugin(payload as CreateCollectionPayload);
    })
  ];

  return () => {
    for (const disposable of disposables) {
      disposable.dispose();
    }
  };
}
