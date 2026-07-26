import type { ConsoleEntry } from '#/renderer/src/store';

/**
 * Returns whether a console entry matches a case-insensitive substring query
 * against the fields shown in the list row (method, URL, status, names).
 *
 * @param entry - Console log entry to test.
 * @param query - Raw search text; empty or whitespace-only matches everything.
 * @returns True when the entry should remain visible for the query.
 */
export function matchesConsoleEntry(entry: ConsoleEntry, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') {
    return true;
  }

  const { result } = entry;
  const method = result.request?.method ?? '';
  const url = result.request?.url ?? '';
  const statusLabel = result.error ? 'Error' : `${result.status} ${result.statusText}`;
  const haystack = [method, url, statusLabel, entry.requestName, entry.collectionName ?? '']
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalized);
}
