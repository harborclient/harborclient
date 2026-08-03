import type { BodyType, HttpMethod, KeyValue, SendRequestInput, SendResult } from '../types';

/**
 * Minimal RequestInit-compatible options accepted by hc.fetch / hc.host.fetch.
 */
export interface HcFetchInit {
  /**
   * HTTP method (default GET).
   */
  method?: string;

  /**
   * Request headers as a record, header list, or Headers-like object.
   */
  headers?: HeadersInitLike;

  /**
   * Request body. Only strings and URLSearchParams are supported.
   */
  body?: string | URLSearchParams | null;

  /**
   * Rejected when present — AbortSignal is not supported in the sandbox bridge.
   */
  signal?: unknown;
}

/**
 * Headers input shapes accepted by native fetch and hc.fetch.
 */
export type HeadersInitLike =
  | Record<string, string>
  | Array<[string, string]>
  | { forEach: (callback: (value: string, key: string) => void) => void }
  | { entries: () => IterableIterator<[string, string]> };

/**
 * Headers-like facade returned on hc.fetch Response objects.
 */
export interface HcFetchHeaders {
  /**
   * Returns the first header value for the given name (case-insensitive), or null.
   *
   * @param name - Header name.
   */
  get(name: string): string | null;

  /**
   * Returns true when a header with the given name is present.
   *
   * @param name - Header name.
   */
  has(name: string): boolean;

  /**
   * Iterates header entries as [name, value] pairs.
   */
  entries(): IterableIterator<[string, string]>;

  /**
   * Iterates header names.
   */
  keys(): IterableIterator<string>;

  /**
   * Iterates header values.
   */
  values(): IterableIterator<string>;

  /**
   * Invokes callback for each header entry.
   *
   * @param callback - Called with (value, key).
   */
  forEach(callback: (value: string, key: string) => void): void;

  /**
   * Default iterator over [name, value] pairs.
   */
  [Symbol.iterator](): IterableIterator<[string, string]>;
}

/**
 * Response-compatible object returned by hc.fetch / hc.host.fetch.
 */
export interface HcFetchResponse {
  /**
   * True when status is in the 200–299 range.
   */
  readonly ok: boolean;

  /**
   * HTTP status code.
   */
  readonly status: number;

  /**
   * HTTP status text.
   */
  readonly statusText: string;

  /**
   * Response headers.
   */
  readonly headers: HcFetchHeaders;

  /**
   * Returns the response body as text.
   */
  text(): Promise<string>;

  /**
   * Parses the response body as JSON.
   */
  json(): Promise<unknown>;

  /**
   * Returns the response body as an ArrayBuffer (UTF-8 bytes of the text body).
   */
  arrayBuffer(): Promise<ArrayBuffer>;
}

const HTTP_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
]);

/**
 * Builds a Headers-like facade over a flat header map.
 *
 * @param map - Response headers keyed by name.
 * @returns Headers-compatible object.
 */
export function createFetchHeaders(map: Record<string, string>): HcFetchHeaders {
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(map)) {
    normalized.set(key.toLowerCase(), value);
  }

  /**
   * Returns the header value for a name, or null when missing.
   *
   * @param name - Header name (case-insensitive).
   */
  const get = (name: string): string | null => normalized.get(String(name).toLowerCase()) ?? null;

  /**
   * Returns whether a header is present.
   *
   * @param name - Header name (case-insensitive).
   */
  const has = (name: string): boolean => normalized.has(String(name).toLowerCase());

  /**
   * Yields [name, value] pairs from the underlying map.
   */
  function* entries(): IterableIterator<[string, string]> {
    for (const [key, value] of normalized) {
      yield [key, value];
    }
  }

  /**
   * Yields header names.
   */
  function* keys(): IterableIterator<string> {
    for (const key of normalized.keys()) {
      yield key;
    }
  }

  /**
   * Yields header values.
   */
  function* values(): IterableIterator<string> {
    for (const value of normalized.values()) {
      yield value;
    }
  }

  return {
    get,
    has,
    entries,
    keys,
    values,
    forEach: (callback) => {
      for (const [key, value] of normalized) {
        callback(value, key);
      }
    },
    [Symbol.iterator]: entries
  };
}

