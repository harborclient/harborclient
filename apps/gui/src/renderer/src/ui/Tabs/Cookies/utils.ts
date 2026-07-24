/**
 * Returns whether cookie rows contain a persisted name/value pair.
 *
 * @param rows - Cookie rows from the key/value editor.
 * @returns True when at least one row has a key or value.
 */
export function hasPersistedCookieRows(rows: { key: string; value: string }[]): boolean {
  return rows.some((row) => row.key.trim() || row.value.trim());
}
