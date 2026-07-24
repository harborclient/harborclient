import { normalizeVariable } from './collectionData';
import { normalizeSnippetScope } from '#/shared/snippetScope';
import { normalizeScriptStage } from '#/shared/scriptStage';
import { defaultAuth, normalizeAuth } from '#/shared/auth';
import { readScriptRefsFromJson } from '#/shared/scriptRefs';
import { readSidebarColor } from '#/shared/sidebarColor';
import {
  firstRunResultMethod,
  type ProviderRunResult,
  type ProviderRunResultSummary,
  type RunResultsExport,
  type RunResultsExportKind
} from '#/shared/collectionRunner';
import type {
  BodyType,
  Chat,
  ChatMessage,
  ChatRole,
  ChatSummary,
  Collection,
  CollectionDocument,
  Environment,
  Folder,
  HttpMethod,
  KeyValue,
  SavedRequest,
  Snippet,
  Variable
} from '#/shared/types';

/**
 * Parses a JSON string, returning a fallback value on failure.
 */
function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Coerces an unknown value to a string with a fallback.
 *
 * @param value - Raw field value.
 * @param fallback - Default when value is not a string.
 * @returns The string value or fallback.
 */
function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Returns whether a raw field value is absent (null, undefined, or blank string).
 *
 * @param value - Raw field value.
 */
function isAbsent(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * Attempts to coerce a raw database field to a finite number.
 *
 * Accepts numbers and numeric strings (e.g. driver-returned `"42"`).
 *
 * @param value - Raw field value.
 * @returns Parsed number, or null when coercion is not possible.
 */
function coerceToNumber(value: unknown): number | null {
  if (isAbsent(value)) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Coerces an unknown value to a number with a fallback.
 *
 * Parses numeric strings from database drivers. Logs a warning when a present
 * value cannot be coerced so silent `0` IDs are easier to diagnose.
 *
 * @param value - Raw field value.
 * @param fallback - Default when value is not a number.
 * @returns The numeric value or fallback.
 */
function readNumber(value: unknown, fallback = 0): number {
  const coerced = coerceToNumber(value);
  if (coerced !== null) {
    return coerced;
  }
  if (!isAbsent(value)) {
    console.warn('Failed to coerce database field to number, using fallback:', { value, fallback });
  }
  return fallback;
}

/**
 * Coerces an unknown value to a number or null.
 *
 * Parses numeric strings from database drivers. Logs a warning when a present
 * non-null value cannot be coerced.
 *
 * @param value - Raw field value.
 * @returns The number when numeric, null otherwise.
 */
function readNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const coerced = coerceToNumber(value);
  if (coerced !== null) {
    return coerced;
  }
  if (!isAbsent(value)) {
    console.warn('Failed to coerce nullable database field to number:', value);
  }
  return null;
}

/**
 * Coerces an unknown value to an ISO timestamp string.
 *
 * @param value - Raw field value.
 * @returns ISO string, or current time when invalid.
 */
function readTimestamp(value: unknown): string {
  return readString(value, new Date().toISOString());
}

/**
 * Coerces an unknown value to a string or null when absent or blank.
 *
 * @param value - Raw field value.
 * @returns Trimmed string or null.
 */
function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = typeof value === 'string' ? value.trim() : String(value).trim();
  return text === '' ? null : text;
}

/**
 * Parses a JSON array from an array or JSON string field.
 *
 * @param value - Raw field value.
 * @param fallback - Default when parsing fails.
 * @returns Parsed array or fallback.
 */
function readJsonArray<T>(value: unknown, fallback: T[]): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return parseJson(value, fallback);
  return fallback;
}

/**
 * Parses and normalizes variable rows from storage.
 *
 * @param value - Raw variables field.
 * @returns Normalized Variable array.
 */
function readVariables(value: unknown): Variable[] {
  return readJsonArray<Partial<Variable>>(value, []).map(normalizeVariable);
}

/**
 * Parses auth JSON from a database row, falling back to defaultAuth when absent or invalid.
 *
 * @param value - Raw auth column from storage.
 * @returns Normalized AuthConfig.
 */
function readAuth(value: unknown): ReturnType<typeof defaultAuth> {
  if (typeof value === 'string') {
    try {
      return normalizeAuth(JSON.parse(value));
    } catch {
      return defaultAuth();
    }
  }
  return normalizeAuth(value);
}

/**
 * Maps a raw database row or document record to a Collection object.
 *
 * @param row - Row or document fields including numeric `id`.
 */
export function rowToCollection(row: Record<string, unknown>): Collection {
  const preRequestScript = readString(row.pre_request_script);
  const postRequestScript = readString(row.post_request_script);
  return {
    id: readNumber(row.id),
    uuid: readString(row.uuid),
    name: readString(row.name),
    variables: readVariables(row.variables),
    headers: readJsonArray<KeyValue>(row.headers, []),
    auth: readAuth(row.auth),
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    pre_request_scripts: readScriptRefsFromJson(row.pre_request_scripts, preRequestScript),
    post_request_scripts: readScriptRefsFromJson(row.post_request_scripts, postRequestScript),
    created_at: readTimestamp(row.created_at),
    color: readSidebarColor(row.color)
  };
}

