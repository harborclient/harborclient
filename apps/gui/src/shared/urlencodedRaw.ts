import type { KeyValue } from '#/shared/types/common';

/**
 * Builds an application/x-www-form-urlencoded wire string from enabled key-value rows.
 *
 * Mirrors {@link Body.buildUrlEncoded} so the Raw body drawer shows the same encoding
 * the structured editor would send when no raw override is active.
 *
 * @param rows - Key-value rows from the form-urlencoded editor.
 * @returns Encoded `k=v&k2=v2` string for enabled rows with a non-empty key.
 */
export function rowsToRawUrlEncoded(rows: KeyValue[]): string {
  const params = new URLSearchParams();
  for (const row of rows) {
    if (!row.enabled || !row.key.trim()) {
      continue;
    }
    params.append(row.key.trim(), row.value);
  }
  return params.toString();
}

/**
 * Tolerantly parses a raw urlencoded body into key-value rows for the table preview.
 *
 * Never throws. Splits on `&` and takes the first `=` in each segment so unusual or
 * intentionally invalid fragments (missing values, bare keys, trailing `&`) remain
 * visible in the structured editor. All returned rows are enabled.
 *
 * @param text - Verbatim urlencoded body text from the Raw editor.
 * @returns Best-effort key-value rows; empty when `text` is blank.
 */
export function rawUrlEncodedToRows(text: string): KeyValue[] {
  if (!text) {
    return [];
  }

  const rows: KeyValue[] = [];
  for (const segment of text.split('&')) {
    if (segment === '') {
      continue;
    }

    const equalsIndex = segment.indexOf('=');
    const rawKey = equalsIndex === -1 ? segment : segment.slice(0, equalsIndex);
    const rawValue = equalsIndex === -1 ? '' : segment.slice(equalsIndex + 1);

    let key = rawKey;
    let value = rawValue;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    } catch {
      key = rawKey;
    }
    try {
      value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      value = rawValue;
    }

    rows.push({ key, value, enabled: true });
  }

  return rows;
}
