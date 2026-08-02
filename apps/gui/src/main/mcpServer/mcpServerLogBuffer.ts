import { BrowserWindow } from 'electron';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { getMcpServerSettings } from '#/main/settings/mcpSettings';
import type { McpServerLogEntry, McpServerLogInput } from '@harborclient/core/types';

/**
 * Patterns that may appear in error strings and must never be persisted.
 */
const SENSITIVE_FRAGMENT =
  /\b(bearer\s+[a-z0-9._\-+=/]+|authorization\s*[:=]\s*\S+|token\s*[:=]\s*\S+)/gi;

/**
 * Maximum length retained for sanitized error messages.
 */
const MAX_ERROR_LENGTH = 200;

/**
 * Redacts token-like fragments and truncates error text before persistence.
 *
 * @param error - Raw error message that may contain secrets.
 * @returns Sanitized error text, or undefined when empty after redaction.
 */
export function sanitizeMcpServerLogError(error: string | undefined): string | undefined {
  if (error == null) {
    return undefined;
  }
  const redacted = error.replace(SENSITIVE_FRAGMENT, '[redacted]').trim();
  if (!redacted) {
    return undefined;
  }
  if (redacted.length <= MAX_ERROR_LENGTH) {
    return redacted;
  }
  return `${redacted.slice(0, MAX_ERROR_LENGTH)}…`;
}

/**
 * Extracts a JSON-RPC method name from an MCP request body without reading params.
 *
 * @param body - Parsed Express JSON body.
 * @returns Method string when present, otherwise undefined.
 */
export function readMcpJsonRpcMethod(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }
  const method = (body as { method?: unknown }).method;
  return typeof method === 'string' && method.trim().length > 0 ? method.trim() : undefined;
}

/**
 * Broadcasts a persisted MCP server log entry to all renderer windows.
 *
 * @param entry - Inserted log row including its assigned id.
 */
function broadcastMcpServerLog(entry: McpServerLogEntry): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('mcp:serverLog', entry);
    }
  }
}

/**
 * Appends a sanitized MCP server log entry when Keep logs is enabled.
 *
 * No-ops when `keepLogs` is false. Never accepts Authorization headers, bearer
 * tokens, JSON-RPC params/results, or tool argument/result bodies — callers must
 * only pass metadata fields on {@link McpServerLogInput}.
 *
 * @param input - Safe metadata fields for one log line.
 * @returns The inserted row, or null when logging is disabled or persistence fails.
 */
export function appendMcpServerLog(input: McpServerLogInput): McpServerLogEntry | null {
  if (!getMcpServerSettings().keepLogs) {
    return null;
  }

  const sanitized: McpServerLogInput = {
    ...input,
    ...(input.error != null ? { error: sanitizeMcpServerLogError(input.error) } : {})
  };
  if (sanitized.error === undefined) {
    delete sanitized.error;
  }

  try {
    const entry = getLocalDatabase().appendMcpServerLog(sanitized);
    broadcastMcpServerLog(entry);
    return entry;
  } catch {
    return null;
  }
}

/**
 * Lists persisted MCP server logs oldest-first for the footer viewer.
 *
 * @returns Sanitized log rows from LocalDatabase.
 */
export function listMcpServerLogs(): McpServerLogEntry[] {
  try {
    return getLocalDatabase().listMcpServerLogs();
  } catch {
    return [];
  }
}
