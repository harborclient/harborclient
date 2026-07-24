import type { McpClientHeader } from '#/shared/types';

/**
 * Example JSON shown in the MCP client headers textarea when empty.
 */
export const MCP_CLIENT_HEADERS_PLACEHOLDER = `[
  { "Cache-Control": "revalidate" }
]`;

/**
 * Serializes persisted MCP client headers for editing in the modal textarea.
 *
 * Each header is rendered as a single-key object: `{ "Header-Name": "value" }`.
 *
 * @param headers - Saved header rows from settings.
 */
export function formatMcpClientHeadersDraft(headers: McpClientHeader[]): string {
  if (headers.length === 0) {
    return '[]';
  }

  return JSON.stringify(
    headers.map((header) => ({ [header.key]: header.value })),
    null,
    2
  );
}

/**
 * Parses one header row in legacy `{ key, value }` format.
 *
 * @param record - Parsed JSON object from one array element.
 */
function parseLegacyHeaderRow(record: Record<string, unknown>): McpClientHeader | null {
  if (!('key' in record) || !('value' in record)) {
    return null;
  }

  if (typeof record.key !== 'string' || typeof record.value !== 'string') {
    return null;
  }

  return { key: record.key, value: record.value };
}

/**
 * Parses one header row in single-key-object format: `{ "Header-Name": "value" }`.
 *
 * @param record - Parsed JSON object from one array element.
 * @param index - Zero-based row index for error messages.
 */
function parseSingleKeyHeaderRow(
  record: Record<string, unknown>,
  index: number
): { ok: true; header: McpClientHeader } | { ok: false; error: string } {
  const keys = Object.keys(record);
  if (keys.length !== 1) {
    return {
      ok: false,
      error: `Header row ${index + 1} must be an object with exactly one header name as its key.`
    };
  }

  const key = keys[0]!;
  const value = record[key];
  if (typeof value !== 'string') {
    return {
      ok: false,
      error: `Header row ${index + 1} must have a string value for "${key}".`
    };
  }

  return { ok: true, header: { key, value } };
}

/**
 * Parses the MCP client headers textarea draft on save.
 *
 * @param draft - Raw JSON text from the modal textarea.
 */
export function parseMcpClientHeadersDraft(
  draft: string
): { ok: true; headers: McpClientHeader[] } | { ok: false; error: string } {
  const trimmed = draft.trim();
  if (!trimmed) {
    return { ok: true, headers: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'Headers must be valid JSON.' };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'Headers must be a JSON array.' };
  }

  const headers: McpClientHeader[] = [];
  for (const [index, item] of parsed.entries()) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return {
        ok: false,
        error: `Header row ${index + 1} must be a JSON object.`
      };
    }

    const record = item as Record<string, unknown>;
    const legacyHeader = parseLegacyHeaderRow(record);
    if (legacyHeader) {
      headers.push(legacyHeader);
      continue;
    }

    const singleKeyResult = parseSingleKeyHeaderRow(record, index);
    if (!singleKeyResult.ok) {
      return singleKeyResult;
    }

    headers.push(singleKeyResult.header);
  }

  return { ok: true, headers };
}
