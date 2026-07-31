import type { LiveServerRequestLogEntry } from '@harborclient/core/types';

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
export function formatLiveServerLogLine(entry: LiveServerRequestLogEntry): string {
  const time = formatLiveServerLogTimestamp(entry.timestamp);
  const length =
    entry.contentLength != null && Number.isFinite(entry.contentLength)
      ? ` ${entry.contentLength}b`
      : '';
  return `[${time}] ${entry.method} ${entry.url} ${entry.statusCode} ${entry.durationMs}ms${length}`;
}
