import { defaultAuth } from '#/shared/auth';
import { serializeFormParts } from '#/shared/formData';
import { parseQueryString, splitUrl } from '#/shared/queryParams';
import { serializeUrlEncodedParts } from '#/shared/urlencoded';
import type {
  BodyType,
  CollectionExport,
  ExportedRequest,
  FormDataPart,
  HttpMethod,
  KeyValue
} from '#/shared/types';

/**
 * HTTP methods HarborClient accepts for saved requests.
 */
const SUPPORTED_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
]);

/**
 * Chrome DevTools resource types that represent API-like traffic.
 */
const API_RESOURCE_TYPES = new Set(['xhr', 'fetch', 'document']);

/**
 * Chrome DevTools resource types that represent static assets to skip.
 */
const STATIC_RESOURCE_TYPES = new Set([
  'stylesheet',
  'script',
  'image',
  'font',
  'media',
  'manifest',
  'websocket',
  'other'
]);

/**
 * Loose HAR header entry from a request or response block.
 */
interface HarHeader {
  name?: string;
  value?: string;
}

/**
 * Loose HAR query-string entry from a request block.
 */
interface HarQueryParam {
  name?: string;
  value?: string;
}

/**
 * Loose HAR post body parameter from form or multipart submissions.
 */
interface HarPostParam {
  name?: string;
  value?: string;
  fileName?: string;
  contentType?: string;
}

/**
 * Loose HAR postData block from a request.
 */
interface HarPostData {
  mimeType?: string;
  text?: string;
  params?: HarPostParam[];
}

/**
 * Loose HAR request block nested under an entry.
 */
interface HarRequest {
  method?: string;
  url?: string;
  headers?: HarHeader[];
  queryString?: HarQueryParam[];
  postData?: HarPostData;
}

/**
 * Loose HAR response content block used for API-like heuristics.
 */
interface HarResponseContent {
  mimeType?: string;
}

/**
 * Loose HAR response block nested under an entry.
 */
interface HarResponse {
  content?: HarResponseContent;
}

/**
 * Loose HAR log entry representing one captured network request.
 */
interface HarEntry {
  _resourceType?: string;
  request?: HarRequest;
  response?: HarResponse;
}

/**
 * Loose HAR page metadata from the capture session.
 */
interface HarPage {
  title?: string;
}

/**
 * Loose HAR creator metadata from the exporting tool.
 */
interface HarCreator {
  name?: string;
}

/**
 * Loose HAR log root containing captured entries.
 */
interface HarLog {
  version?: string;
  creator?: HarCreator;
  pages?: HarPage[];
  entries?: HarEntry[];
}

/**
 * Loose HAR archive root document.
 */
interface HarArchive {
  log?: HarLog;
}

/**
 * Options for converting a HAR archive into a HarborClient collection export.
 */
export interface ConvertHarOptions {
  /**
   * Fallback collection name, typically the selected import file's base name.
   */
  name?: string;
}

/**
 * Returns whether a parsed JSON value looks like an HTTP Archive (HAR) export.
 *
 * @param data - Parsed JSON from an import file.
 * @returns True when the document has a `log.entries` array and is not a HarborClient export.
 */
export function isHarArchive(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const record = data as Record<string, unknown>;
  if (record.harborclientExport != null) {
    return false;
  }

  const log = record.log;
  if (!log || typeof log !== 'object') {
    return false;
  }

  return Array.isArray((log as Record<string, unknown>).entries);
}

/**
 * Normalizes a HAR HTTP method string to a supported HarborClient method.
 *
 * @param method - Method string from a HAR request block.
 * @returns Supported HTTP method, defaulting to GET when unrecognized.
 */
function normalizeMethod(method: string | undefined): HttpMethod {
  const upper = (method ?? 'GET').trim().toUpperCase();
  if (SUPPORTED_METHODS.has(upper as HttpMethod)) {
    return upper as HttpMethod;
  }

  return 'GET';
}

/**
 * Maps HAR request headers to HarborClient key-value rows.
 *
 * @param headers - HAR header list from a request.
 * @returns HarborClient header rows with HTTP/2 pseudo-headers removed.
 */
function convertHeaders(headers: HarHeader[] | undefined): KeyValue[] {
  if (!headers) {
    return [];
  }

  return headers
    .filter((header) => typeof header.name === 'string' && header.name.trim().length > 0)
    .filter((header) => !header.name!.trim().startsWith(':'))
    .map((header) => ({
      key: header.name!.trim(),
      value: typeof header.value === 'string' ? header.value : '',
      enabled: true
    }));
}

/**
 * Returns whether request headers indicate a JSON body.
 *
 * @param headers - Converted HarborClient header rows.
 * @returns True when Content-Type is application/json.
 */
