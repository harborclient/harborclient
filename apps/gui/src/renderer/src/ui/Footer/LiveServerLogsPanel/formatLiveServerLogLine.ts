import {
  isLiveServerProcessLogEntry,
  isLiveServerScriptLogEntry,
  type LiveServerLogEntry,
  type LiveServerProcessLogEntry,
  type LiveServerRequestLogEntry,
  type LiveServerScriptLogEntry
} from '@harborclient/core/types';

/**
 * Formats a millisecond timestamp as a local `HH:MM:SS.mmm` clock string.
 *
 * @param timestamp - Unix timestamp in milliseconds.
 * @returns Zero-padded local time with milliseconds.
 */
export function formatLiveServerLogTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const millis = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${millis}`;
}

/**
 * Formats one Express access-log entry as a single terminal-style line.
 *
 * Example: `[12:34:56.789] GET /index.html 200 3ms 128b`
 *
 * @param entry - Completed request log entry from the main process.
 * @returns Display line for the logs terminal.
 */
export function formatLiveServerAccessLogLine(entry: LiveServerRequestLogEntry): string {
  const time = formatLiveServerLogTimestamp(entry.timestamp);
  const length =
    entry.contentLength != null && Number.isFinite(entry.contentLength)
      ? ` ${entry.contentLength}b`
      : '';
  return `[${time}] ${entry.method} ${entry.url} ${entry.statusCode} ${entry.durationMs}ms${length}`;
}

/**
 * Formats one live-server script console/test/error line.
 *
 * Examples:
 * - `[12:34:56.789] pre /index.html log hello`
 * - `[12:34:56.789] post /index.html ✓ status is 200`
 * - `[12:34:56.789] pre /api/* ✗ script failed`
 *
 * @param entry - Script log entry from the main process.
 * @returns Display line for the logs terminal.
 */
export function formatLiveServerScriptLogLine(entry: LiveServerScriptLogEntry): string {
  const time = formatLiveServerLogTimestamp(entry.timestamp);
  const phase = entry.phase === 'pre' ? 'pre' : 'post';
  if (entry.level === 'test') {
    const mark = entry.passed === false ? '✗' : '✓';
    return `[${time}] ${phase} ${entry.url} ${mark} ${entry.message}`;
  }
  if (entry.level === 'script-error') {
    return `[${time}] ${phase} ${entry.url} ✗ ${entry.message}`;
  }
  return `[${time}] ${phase} ${entry.url} ${entry.level} ${entry.message}`;
}

/**
 * Formats one companion run-command stdout/stderr/lifecycle line.
 *
 * Examples:
 * - `[12:34:56.789] run stdout listening on 3000`
 * - `[12:34:56.789] run stderr Error: bind EADDRINUSE`
 * - `[12:34:56.789] run Run command failed: spawn ENOENT`
 *
 * @param entry - Process log entry from the main process.
 * @returns Display line for the logs terminal.
 */
export function formatLiveServerProcessLogLine(entry: LiveServerProcessLogEntry): string {
  const time = formatLiveServerLogTimestamp(entry.timestamp);
  if (entry.stream === 'system') {
    return `[${time}] run ${entry.message}`;
  }
  return `[${time}] run ${entry.stream} ${entry.message}`;
}

/**
 * Formats one live-server log entry (access, script, or process) as a terminal line.
 *
 * @param entry - Mixed log buffer entry.
 * @returns Display line for the logs terminal.
 */
export function formatLiveServerLogLine(entry: LiveServerLogEntry): string {
  if (isLiveServerProcessLogEntry(entry)) {
    return formatLiveServerProcessLogLine(entry);
  }
  if (isLiveServerScriptLogEntry(entry)) {
    return formatLiveServerScriptLogLine(entry);
  }
  return formatLiveServerAccessLogLine(entry);
}
