import type { HttpMethod } from './types/common';

/**
 * Canonical display and sort order for HarborClient HTTP methods.
 * Ascending sort follows this sequence; descending reverses it.
 */
export const HTTP_METHOD_SORT_ORDER: readonly HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
];

const HTTP_METHODS = new Set<HttpMethod>(HTTP_METHOD_SORT_ORDER);

/**
 * Sort rank for a method string. Known methods use their index in
 * {@link HTTP_METHOD_SORT_ORDER}; unknown or missing values sort last.
 *
 * @param method - Raw method string, or nullish when the item has no method.
 * @returns Zero-based rank, or `HTTP_METHOD_SORT_ORDER.length` when unknown.
 */
function methodSortRank(method: string | null | undefined): number {
  const parsed = parseHttpMethod(method);
  if (parsed == null) {
    return HTTP_METHOD_SORT_ORDER.length;
  }
  return HTTP_METHOD_SORT_ORDER.indexOf(parsed);
}

/**
 * Parses and validates an HTTP method string from user input or plugin hooks.
 *
 * @param method - Raw method value that may include surrounding whitespace or mixed case.
 * @returns Normalized HarborClient method when supported, otherwise null.
 */
export function parseHttpMethod(method: string | undefined | null): HttpMethod | null {
  if (typeof method !== 'string') {
    return null;
  }

  const upper = method.trim().toUpperCase() as HttpMethod;
  return HTTP_METHODS.has(upper) ? upper : null;
}

/**
 * Compares two HTTP method strings for sidebar sorting.
 * Known methods follow {@link HTTP_METHOD_SORT_ORDER}; unknown or missing
 * methods always sort after all known methods (in both directions). Equal
 * ranks return 0 so callers can apply a name (or other) tie-breaker.
 *
 * @param a - First method string, or nullish when absent.
 * @param b - Second method string, or nullish when absent.
 * @param direction - Ascending uses GET→OPTIONS; descending reverses that order.
 * @returns Negative when `a` sorts before `b`, positive when after, 0 when equal.
 */
export function compareHttpMethods(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: 'asc' | 'desc'
): number {
  const leftRank = methodSortRank(a);
  const rightRank = methodSortRank(b);
  const unknownRank = HTTP_METHOD_SORT_ORDER.length;
  const leftUnknown = leftRank === unknownRank;
  const rightUnknown = rightRank === unknownRank;

  if (leftUnknown && rightUnknown) {
    return 0;
  }
  if (leftUnknown) {
    return 1;
  }
  if (rightUnknown) {
    return -1;
  }
  if (leftRank === rightRank) {
    return 0;
  }
  const cmp = leftRank - rightRank;
  return direction === 'asc' ? cmp : -cmp;
}