/**
 * Maps a raw database row or document record to an Environment object.
 *
 * @param row - Row or document fields including numeric `id`.
 */
export function rowToEnvironment(row: Record<string, unknown>): Environment {
  return {
    id: readNumber(row.id),
    uuid: readString(row.uuid),
    name: readString(row.name),
    variables: readVariables(row.variables),
    created_at: readTimestamp(row.created_at),
    color: readSidebarColor(row.color)
  };
}

/**
 * Maps a raw provider database row to a Snippet object.
 *
 * Provider rows omit marketplace metadata; callers merge registry routing fields.
 *
 * @param row - Row fields including numeric `id`.
 */
export function rowToProviderSnippet(row: Record<string, unknown>): Snippet {
  return {
    id: readNumber(row.id),
    uuid: readString(row.uuid),
    name: readString(row.name),
    code: readString(row.code),
    scope: normalizeSnippetScope(row.scope),
    stage: normalizeScriptStage(row.stage),
    source: 'local',
    created_at: readTimestamp(row.created_at),
    updated_at: readTimestamp(row.updated_at)
  };
}

/**
 * Maps a raw provider run-results row to list metadata without the payload column.
 *
 * @param row - Row fields including numeric `id` and summary count columns.
 */
export function rowToProviderRunResultSummary(
  row: Record<string, unknown>
): ProviderRunResultSummary {
  const payloadRaw = readString(row.payload);
  let firstRequestMethod: ProviderRunResultSummary['firstRequestMethod'] = null;
  if (payloadRaw) {
    try {
      const payload = parseJson<RunResultsExport>(payloadRaw, {
        harborclientVersion: 1,
        harborclientExport: 'collection-run-results',
        delay: 0,
        stopOnFailure: false,
        environment: { mode: 'active', id: null, name: null },
        results: []
      });
      firstRequestMethod = firstRunResultMethod(payload);
    } catch {
      firstRequestMethod = null;
    }
  }

  return {
    id: readNumber(row.id),
    uuid: readString(row.uuid),
    label: readString(row.label),
    kind: readString(row.kind, 'collection-run-results') as RunResultsExportKind,
    collectionName: readNullableString(row.collection_name),
    requestName: readNullableString(row.request_name),
    summary: {
      passed: readNumber(row.summary_passed),
      failed: readNumber(row.summary_failed),
      skipped: readNumber(row.summary_skipped)
    },
    firstRequestMethod,
    createdAt: readTimestamp(row.created_at)
  };
}

/**
 * Maps a raw provider run-results row to a full {@link ProviderRunResult}.
 *
 * @param row - Row fields including serialized `payload` JSON.
 */
export function rowToProviderRunResult(row: Record<string, unknown>): ProviderRunResult {
  return {
    ...rowToProviderRunResultSummary(row),
    payload: parseJson<RunResultsExport>(readString(row.payload), {
      harborclientVersion: 1,
      harborclientExport: 'collection-run-results',
      delay: 0,
      stopOnFailure: false,
      environment: { mode: 'active', id: null, name: null },
      results: []
    })
  };
}

/**
 * Maps a raw database row to a Snippet object.
 *
 * @param row - Row fields including numeric `id`.
 */
export function rowToSnippet(row: Record<string, unknown>): Snippet {
  const source = row.source === 'marketplace' ? 'marketplace' : 'local';
  const catalogId = typeof row.catalog_id === 'string' ? row.catalog_id : undefined;
  const catalogVersion = typeof row.catalog_version === 'string' ? row.catalog_version : undefined;
  const catalogAuthor = typeof row.catalog_author === 'string' ? row.catalog_author : undefined;

  return {
    id: readNumber(row.id),
    uuid: readString(row.uuid),
    name: readString(row.name),
    code: readString(row.code),
    scope: normalizeSnippetScope(row.scope),
    stage: normalizeScriptStage(row.stage),
    source,
    ...(catalogId ? { catalogId } : {}),
    ...(catalogVersion ? { catalogVersion } : {}),
    ...(catalogAuthor ? { catalogAuthor } : {}),
    created_at: readTimestamp(row.created_at),
    updated_at: readTimestamp(row.updated_at)
  };
}

/**
 * Maps a raw database row to a chat summary.
 *
 * @param row - Row fields including numeric `id`.
 */
export function rowToChatSummary(row: Record<string, unknown>): ChatSummary {
  const model = readString(row.model);
  return {
    id: readNumber(row.id),
    title: readString(row.title),
    ...(model ? { model } : {}),
    updated_at: readTimestamp(row.updated_at),
    message_count: readNumber(row.message_count)
  };
}

/**
 * Maps a raw database row to a chat message.
 *
 * @param row - Row fields including numeric `id` and `chat_id`.
 */
