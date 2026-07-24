import type { KeyValue } from '#/shared/types/common';

/**
 * Base URL, query string (without leading ?), and hash fragment (without leading #).
 */
export interface SplitUrl {
  /**
   * URL portion before the query string and hash.
   */
  base: string;

  /**
   * Query string without a leading ?; empty when absent.
   */
  query: string;

  /**
   * Hash fragment without a leading #; empty when absent.
   */
  hash: string;
}

/**
 * Returns a blank enabled key-value row for the params editor trailing row.
 *
 * @returns Empty KeyValue entry.
 */
function emptyParamRow(): KeyValue {
  return { key: '', value: '', enabled: true };
}

/**
 * Splits a URL into base path, query string, and hash fragment without re-encoding.
 *
 * @param url - Full request URL as typed in the editor.
 * @returns Lenient split preserving raw text including {{variables}}.
 */
export function splitUrl(url: string): SplitUrl {
  const hashIndex = url.indexOf('#');
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex + 1);
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf('?');
  const base = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : beforeHash.slice(queryIndex + 1);

  return { base, query, hash };
}

/**
 * Parses the query string from a URL into key-value rows without decoding values.
 *
 * @param url - Full request URL as typed in the editor.
 * @returns Parsed rows with enabled set to true; empty keys are skipped.
 */
export function parseQueryString(url: string): KeyValue[] {
  const { query } = splitUrl(url);
  if (!query) {
    return [];
  }

  const rows: KeyValue[] = [];
  for (const segment of query.split('&')) {
    if (!segment) {
      continue;
    }

    const equalsIndex = segment.indexOf('=');
    const key = equalsIndex === -1 ? segment : segment.slice(0, equalsIndex);
    const value = equalsIndex === -1 ? '' : segment.slice(equalsIndex + 1);
    if (!key.trim()) {
      continue;
    }

    rows.push({ key, value, enabled: true });
  }

  return rows;
}

/**
 * Returns enabled params with a non-empty key, preserving editor row order.
 *
 * @param params - Params table rows from the request editor.
 * @returns Rows that should appear in the URL query string.
 */
function enabledParams(params: KeyValue[]): KeyValue[] {
  return params.filter((row) => row.enabled && row.key.trim());
}

const SEND_URL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Returns whether a URL string is a root-relative path (`/api`), not protocol-relative (`//cdn`).
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
 * @param activeParams - Enabled key-value pairs to append.
 */
function appendQueryFallback(trimmed: string, activeParams: KeyValue[]): string {
  const separator = trimmed.includes('?') ? '&' : '?';
  const query = activeParams
    .map((param) => `${encodeURIComponent(param.key.trim())}=${encodeURIComponent(param.value)}`)
    .join('&');
  return `${trimmed}${separator}${query}`;
}

/**
 * Appends enabled query parameters to a base URL for outbound sends.
 *
 * Matches `@harborclient/http` QueryString.buildUrl so renderer-side URL previews
 * (for example sidebar Copy) align with the URL the main process sends.
 *
 * @param baseUrl - Request URL before query string merging.
 * @param params - Key-value pairs to append as search params.
 * @returns URL with merged query parameters.
 */
export function buildSendUrl(baseUrl: string, params: KeyValue[]): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return trimmed;
  }

  const active = enabledParams(params);
  if (active.length === 0) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (!SEND_URL_PROTOCOLS.has(url.protocol)) {
      return trimmed;
    }
    for (const param of active) {
      url.searchParams.set(param.key.trim(), param.value);
    }
    return url.toString();
  } catch {
    if (!isRootRelativePath(trimmed)) {
      return trimmed;
    }
    return appendQueryFallback(trimmed, active);
  }
}

/**
 * Rebuilds a URL query string from enabled params without re-encoding raw text.
 *
 * @param url - Current request URL including any existing query and hash.
 * @param params - Params table rows from the request editor.
 * @returns URL with query string replaced from enabled params; hash preserved.
 */
export function applyParamsToUrl(url: string, params: KeyValue[]): string {
  const { base, hash } = splitUrl(url);
  const active = enabledParams(params);

  const query = active
    .map((row) => {
      const key = row.key.trim();
      return row.value === '' ? key : `${key}=${row.value}`;
    })
    .join('&');

  let result = base;
  if (query) {
    result += `?${query}`;
  }
  if (hash) {
    result += `#${hash}`;
  }

  return result;
}

/**
 * Returns whether a params row has content worth preserving when disabled.
 *
 * @param row - Params table row.
 * @returns True when the row has a non-empty key or value.
 */
function hasParamContent(row: KeyValue): boolean {
  return row.key.trim() !== '' || row.value.trim() !== '';
}

/**
 * Merges query params parsed from a URL with disabled rows from the current table.
 *
 * Enabled rows come from the URL (source of truth). Disabled non-empty rows from
 * the current table are kept at the end so they remain editable but stay out of the URL.
 *
 * @param url - Updated request URL from the URL bar.
 * @param currentParams - Existing params table rows.
 * @returns Params rows for the editor, ending with one blank trailing row.
 */
export function mergeParamsFromUrl(url: string, currentParams: KeyValue[]): KeyValue[] {
  const fromUrl = parseQueryString(url);
  const disabledRows = currentParams.filter((row) => !row.enabled && hasParamContent(row));
  const merged = [...fromUrl, ...disabledRows];

  if (merged.length === 0 || merged[merged.length - 1].key.trim() !== '') {
    merged.push(emptyParamRow());
  }

  return merged;
}