/**
 * Converts a SendResult into a Response-compatible hc.fetch return value.
 *
 * @param result - HTTP send result from the transport layer.
 * @returns Promise-friendly Response-like object.
 */
export function createFetchResponse(result: SendResult): HcFetchResponse {
  const body = result.body ?? '';
  const headers = createFetchHeaders(result.headers ?? {});
  return {
    ok: result.status >= 200 && result.status < 300,
    status: result.status,
    statusText: result.statusText ?? '',
    headers,
    /**
     * Returns the response body as text.
     */
    text: async () => body,
    /**
     * Parses the response body as JSON.
     */
    json: async () => JSON.parse(body),
    /**
     * Returns the response body as an ArrayBuffer.
     */
    arrayBuffer: async () => {
      const bytes = new TextEncoder().encode(body);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  };
}

/**
 * Normalizes HeadersInit-like values into KeyValue rows.
 *
 * @param headers - Record, array of pairs, or Headers-like object.
 * @returns Enabled header rows for SendRequestInput.
 */
function normalizeHeaders(headers: HeadersInitLike | undefined): KeyValue[] {
  if (headers == null) {
    return [];
  }

  if (Array.isArray(headers)) {
    return headers.map(([key, value]) => ({
      key: String(key),
      value: String(value),
      enabled: true
    }));
  }

  if (typeof headers === 'object') {
    const withForEach = headers as {
      forEach?: (callback: (value: string, key: string) => void) => void;
    };
    if (typeof withForEach.forEach === 'function') {
      const rows: KeyValue[] = [];
      withForEach.forEach((value, key) => {
        rows.push({ key: String(key), value: String(value), enabled: true });
      });
      return rows;
    }

    const withEntries = headers as {
      entries?: () => IterableIterator<[string, string]>;
    };
    if (typeof withEntries.entries === 'function') {
      return [...withEntries.entries()].map(([key, value]) => ({
        key: String(key),
        value: String(value),
        enabled: true
      }));
    }

    return Object.entries(headers as Record<string, unknown>).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }));
  }

  throw new Error('hc.fetch headers must be a record, header list, or Headers-like object');
}

/**
 * Finds the Content-Type header value (case-insensitive), if present.
 *
 * @param headers - Normalized header rows.
 * @returns Content-Type value or empty string.
 */
function findContentType(headers: KeyValue[]): string {
  for (const header of headers) {
    if (header.enabled && header.key.toLowerCase() === 'content-type') {
      return header.value;
    }
  }
  return '';
}

/**
 * Infers SendRequestInput bodyType from Content-Type and body shape.
 *
 * @param contentType - Content-Type header value.
 * @param body - Serialized body string.
 * @param fromUrlSearchParams - True when body came from URLSearchParams.
 * @returns Body type for the HTTP layer.
 */
function inferBodyType(contentType: string, body: string, fromUrlSearchParams: boolean): BodyType {
  if (fromUrlSearchParams) {
    return 'urlencoded';
  }
  if (!body) {
    return 'none';
  }
  const lower = contentType.toLowerCase();
  if (lower.includes('application/json') || lower.includes('+json')) {
    return 'json';
  }
  if (lower.includes('application/x-www-form-urlencoded') || lower.includes('urlencoded')) {
    return 'urlencoded';
  }
  if (lower.includes('multipart/form-data')) {
    return 'multipart';
  }
  return 'text';
}

/**
 * Extracts a URL string from a fetch input argument.
 *
 * @param input - String URL, URL instance, or Request-like `{ url }` object.
 * @returns Absolute or relative URL string.
 * @throws When input cannot be coerced to a non-empty URL.
 */
function resolveFetchUrl(input: unknown): string {
  if (typeof input === 'string') {
    const url = input.trim();
    if (!url) {
      throw new Error('hc.fetch requires a non-empty url');
    }
    return url;
  }

  if (input instanceof URL) {
    return input.href;
  }

  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    if (typeof record.url === 'string') {
      const url = record.url.trim();
      if (!url) {
        throw new Error('hc.fetch requires a non-empty url');
      }
      return url;
    }
    if (typeof record.href === 'string') {
      const url = record.href.trim();
      if (!url) {
        throw new Error('hc.fetch requires a non-empty url');
      }
      return url;
    }
  }

  throw new Error('hc.fetch requires a url string, URL, or Request-like object');
}