export function rowToChatMessage(row: Record<string, unknown>): ChatMessage {
  const model = readString(row.model);
  return {
    id: readNumber(row.id),
    chatId: readNumber(row.chat_id),
    role: readString(row.role, 'user') as ChatRole,
    content: readString(row.content),
    ...(model ? { model } : {}),
    created_at: readTimestamp(row.created_at)
  };
}

/**
 * Maps chat summary and message rows to a full chat record.
 *
 * @param summaryRow - Chat header row.
 * @param messageRows - Ordered message rows for the chat.
 */
export function rowToChat(
  summaryRow: Record<string, unknown>,
  messageRows: Record<string, unknown>[]
): Chat {
  return {
    ...rowToChatSummary(summaryRow),
    message_count: messageRows.length,
    created_at: readTimestamp(summaryRow.created_at),
    messages: messageRows.map(rowToChatMessage)
  };
}

/**
 * Maps a raw database row or document record to a Folder object.
 *
 * @param row - Row or document fields including numeric `id`.
 */
export function rowToFolder(row: Record<string, unknown>): Folder {
  const preRequestScript = readString(row.pre_request_script);
  const postRequestScript = readString(row.post_request_script);
  return {
    id: readNumber(row.id),
    uuid: readString(row.uuid),
    collection_id: readNumber(row.collection_id),
    name: readString(row.name),
    sort_order: readNumber(row.sort_order),
    variables: readVariables(row.variables),
    headers: readJsonArray<KeyValue>(row.headers, []),
    auth: readAuth(row.auth),
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    pre_request_scripts: readScriptRefsFromJson(row.pre_request_scripts, preRequestScript),
    post_request_scripts: readScriptRefsFromJson(row.post_request_scripts, postRequestScript),
    created_at: readTimestamp(row.created_at),
    color: readSidebarColor(row.color)
  };
}

/**
 * Maps a raw database row or document record to a SavedRequest object.
 *
 * @param row - Row or document fields including numeric `id`.
 */
export function rowToRequest(row: Record<string, unknown>): SavedRequest {
  const preRequestScript = readString(row.pre_request_script);
  const postRequestScript = readString(row.post_request_script);
  return {
    id: readNumber(row.id),
    uuid: readString(row.uuid),
    collection_id: readNumber(row.collection_id),
    name: readString(row.name),
    method: readString(row.method, 'GET') as HttpMethod,
    url: readString(row.url),
    headers: readJsonArray<KeyValue>(row.headers, []),
    params: readJsonArray<KeyValue>(row.params, []),
    auth: readAuth(row.auth),
    body: readString(row.body),
    body_type: readString(row.body_type, 'none') as BodyType,
    body_raw: row.body_raw == null ? null : readString(row.body_raw),
    body_raw_open: row.body_raw_open === true || row.body_raw_open === 1,
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    pre_request_scripts: readScriptRefsFromJson(row.pre_request_scripts, preRequestScript),
    post_request_scripts: readScriptRefsFromJson(row.post_request_scripts, postRequestScript),
    comment: readString(row.comment),
    tags: readString(row.tags),
    folder_id: row.folder_id != null ? readNullableNumber(row.folder_id) : null,
    sort_order: readNumber(row.sort_order),
    created_at: readTimestamp(row.created_at),
    updated_at: readTimestamp(row.updated_at),
    color: readSidebarColor(row.color)
  };
}

/**
 * Maps a raw database row or document record to a CollectionDocument object.
 *
 * @param row - Row or document fields including numeric `id`.
 */
export function rowToDocument(row: Record<string, unknown>): CollectionDocument {
  return {
    id: readNumber(row.id),
    uuid: readString(row.uuid),
    collection_id: readNumber(row.collection_id),
    folder_id: row.folder_id != null ? readNullableNumber(row.folder_id) : null,
    name: readString(row.name),
    content: readString(row.content),
    sort_order: readNumber(row.sort_order),
    created_at: readTimestamp(row.created_at),
    updated_at: readTimestamp(row.updated_at),
    color: readSidebarColor(row.color)
  };
}

/**
 * Maps a Firestore collection document to a Collection object.
 */
export const docToCollection = (id: number, data: Record<string, unknown>): Collection =>
  rowToCollection({ ...data, id });

/**
 * Maps a Firestore environment document to an Environment object.
 */
export const docToEnvironment = (id: number, data: Record<string, unknown>): Environment =>
  rowToEnvironment({ ...data, id });

/**
 * Maps a Firestore snippet document to a Snippet object.
 */
export const docToProviderSnippet = (id: number, data: Record<string, unknown>): Snippet =>
  rowToProviderSnippet({ ...data, id });

/**
 * Maps a Firestore folder document to a Folder object.
 */
export const docToFolder = (id: number, data: Record<string, unknown>): Folder =>
  rowToFolder({ ...data, id });

/**
 * Maps a Firestore request document to a SavedRequest object.
 */
export const docToRequest = (id: number, data: Record<string, unknown>): SavedRequest =>
  rowToRequest({ ...data, id });

/**
 * Maps a Firestore markdown document to a CollectionDocument object.
 */
export const docToDocument = (id: number, data: Record<string, unknown>): CollectionDocument =>
  rowToDocument({ ...data, id });
