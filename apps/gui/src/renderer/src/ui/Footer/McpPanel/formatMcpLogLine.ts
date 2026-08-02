import type { McpServerLogEntry } from '@harborclient/core/types';

/**
 * Formats a millisecond timestamp as a local `HH:MM:SS.mmm` clock string.
 *
 * @param timestamp - Unix timestamp in milliseconds.
 * @returns Zero-padded local time with milliseconds.
 */
export function formatMcpLogTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const millis = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${millis}`;
}

/**
 * Formats one sanitized MCP server log entry as a terminal-style line.
 *
 * Examples:
 * - `[09:20:44.810] ← POST /mcp initialize 200 3ms`
 * - `[09:20:45.033] → tool get_active_request ok 12ms`
 * - `[09:20:46.000] → lifecycle started 127.0.0.1:7333`
 *
 * @param entry - Sanitized MCP server log entry.
 * @returns Display line for the MCP logs terminal.
 */
export function formatMcpLogLine(entry: McpServerLogEntry): string {
  const time = formatMcpLogTimestamp(entry.timestamp);
  const arrow = entry.direction === 'out' ? '→' : '←';

  if (entry.kind === 'tool') {
    const status =
      entry.ok == null ? '' : entry.ok ? ' ok' : ` failed${entry.error ? ` ${entry.error}` : ''}`;
    const duration = entry.durationMs != null ? ` ${entry.durationMs}ms` : '';
    return `[${time}] ${arrow} tool ${entry.toolName ?? 'unknown'}${status}${duration}`;
  }

  if (entry.kind === 'session') {
    const action = entry.rpcMethod ?? 'session';
    const session = entry.sessionId ? ` ${entry.sessionId}` : '';
    return `[${time}] ${arrow} session ${action}${session}`;
  }

  if (entry.kind === 'lifecycle') {
    const action = entry.rpcMethod ?? 'lifecycle';
    const detail = entry.path ? ` ${entry.path}` : '';
    return `[${time}] ${arrow} lifecycle ${action}${detail}`;
  }

  const method = entry.method ?? 'HTTP';
  const path = entry.path ?? '/';
  const rpc = entry.rpcMethod ? ` ${entry.rpcMethod}` : '';
  const status = entry.statusCode != null ? ` ${entry.statusCode}` : '';
  const duration = entry.durationMs != null ? ` ${entry.durationMs}ms` : '';
  const error = entry.error ? ` ${entry.error}` : '';
  return `[${time}] ${arrow} ${method} ${path}${rpc}${status}${duration}${error}`;
}