function headersIndicateJson(headers: KeyValue[]): boolean {
  return headers.some(
    (header) =>
      header.enabled &&
      header.key.trim().toLowerCase() === 'content-type' &&
      header.value.trim().toLowerCase().includes('application/json')
  );
}

/**
 * Maps HAR query-string entries to HarborClient params and strips the query from the URL.
 *
 * @param queryString - HAR queryString array from a request block.
 * @param url - Full request URL from the HAR entry.
 * @returns Base URL without query and parsed params rows.
 */
function convertQueryParams(
  queryString: HarQueryParam[] | undefined,
  url: string
): { url: string; params: KeyValue[] } {
  if (queryString && queryString.length > 0) {
    const params = queryString
      .filter((param) => typeof param.name === 'string' && param.name.trim().length > 0)
      .map((param) => ({
        key: param.name!.trim(),
        value: typeof param.value === 'string' ? param.value : '',
        enabled: true
      }));
    const { base } = splitUrl(url);
    return { url: base, params };
  }

  const params = parseQueryString(url);
  const { base } = splitUrl(url);
  return { url: base, params };
}

/**
 * Maps HAR urlencoded post parameters to HarborClient key-value rows.
 *
 * @param params - HAR postData.params list.
 * @returns Enabled key-value rows for urlencoded serialization.
 */
function convertUrlEncodedParams(params: HarPostParam[]): KeyValue[] {
  return params
    .filter((param) => typeof param.name === 'string' && param.name.trim().length > 0)
    .map((param) => ({
      key: param.name!.trim(),
      value: typeof param.value === 'string' ? param.value : '',
      enabled: true
    }));
}

/**
 * Maps HAR multipart post parameters to HarborClient form parts.
 *
 * @param params - HAR postData.params list.
 * @returns Form parts ready for multipart serialization.
 */
function convertMultipartParams(params: HarPostParam[]): FormDataPart[] {
  return params
    .filter((param) => typeof param.name === 'string' && param.name.trim().length > 0)
    .map((param) => ({
      key: param.name!.trim(),
      value: typeof param.value === 'string' ? param.value : '',
      enabled: true,
      type:
        typeof param.fileName === 'string' && param.fileName.trim().length > 0
          ? ('file' as const)
          : ('text' as const),
      files: [] as string[]
    }));
}

/**
 * Maps a HAR postData block to HarborClient body type and serialized body content.
 *
 * @param postData - HAR postData block from a request.
 * @param headers - Converted request headers used to infer JSON bodies.
 * @returns HarborClient body type and serialized body string.
 */
function convertPostData(
  postData: HarPostData | undefined,
  headers: KeyValue[]
): { body: string; body_type: BodyType } {
  if (!postData) {
    return { body: '', body_type: 'none' };
  }

  const mimeType = (typeof postData.mimeType === 'string' ? postData.mimeType : '').toLowerCase();
  const params = postData.params;
  const text = typeof postData.text === 'string' ? postData.text : '';
  const isUrlEncoded = mimeType.includes('application/x-www-form-urlencoded');
  const isMultipart = mimeType.includes('multipart/form-data');

  if (isUrlEncoded && params && params.length > 0) {
    return {
      body: serializeUrlEncodedParts(convertUrlEncodedParams(params)),
      body_type: 'urlencoded'
    };
  }

  if (isMultipart && params && params.length > 0) {
    return {
      body: serializeFormParts(convertMultipartParams(params)),
      body_type: 'multipart'
    };
  }

  if (text) {
    if (mimeType.includes('application/json') || headersIndicateJson(headers)) {
      return { body: text, body_type: 'json' };
    }

    return { body: text, body_type: 'text' };
  }

  if (params && params.length > 0) {
    if (isMultipart) {
      return {
        body: serializeFormParts(convertMultipartParams(params)),
        body_type: 'multipart'
      };
    }

    return {
      body: serializeUrlEncodedParts(convertUrlEncodedParams(params)),
      body_type: 'urlencoded'
    };
  }

  return { body: '', body_type: 'none' };
}

/**
 * Returns whether a response mime type indicates static asset content to skip.
 *
 * @param mimeType - Response content mime type from a HAR entry.
 * @returns True when the mime type represents a non-API static resource.
 */
function isStaticAssetMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (
    normalized.startsWith('image/') ||
    normalized.startsWith('font/') ||
    normalized.startsWith('audio/') ||
    normalized.startsWith('video/')
  ) {
    return true;
  }

  if (normalized === 'text/css') {
    return true;
  }

  return (
    normalized.includes('javascript') ||
    normalized.endsWith('/javascript') ||
    normalized === 'application/javascript' ||
    normalized === 'text/javascript'
  );
}

/**
 * Returns whether a response mime type indicates API-like content worth importing.
 *
 * @param mimeType - Response content mime type from a HAR entry.
 * @returns True when the mime type suggests JSON, XML, text, or form data.
 */
function isApiLikeResponseMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.includes('json')) {
    return true;
  }

  if (normalized.includes('xml')) {
    return true;
  }

  if (normalized.startsWith('text/')) {
    return true;
  }

  if (
    normalized.includes('form') ||
    normalized.includes('graphql') ||
    normalized.includes('x-www-form-urlencoded')
  ) {
    return true;
  }

  return false;
}

/**
 * Returns whether a HAR entry represents API-like traffic rather than a static asset.
 *
 * @param entry - HAR log entry from the capture.
 * @returns True when the entry should be converted into a saved request.
 */
function isApiLikeEntry(entry: HarEntry): boolean {
  const request = entry.request;
  if (!request || typeof request.url !== 'string' || request.url.trim().length === 0) {
    return false;
  }

  const resourceType = entry._resourceType?.trim().toLowerCase();
  if (resourceType) {
    if (API_RESOURCE_TYPES.has(resourceType)) {
      return true;
    }

    if (STATIC_RESOURCE_TYPES.has(resourceType)) {
      return false;
    }
  }

  const method = normalizeMethod(request.method);
  if (method !== 'GET') {
    return true;
  }

  if (request.postData != null) {
    return true;
  }

  const responseMimeType = entry.response?.content?.mimeType ?? '';
  if (isStaticAssetMimeType(responseMimeType)) {
    return false;
  }

  return isApiLikeResponseMimeType(responseMimeType);
}

/**
 * Derives a display name for an imported request from its method and URL path.
 *
 * @param method - Normalized HTTP method.
 * @param url - Full request URL from the HAR entry.
 * @returns Request name in the form "METHOD /path".
 */
function requestName(method: HttpMethod, url: string): string {
  try {
    const parsed = new URL(url);
    return `${method} ${parsed.pathname || '/'}`;
  } catch {
    const { base } = splitUrl(url);
    const match = base.match(/^https?:\/\/[^/]+(\/.*)?$/i);
    if (match) {
      return `${method} ${match[1] || '/'}`;
    }

    return `${method} ${base}`;
  }
}

/**
 * Resolves the collection name from HAR metadata and optional import context.
 *
 * @param log - HAR log block from the archive.
 * @param fallbackName - Optional name from the selected import file.
 * @returns Collection display name for the imported capture.
 */
function resolveCollectionName(log: HarLog, fallbackName?: string): string {
  for (const page of log.pages ?? []) {
    if (typeof page.title === 'string' && page.title.trim().length > 0) {
      return page.title.trim();
    }
  }

  if (typeof log.creator?.name === 'string' && log.creator.name.trim().length > 0) {
    return log.creator.name.trim();
  }

  if (typeof fallbackName === 'string' && fallbackName.trim().length > 0) {
    return fallbackName.trim();
  }

  return 'Imported HAR';
}

/**
 * Converts one HAR log entry into a HarborClient exported request row.
 *
 * @param entry - HAR log entry from the capture.
 * @param sortOrder - Original capture index used for stable ordering.
 * @returns Exported request row, or null when the entry should be skipped.
 */
function convertEntry(entry: HarEntry, sortOrder: number): ExportedRequest | null {
  if (!isApiLikeEntry(entry)) {
    return null;
  }

  const request = entry.request!;
  const rawUrl = request.url!.trim();
  const method = normalizeMethod(request.method);
  const headers = convertHeaders(request.headers);
  const { url, params } = convertQueryParams(request.queryString, rawUrl);
  const { body, body_type } = convertPostData(request.postData, headers);

  return {
    name: requestName(method, rawUrl),
    method,
    url,
    headers,
    params,
    auth: defaultAuth(),
    body,
    body_type,
    pre_request_script: '',
    post_request_script: '',
    comment: '',
    tags: '',
    sort_order: sortOrder,
    folder_name: null
  };
}

/**
 * Converts a parsed HAR archive into a HarborClient collection export.
 *
 * @param data - Parsed JSON from a `.har` import file.
 * @param options - Optional conversion settings such as a fallback collection name.
 * @returns HarborClient collection export ready for validation and persistence.
 * @throws When the payload is not a HAR archive or contains no importable entries.
 */
export function convertHarToCollection(
  data: unknown,
  options?: ConvertHarOptions
): CollectionExport {
  if (!isHarArchive(data)) {
    throw new Error('Selected file is not a valid HAR archive.');
  }

  const archive = data as HarArchive;
  const log = archive.log!;
  const requests: ExportedRequest[] = [];

  for (const [index, entry] of (log.entries ?? []).entries()) {
    const converted = convertEntry(entry, index);
    if (converted) {
      requests.push(converted);
    }
  }

  if (requests.length === 0) {
    throw new Error('HAR archive contains no API-like requests to import.');
  }

  return {
    harborclientVersion: 1,
    harborclientExport: 'collection',
    name: resolveCollectionName(log, options?.name),
    variables: [],
    headers: [],
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    folders: [],
    requests
  };
}
