import type { McpClientHeader } from '#/shared/types';

/**
 * Example JSON shown in the MCP client import modal placeholder.
 */
export const MCP_CLIENT_SERVER_IMPORT_PLACEHOLDER = `"exa": {
  "url": "https://mcp.exa.ai/mcp",
  "headers": {
    "x-api-key": "your-api-key-here"
  }
}`;

interface ParsedMcpClientServerImport {
  name: string;
  url: string;
  headers: McpClientHeader[];
}

/**
 * Attempts to parse pasted MCP client config text as JSON using common wrappers.
 *
 * @param text - Raw pasted text from the import modal.
 */
function parseImportJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new SyntaxError('Empty import text.');
  }

  const attempts = [trimmed, `{${trimmed}}`, `{"mcpServers":{${trimmed}}}`];
  let lastError: unknown;

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new SyntaxError('Invalid JSON.');
}

/**
 * Returns whether a value looks like one MCP server config entry.
 *
 * @param value - Candidate server config object.
 */
function isMcpServerConfigEntry(value: unknown): value is { url: string; headers?: unknown } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as { url?: unknown };
  return typeof record.url === 'string' && record.url.trim().length > 0;
}

/**
 * Collects MCP server entries from a parsed import root object.
 *
 * @param root - Parsed JSON root value.
 */
function collectMcpServerEntries(
  root: unknown
): Array<[string, { url: string; headers?: unknown }]> {
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return [];
  }

  const record = root as Record<string, unknown>;
  if (
    record.mcpServers &&
    typeof record.mcpServers === 'object' &&
    !Array.isArray(record.mcpServers)
  ) {
    const entries: Array<[string, { url: string; headers?: unknown }]> = [];
    for (const [name, value] of Object.entries(record.mcpServers as Record<string, unknown>)) {
      if (isMcpServerConfigEntry(value)) {
        entries.push([name, value]);
      }
    }
    return entries;
  }

  const entries: Array<[string, { url: string; headers?: unknown }]> = [];
  for (const [name, value] of Object.entries(record)) {
    if (isMcpServerConfigEntry(value)) {
      entries.push([name, value]);
    }
  }
  return entries;
}

/**
 * Converts Cursor-style headers object into internal MCP client header rows.
 *
 * @param headers - Headers object from an imported MCP server entry.
 */
function parseImportedHeaders(
  headers: unknown
): { ok: true; headers: McpClientHeader[] } | { ok: false; error: string } {
  if (headers == null) {
    return { ok: true, headers: [] };
  }

  if (typeof headers !== 'object' || Array.isArray(headers)) {
    return { ok: false, error: 'Imported headers must be a JSON object.' };
  }

  const rows: McpClientHeader[] = [];
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      return { ok: false, error: `Imported header "${key}" must have a string value.` };
    }
    rows.push({ key, value });
  }

  return { ok: true, headers: rows };
}

/**
 * Parses a pasted Cursor / Claude Desktop MCP server config snippet.
 *
 * @param text - Raw pasted text from the import modal.
 */
export function parseMcpClientServerImportSnippet(
  text: string
): { ok: true; result: ParsedMcpClientServerImport } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = parseImportJson(text);
  } catch {
    return { ok: false, error: 'Import text must be valid JSON.' };
  }

  const entries = collectMcpServerEntries(parsed);
  if (entries.length === 0) {
    return { ok: false, error: 'No MCP server entry found in the pasted JSON.' };
  }

  if (entries.length > 1) {
    return { ok: false, error: 'Paste one MCP server entry at a time.' };
  }

  const [name, entry] = entries[0]!;
  const headersResult = parseImportedHeaders(entry.headers);
  if (!headersResult.ok) {
    return headersResult;
  }

  return {
    ok: true,
    result: {
      name,
      url: entry.url.trim(),
      headers: headersResult.headers
    }
  };
}
