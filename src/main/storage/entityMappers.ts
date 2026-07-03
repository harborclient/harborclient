import { normalizeVariable } from '#/main/storage/collectionData';
import { normalizeSnippetScope } from '#/shared/snippetScope';
import { defaultAuth, normalizeAuth } from '#/shared/auth';
import { readScriptRefsFromJson } from '#/shared/scriptRefs';
import type {
  BodyType,
  Chat,
  ChatMessage,
  ChatRole,
  ChatSummary,
  Collection,
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
    created_at: readTimestamp(row.created_at)
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
    created_at: readTimestamp(row.created_at)
  };
}

/**
 * Maps a raw database row to a Snippet object.
 *
 * @param row - Row fields including numeric `id`.
 */
export function rowToSnippet(row: Record<string, unknown>): Snippet {
  return {
    id: readNumber(row.id),
    uuid: readString(row.uuid),
    name: readString(row.name),
    code: readString(row.code),
    scope: normalizeSnippetScope(row.scope),
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
    updated_at: readTimestamp(row.updated_at)
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
  return {
    id: readNumber(row.id),
    uuid: readString(row.uuid),
    collection_id: readNumber(row.collection_id),
    name: readString(row.name),
    sort_order: readNumber(row.sort_order),
    created_at: readTimestamp(row.created_at)
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
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    pre_request_scripts: readScriptRefsFromJson(row.pre_request_scripts, preRequestScript),
    post_request_scripts: readScriptRefsFromJson(row.post_request_scripts, postRequestScript),
    comment: readString(row.comment),
    folder_id: row.folder_id != null ? readNullableNumber(row.folder_id) : null,
    sort_order: readNumber(row.sort_order),
    created_at: readTimestamp(row.created_at),
    updated_at: readTimestamp(row.updated_at)
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
 * Maps a Firestore folder document to a Folder object.
 */
export const docToFolder = (id: number, data: Record<string, unknown>): Folder =>
  rowToFolder({ ...data, id });

/**
 * Maps a Firestore request document to a SavedRequest object.
 */
export const docToRequest = (id: number, data: Record<string, unknown>): SavedRequest =>
  rowToRequest({ ...data, id });
