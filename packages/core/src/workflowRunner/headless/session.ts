import type { AuthConfig } from '../../auth';
import { defaultAuth } from '../../auth';
import type { BodyType, HttpMethod, KeyValue } from '../../types/common';
import type { Collection, Environment, Folder, SavedRequest } from '../../types';

/**
 * In-memory request draft maintained by the headless workflow session.
 */
export interface HeadlessRequestDraft {
  /**
   * Saved request database id when loaded from storage.
   */
  id?: number;

  /**
   * Portable request uuid when known.
   */
  uuid?: string;

  /**
   * Owning collection id.
   */
  collection_id?: number;

  /**
   * Owning folder id, or null when at collection root.
   */
  folder_id?: number | null;

  /**
   * Display name.
   */
  name: string;

  /**
   * HTTP method.
   */
  method: HttpMethod;

  /**
   * Request URL (may contain variables).
   */
  url: string;

  /**
   * Request headers.
   */
  headers: KeyValue[];

  /**
   * Query parameters.
   */
  params: KeyValue[];

  /**
   * Auth configuration.
   */
  auth: AuthConfig;

  /**
   * Request-level User-Agent override.
   */
  userAgent: string;

  /**
   * Body type.
   */
  body_type: BodyType;

  /**
   * Request body text.
   */
  body: string;

  /**
   * Raw multipart/binary body reference when present.
   */
  body_raw: string | null;

  /**
   * Pre-request script source (legacy single field).
   */
  pre_request_script: string;

  /**
   * Post-request script source (legacy single field).
   */
  post_request_script: string;

  /**
   * Comma-separated tags.
   */
  tags: string;

  /**
   * Free-form comment.
   */
  comment: string;
}

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
 * Mutable session state for headless workflow playback.
 */
export interface HeadlessWorkflowSession {
  /**
   * Active request draft, or null before the first load/draft.
   */
  activeDraft: HeadlessRequestDraft | null;

  /**
   * Active environment uuid, or null when cleared.
   */
  activeEnvironmentUuid: string | null;
}

/**
 * Host services required by the headless workflow executor.
 */
export interface HeadlessWorkflowHost {
  /**
   * Resolves a saved request by portable uuid (preferred) or numeric id.
   *
   * @param ref - Identity from a recorded request.load payload.
   * @returns Saved request, or null when not found.
   */
  resolveRequest(ref: { uuid?: string; id?: number }): Promise<SavedRequest | null>;

  /**
   * Loads a collection by database id.
   *
   * @param collectionId - Collection id.
   * @returns Collection, or null when missing.
   */
  getCollection(collectionId: number): Promise<Collection | null>;

  /**
   * Loads a folder by database id within a collection.
   *
   * @param collectionId - Collection id.
   * @param folderId - Folder id.
   * @returns Folder, or null when missing.
   */
  getFolder(collectionId: number, folderId: number): Promise<Folder | null>;

  /**
   * Resolves an environment by portable uuid.
   *
   * @param uuid - Environment uuid.
   * @returns Environment, or null when missing.
   */
  getEnvironmentByUuid(uuid: string): Promise<Environment | null>;

  /**
   * Resolves an environment by numeric id (legacy recordings).
   *
   * @param id - Environment database id.
   * @returns Environment, or null when missing.
   */
  getEnvironmentById(id: number): Promise<Environment | null>;
}

/**
 * Creates an empty headless workflow session.
 *
 * @returns Fresh session with no draft or environment.
 */
export function createHeadlessWorkflowSession(): HeadlessWorkflowSession {
  return {
    activeDraft: null,
    activeEnvironmentUuid: null
  };
}

/**
 * Builds a headless draft from a saved request row.
 *
 * @param request - Persisted request.
 * @returns In-memory draft for subsequent draft/send steps.
 */
export function draftFromSavedRequest(request: SavedRequest): HeadlessRequestDraft {
  return {
    id: request.id,
    uuid: request.uuid,
    collection_id: request.collection_id,
    folder_id: request.folder_id ?? null,
    name: request.name,
    method: request.method,
    url: request.url,
    headers: request.headers.map((row) => ({ ...row })),
    params: request.params.map((row) => ({ ...row })),
    auth: request.auth ? structuredClone(request.auth) : defaultAuth(),
    userAgent: request.userAgent ?? '',
    body_type: request.body_type,
    body: request.body,
    body_raw: request.body_raw,
    pre_request_script: request.pre_request_script,
    post_request_script: request.post_request_script,
    tags: request.tags ?? '',
    comment: request.comment ?? ''
  };
}

/**
 * Narrows unknown payload into a draft playback patch when it looks like an object.
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
 * Normalizes key/value rows copied from a recorded draft payload.
 *
 * @param rows - Raw key/value rows.
 * @returns Cloned rows with enabled defaulted to true.
 */
function normalizeKeyValueRows(rows: KeyValue[]): KeyValue[] {
  return rows.map((row) => ({
    key: row.key ?? '',
    value: row.value ?? '',
    enabled: row.enabled !== false
  }));
}

/**
 * Merges a recorded draft payload onto the active headless draft.
 *
 * @param current - Active draft (or a minimal empty draft when null).
 * @param payload - Recorded camelCase draft subset.
 * @returns Updated draft.
 */
export function mergeWorkflowDraftPayload(
  current: HeadlessRequestDraft | null,
  payload: WorkflowDraftPayload
): HeadlessRequestDraft {
  const base: HeadlessRequestDraft =
    current ??
    ({
      name: '',
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      auth: defaultAuth(),
      userAgent: '',
      body_type: 'none',
      body: '',
      body_raw: null,
      pre_request_script: '',
      post_request_script: '',
      tags: '',
      comment: ''
    } satisfies HeadlessRequestDraft);

  const headers = payload.headers != null ? normalizeKeyValueRows(payload.headers) : base.headers;
  const params = payload.params != null ? normalizeKeyValueRows(payload.params) : base.params;

  return {
    ...base,
    id: payload.id === null ? undefined : (payload.id ?? base.id),
    collection_id:
      payload.collectionId === null ? undefined : (payload.collectionId ?? base.collection_id),
    folder_id: payload.folderId === undefined ? base.folder_id : payload.folderId,
    name: typeof payload.name === 'string' ? payload.name : base.name,
    method: typeof payload.method === 'string' ? (payload.method as HttpMethod) : base.method,
    url: typeof payload.url === 'string' ? payload.url : base.url,
    headers,
    params,
    auth: payload.auth ?? base.auth,
    body_type: payload.bodyType ?? base.body_type,
    body: typeof payload.body === 'string' ? payload.body : base.body,
    comment: typeof payload.comment === 'string' ? payload.comment : base.comment
  };
}

/**
 * Workflow action types that are no-ops in headless playback.
 */
export const HEADLESS_SKIPPED_ACTION_TYPES = new Set([
  'tab.activate',
  'tab.new',
  'tab.close',
  'tab.closeAll',
  'page.open',
  'workspace.open',
  'request.save',
  'request.create',
  'request.cancel'
]);
