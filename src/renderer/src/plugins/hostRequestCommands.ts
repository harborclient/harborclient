import type { BodyType, KeyValue, SavedRequest } from '#/shared/types';
import { parseHttpMethod } from '#/shared/httpMethod';
import { defaultAuth } from '#/shared/auth';
import { store } from '#/renderer/src/store/redux';
import type { RootState } from '#/renderer/src/store/redux';
import {
  defaultDraft,
  emptyKeyValue,
  normalizeDraft,
  type RequestDraft
} from '#/renderer/src/store/drafts';
import { closeOverlay } from '#/renderer/src/store/slices/navigationSlice';
import { openTabWithDraft, setActiveTab } from '#/renderer/src/store/slices/tabsSlice';
import { requestLoadRequest } from '#/renderer/src/store/thunks/requests';
import { registerCommand } from '#/renderer/src/plugins/createPluginContext';

const HOST_PLUGIN_ID = 'harborclient';

/**
 * Serializable query parameter captured from a sent request.
 */
export interface OpenRequestDraftParam {
  key: string;
  value: string;
}

/**
 * Serializable request draft payload plugins pass to {@link openRequestDraft}.
 */
export interface OpenRequestDraftPayload {
  name?: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  params?: OpenRequestDraftParam[];
  body?: string;
  bodyType?: BodyType;
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
  const openTab = state.tabs.tabs.find((tab) => tab.draft.id === requestId);
  if (openTab) {
    store.dispatch(closeOverlay());
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
  store.dispatch(closeOverlay());
  store.dispatch(openTabWithDraft(draftFromOpenPayload(payload)));
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
    })
  ];

  return () => {
    for (const disposable of disposables) {
      disposable.dispose();
    }
  };
}
