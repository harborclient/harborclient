import type { KeyValue, LiveServerResponseHeader } from '@harborclient/core/types';

/**
 * Converts persisted live-server header rows into {@link KeyValue} rows for
 * {@link KeyValueEditor}, always ending with a blank row for inline add.
 *
 * @param headers - Normalized response headers from modal/saved state.
 * @returns Editor rows with a trailing empty row.
 */
export function liveServerHeadersToKeyValueRows(headers: LiveServerResponseHeader[]): KeyValue[] {
  const rows: KeyValue[] = headers.map((header) => ({
    key: header.name,
    value: header.value,
    enabled: header.enabled !== false
  }));
  const last = rows[rows.length - 1];
  if (last == null || last.key.trim() !== '') {
    rows.push({ key: '', value: '', enabled: true });
  }
  return rows;
}

/**
 * Converts {@link KeyValueEditor} rows back to live-server header shape.
 *
 * Keeps empty-name rows so the editor can retain a trailing blank line while
 * the user types; call {@link filterLiveServerHeadersForSave} before persist.
 *
 * @param rows - Key/value rows from the editor.
 * @returns Header rows using `name` instead of `key`.
 */
export function keyValueRowsToLiveServerHeaders(rows: KeyValue[]): LiveServerResponseHeader[] {
  return rows.map((row) => ({
    name: row.key,
    value: row.value,
    enabled: row.enabled !== false
  }));
}

/**
 * Drops header rows with an empty name before save/start.
 *
 * Disabled rows with a name are kept so users can re-enable them later; the
 * Express runtime already skips `enabled === false`.
 *
 * @param headers - Editor or modal header rows.
 * @returns Headers with non-empty trimmed names only.
 */
export function filterLiveServerHeadersForSave(
  headers: LiveServerResponseHeader[]
): LiveServerResponseHeader[] {
  return headers
    .map((header) => ({
      name: header.name.trim(),
      value: header.value,
      enabled: header.enabled !== false
    }))
    .filter((header) => header.name.length > 0);
}
