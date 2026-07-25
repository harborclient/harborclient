import type { KeyValue } from './types.js';

/**
 * Returns a blank urlencoded row with enabled set to true.
 */
export function emptyUrlEncodedPart(): KeyValue {
  return { key: '', value: '', enabled: true };
}

/**
 * Coerces a partial or legacy key-value record to the full KeyValue shape.
 *
 * @param row - Raw row fields from storage or import.
 * @returns Normalized key-value row with defaults for missing fields.
 */
export function normalizeUrlEncodedPart(row: Partial<KeyValue>): KeyValue {
  return {
    key: typeof row.key === 'string' ? row.key : '',
    value: typeof row.value === 'string' ? row.value : '',
    enabled: row.enabled !== false
  };
}

/**
 * Parses a serialized urlencoded body string into key-value rows.
 *
 * @param body - JSON array stored in the request body field.
 * @returns Parsed rows, or an empty array when body is empty or invalid.
 */
export function parseUrlEncodedParts(body: string): KeyValue[] {
  const trimmed = body.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((row) => normalizeUrlEncodedPart(row as Partial<KeyValue>));
  } catch {
    return [];
  }
}

/**
 * Serializes urlencoded rows for storage in the request body field.
 *
 * @param rows - Key-value rows to serialize.
 * @returns JSON string, or an empty string when there are no rows.
 */
export function serializeUrlEncodedParts(rows: KeyValue[]): string {
  if (rows.length === 0) {
    return '';
  }
  return JSON.stringify(rows.map((row) => normalizeUrlEncodedPart(row)));
}