/**
 * Normalizes an HTTP method string to a supported HttpMethod.
 *
 * @param method - Method from RequestInit or Request-like input.
 * @returns Uppercase HttpMethod (defaults to GET).
 */
function normalizeMethod(method: unknown): HttpMethod {
  const upper = method != null ? String(method).toUpperCase() : 'GET';
  if (!HTTP_METHODS.has(upper)) {
    throw new Error(`hc.fetch does not support method: ${upper}`);
  }
  return upper as HttpMethod;
}

/**
 * Serializes a fetch body into a string and flags URLSearchParams usage.
 *
 * @param body - RequestInit body value.
 * @returns Serialized body and whether it came from URLSearchParams.
 * @throws When the body type is unsupported (FormData, Blob, ArrayBuffer, etc.).
 */
function normalizeBody(body: unknown): { body: string; fromUrlSearchParams: boolean } {
  if (body == null) {
    return { body: '', fromUrlSearchParams: false };
  }

  if (typeof body === 'string') {
    return { body, fromUrlSearchParams: false };
  }

  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return { body: body.toString(), fromUrlSearchParams: true };
  }

  const name =
    body &&
    typeof body === 'object' &&
    body.constructor &&
    typeof body.constructor.name === 'string'
      ? body.constructor.name
      : typeof body;

  if (
    name === 'FormData' ||
    name === 'Blob' ||
    name === 'File' ||
    name === 'ArrayBuffer' ||
    ArrayBuffer.isView(body as ArrayBufferView)
  ) {
    throw new Error(`hc.fetch does not support body type: ${name}`);
  }

  throw new Error(`hc.fetch body must be a string or URLSearchParams (got ${name})`);
}

/**
 * Converts native fetch(input, init?) arguments into a SendRequestInput for the HTTP layer.
 *
 * @param input - URL string, URL, or Request-like object with a `url` property.
 * @param init - Optional RequestInit-compatible options.
 * @returns Normalized send input for executeHttpSend / script network bridge.
 * @throws When arguments are invalid or unsupported (signal, FormData body, etc.).
 */
export function fetchArgsToSendRequestInput(
  input: unknown,
  init?: HcFetchInit | null
): SendRequestInput {
  if (init != null && (typeof init !== 'object' || Array.isArray(init))) {
    throw new Error('hc.fetch init must be an object when provided');
  }

  if (init?.signal != null) {
    throw new Error('hc.fetch does not support AbortSignal (init.signal)');
  }

  const url = resolveFetchUrl(input);
  let methodSource: unknown = init?.method;
  let headersSource: HeadersInitLike | undefined = init?.headers;
  let bodySource: unknown = init?.body;

  // Request-like first argument can carry method/headers/body when init omits them.
  if (input && typeof input === 'object' && !(input instanceof URL)) {
    const requestLike = input as Record<string, unknown>;
    if (methodSource == null && requestLike.method != null) {
      methodSource = requestLike.method;
    }
    if (headersSource == null && requestLike.headers != null) {
      headersSource = requestLike.headers as HeadersInitLike;
    }
    if (bodySource == null && requestLike.body != null) {
      bodySource = requestLike.body;
    }
  }

  const method = normalizeMethod(methodSource);
  const headers = normalizeHeaders(headersSource);
  const { body, fromUrlSearchParams } = normalizeBody(bodySource);

  if (fromUrlSearchParams && !findContentType(headers)) {
    headers.push({
      key: 'Content-Type',
      value: 'application/x-www-form-urlencoded;charset=UTF-8',
      enabled: true
    });
  }

  const contentType = findContentType(headers);
  const bodyType = inferBodyType(contentType, body, fromUrlSearchParams);

  return {
    method,
    url,
    headers,
    params: [],
    body,
    bodyType
  };
}
