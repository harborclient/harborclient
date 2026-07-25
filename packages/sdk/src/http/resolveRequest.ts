import type { AuthConfig, RequestDraft, RequestTabContext } from '../types.js';
import { resolveAuthVariables, substituteKeyValueRows, substituteVariables } from './substitute.js';

type KeyValue = {
  key: string;
  value: string;
  enabled: boolean;
};

/**
 * Fully merged, variable-substituted request snapshot matching HarborClient send-time behavior.
 *
 * This mirrors the host send pipeline but is maintained in the SDK — drift is possible when
 * host send logic changes.
 */
export interface ResolvedRequest {
  /**
   * HTTP method in uppercase when non-GET.
   */
  method: string;

  /**
   * Final URL including merged query parameters.
   */
  url: string;

  /**
   * Outgoing request headers as a flat key/value map.
   */
  headers: Record<string, string>;

  /**
   * Request body content as a string.
   */
  body: string;
}

/**
 * Returns whether a header field contains control characters unsafe for HTTP.
 *
 * @param value - Header name or value to inspect.
 */
function hasUnsafeHeaderFieldChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Encodes username and password as a UTF-8-safe Basic Auth credential string.
 *
 * @param username - Basic Auth username.
 * @param password - Basic Auth password.
 */
export function encodeBasicAuth(username: string, password: string): string {
  const credential = `${username}:${password}`;
  if (typeof TextEncoder !== 'undefined' && typeof globalThis.btoa === 'function') {
    const bytes = new TextEncoder().encode(credential);
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return globalThis.btoa(binary);
  }
  return globalThis.btoa?.(credential) ?? credential;
}

/**
 * Builds the Authorization header value from an auth config.
 *
 * @param auth - Auth configuration from the request or collection.
 */
export function buildAuthHeaderValue(auth: AuthConfig): string | null {
  if (auth.type === 'none') {
    return null;
  }
  if (auth.type === 'basic') {
    const username = auth.basic.username.trim();
    const password = auth.basic.password;
    if (!username && !password.trim()) {
      return null;
    }
    return `Basic ${encodeBasicAuth(username, password)}`;
  }
  const token = auth.bearer.token.trim();
  if (!token || hasUnsafeHeaderFieldChars(token)) {
    return null;
  }
  return `Bearer ${token}`;
}

/**
 * Returns whether a URL string is a root-relative path.
 *
 * @param url - Trimmed URL string.
 */
function isRootRelativePath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

/**
 * Appends query parameters via string concatenation for root-relative paths.
 *
 * @param trimmed - Trimmed base URL that failed absolute URL parsing.
 * @param enabledParams - Enabled key-value pairs to append.
 */
function appendQueryFallback(
  trimmed: string,
  enabledParams: Array<{ key: string; value: string }>
): string {
  const separator = trimmed.includes('?') ? '&' : '?';
  const query = enabledParams
    .map((param) => `${encodeURIComponent(param.key.trim())}=${encodeURIComponent(param.value)}`)
    .join('&');
  return `${trimmed}${separator}${query}`;
}

/**
 * Merges enabled query parameters into a base URL.
 *
 * @param baseUrl - Request URL before query string merging.
 * @param params - Key-value pairs to append as search params.
 */
export function buildUrl(baseUrl: string, params: KeyValue[]): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return trimmed;
  }
  const enabledParams = params.filter((param) => param.enabled && param.key.trim());
  if (enabledParams.length === 0) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return trimmed;
    }
    for (const param of enabledParams) {
      url.searchParams.set(param.key.trim(), param.value);
    }
    return url.toString();
  } catch {
    if (!isRootRelativePath(trimmed)) {
      return trimmed;
    }
    return appendQueryFallback(trimmed, enabledParams);
  }
}

/**
 * Returns enabled key-value rows with non-empty keys.
 *
 * @param rows - Header or param rows from the draft.
 */
function enabledRows(rows: KeyValue[]): KeyValue[] {
  return rows.filter((row) => row.enabled && row.key.trim());
}

/**
 * Returns true when any enabled row is a non-empty Authorization header.
 *
 * @param rows - Header rows to inspect.
 */
function hasManualAuthorization(rows: KeyValue[]): boolean {
  return enabledRows(rows).some(
    (row) => row.key.trim().toLowerCase() === 'authorization' && row.value.trim() !== ''
  );
}

/**
 * Builds outgoing request headers mirroring HarborClient send-time defaults.
 *
 * @param draft - Active request draft.
 * @param collectionHeaders - Collection-level headers.
 * @param authValue - Computed Authorization header value, if any.
 */
export function buildHeaders(
  draft: RequestDraft,
  collectionHeaders: KeyValue[],
  authValue: string | null
): Record<string, string> {
  const mergedRows = [
    ...(authValue && !hasManualAuthorization([...collectionHeaders, ...draft.headers])
      ? [{ key: 'Authorization', value: authValue, enabled: true as const }]
      : []),
    ...collectionHeaders,
    ...draft.headers
  ];
  const result: Record<string, string> = {};
  for (const header of enabledRows(mergedRows)) {
    const key = header.key.trim();
    if (draft.body_type === 'multipart' && key.toLowerCase() === 'content-type') {
      continue;
    }
    result[key] = header.value;
  }
  const hasContentType = Object.keys(result).some((key) => key.toLowerCase() === 'content-type');
  if (!hasContentType) {
    if (draft.body_type === 'json') {
      result['Content-Type'] = 'application/json';
    } else if (draft.body_type === 'text') {
      result['Content-Type'] = 'text/plain';
    } else if (draft.body_type === 'urlencoded') {
      result['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }
  return result;
}

/**
 * Returns the fully merged, variable-substituted request as HarborClient would send it.
 *
 * @param context - Read-only request tab context from the host.
 */
export function resolveRequest(context: RequestTabContext): ResolvedRequest {
  const { draft, collectionAuth, collectionHeaders, variables } = context;
  const substitute = (text: string) => substituteVariables(text, variables);
  const resolvedDraft = {
    ...draft,
    url: substitute(draft.url),
    body: substitute(draft.body),
    params: substituteKeyValueRows(draft.params, variables),
    headers: substituteKeyValueRows(draft.headers, variables),
    auth: resolveAuthVariables(draft.auth, substitute)
  };
  const resolvedCollectionHeaders = substituteKeyValueRows(collectionHeaders, variables);
  const resolvedCollectionAuth = resolveAuthVariables(collectionAuth, substitute);
  const effectiveAuth =
    resolvedDraft.auth.type !== 'none' ? resolvedDraft.auth : resolvedCollectionAuth;
  const authValue = buildAuthHeaderValue(effectiveAuth);
  const url = buildUrl(resolvedDraft.url, resolvedDraft.params);
  const headers = buildHeaders(resolvedDraft, resolvedCollectionHeaders, authValue);
  return {
    method: resolvedDraft.method,
    url,
    headers,
    body: resolvedDraft.body
  };
}
