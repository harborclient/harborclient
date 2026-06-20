import { normalizeVariable } from '#/main/db/collectionData';
import type {
  BodyType,
  Collection,
  Environment,
  Folder,
  HttpMethod,
  KeyValue,
  SavedRequest,
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

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : value === null ? null : null;
}

function readTimestamp(value: unknown): string {
  return readString(value, new Date().toISOString());
}

function readJsonArray<T>(value: unknown, fallback: T[]): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return parseJson(value, fallback);
  return fallback;
}

function readVariables(value: unknown): Variable[] {
  return readJsonArray<Partial<Variable>>(value, []).map(normalizeVariable);
}

/**
 * Maps a raw database row or document record to a Collection object.
 *
 * @param row - Row or document fields including numeric `id`.
 */
export function rowToCollection(row: Record<string, unknown>): Collection {
  return {
    id: readNumber(row.id),
    name: readString(row.name),
    variables: readVariables(row.variables),
    headers: readJsonArray<KeyValue>(row.headers, []),
    pre_request_script: readString(row.pre_request_script),
    post_request_script: readString(row.post_request_script),
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
    name: readString(row.name),
    variables: readVariables(row.variables),
    created_at: readTimestamp(row.created_at)
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
  return {
    id: readNumber(row.id),
    collection_id: readNumber(row.collection_id),
    name: readString(row.name),
    method: readString(row.method, 'GET') as HttpMethod,
    url: readString(row.url),
    headers: readJsonArray<KeyValue>(row.headers, []),
    params: readJsonArray<KeyValue>(row.params, []),
    body: readString(row.body),
    body_type: readString(row.body_type, 'none') as BodyType,
    pre_request_script: readString(row.pre_request_script),
    post_request_script: readString(row.post_request_script),
    comment: readString(row.comment),
    folder_id: row.folder_id != null ? readNullableNumber(row.folder_id) : null,
    sort_order: readNumber(row.sort_order),
    created_at: readTimestamp(row.created_at),
    updated_at: readTimestamp(row.updated_at)
  };
}

/** Maps a Firestore collection document to a Collection object. */
export const docToCollection = (id: number, data: Record<string, unknown>): Collection =>
  rowToCollection({ ...data, id });

/** Maps a Firestore environment document to an Environment object. */
export const docToEnvironment = (id: number, data: Record<string, unknown>): Environment =>
  rowToEnvironment({ ...data, id });

/** Maps a Firestore folder document to a Folder object. */
export const docToFolder = (id: number, data: Record<string, unknown>): Folder =>
  rowToFolder({ ...data, id });

/** Maps a Firestore request document to a SavedRequest object. */
export const docToRequest = (id: number, data: Record<string, unknown>): SavedRequest =>
  rowToRequest({ ...data, id });
