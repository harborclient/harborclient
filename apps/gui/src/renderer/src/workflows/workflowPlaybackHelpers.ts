import type { BodyType, KeyValue, SavedRequest } from '@harborclient/core/types';
import type { AuthConfig } from '@harborclient/core/auth';
import { normalizeKeyValueRows, type RequestDraft } from '#/renderer/src/store/tabs';
import type { RootState } from '#/renderer/src/store/redux';
import { selectCollections, selectRequestsByCollection } from '#/renderer/src/store/selectors';

/**
 * Recorded `request.draft` payload shape (camelCase subset of a draft).
 */
export interface WorkflowDraftPayload {
  id?: number | null;
  collectionId?: number | null;
  folderId?: number | null;
  name?: string;
  method?: string;
  url?: string;
  headers?: KeyValue[];
  params?: KeyValue[];
  auth?: AuthConfig;
  bodyType?: BodyType;
  body?: string;
  comment?: string;
}

/**
 * Finds a saved request by uuid in cached Redux collection contents.
 *
 * @param state - Root Redux state.
 * @param uuid - Request uuid to locate.
 * @returns Matching saved request, if cached.
 */
export function findSavedRequestByUuid(state: RootState, uuid: string): SavedRequest | undefined {
  for (const requests of Object.values(selectRequestsByCollection(state))) {
    const match = requests.find((request) => request.uuid === uuid);
    if (match != null) {
      return match;
    }
  }
  return undefined;
}

/**
 * Finds a saved request by numeric id in cached Redux collection contents.
 *
 * @param state - Root Redux state.
 * @param id - Request database id.
 * @returns Matching saved request, if cached.
 */
export function findSavedRequestById(state: RootState, id: number): SavedRequest | undefined {
  for (const requests of Object.values(selectRequestsByCollection(state))) {
    const match = requests.find((request) => request.id === id);
    if (match != null) {
      return match;
    }
  }
  return undefined;
}

/**
 * Resolves a full saved request for `request.load` playback.
 *
 * Prefers uuid, then numeric id, then an IPC scan of loaded collections.
 *
 * @param state - Current Redux state.
 * @param payload - Recorded load payload with optional uuid / id.
 * @returns Saved request, or null when it cannot be found.
 */
export async function resolveSavedRequestForPlayback(
  state: RootState,
  payload: { uuid?: unknown; id?: unknown }
): Promise<SavedRequest | null> {
  const uuid = typeof payload.uuid === 'string' && payload.uuid.length > 0 ? payload.uuid : null;
  const id = typeof payload.id === 'number' ? payload.id : null;

  if (uuid != null) {
    const cached = findSavedRequestByUuid(state, uuid);
    if (cached != null) {
      return cached;
    }
  }

  if (id != null) {
    const cached = findSavedRequestById(state, id);
    if (cached != null) {
      return cached;
    }
  }

  if (typeof window === 'undefined' || window.api?.listRequests == null) {
    return null;
  }

  for (const collection of selectCollections(state)) {
    const requests = await window.api.listRequests(collection.id);
    if (uuid != null) {
      const match = requests.find((request) => request.uuid === uuid);
      if (match != null) {
        return match;
      }
    }
    if (id != null) {
      const match = requests.find((request) => request.id === id);
      if (match != null) {
        return match;
      }
    }
  }

  return null;
}

/**
 * Narrows unknown payload into a draft playback patch when core fields look valid.
 *
 * @param value - Recorded request.draft payload.
 * @returns Typed patch, or null when unusable.
 */
export function parseWorkflowDraftPayload(value: unknown): WorkflowDraftPayload | null {
  if (typeof value !== 'object' || value == null) {
    return null;
  }
  return value as WorkflowDraftPayload;
}

/**
 * Merges a recorded draft payload onto the active tab draft for playback.
 *
 * @param current - Active request tab draft.
 * @param payload - Recorded camelCase draft subset.
 * @returns Full draft suitable for `setActiveDraft`.
 */
export function mergeWorkflowDraftPayload(
  current: RequestDraft,
  payload: WorkflowDraftPayload
): RequestDraft {
  const headers =
    payload.headers != null ? normalizeKeyValueRows(payload.headers) : current.headers;
  const params = payload.params != null ? normalizeKeyValueRows(payload.params) : current.params;

  return {
    ...current,
    id: payload.id === null ? undefined : (payload.id ?? current.id),
    collection_id:
      payload.collectionId === null ? undefined : (payload.collectionId ?? current.collection_id),
    folder_id: payload.folderId === undefined ? current.folder_id : payload.folderId,
    name: typeof payload.name === 'string' ? payload.name : current.name,
    method:
      typeof payload.method === 'string'
        ? (payload.method as RequestDraft['method'])
        : current.method,
    url: typeof payload.url === 'string' ? payload.url : current.url,
    headers,
    params,
    auth: payload.auth ?? current.auth,
    body_type: payload.bodyType ?? current.body_type,
    body: typeof payload.body === 'string' ? payload.body : current.body,
    comment: typeof payload.comment === 'string' ? payload.comment : current.comment
  };
}
