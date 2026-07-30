import type { LiveServerRequestLogEntry } from '@harborclient/core/types';

/**
 * Maximum access-log lines retained per running live server instance.
 */
export const LIVE_SERVER_LOG_BUFFER_MAX = 1000;

/**
 * Appends an access-log entry to a ring buffer, dropping oldest lines past the max.
 *
 * Mutates `buffer` in place so callers can share the same array reference between
 * the Express callback and the host entry map.
 *
 * @param buffer - Per-instance log buffer to mutate.
 * @param entry - Completed request log line to append.
 * @param max - Maximum retained entries; defaults to {@link LIVE_SERVER_LOG_BUFFER_MAX}.
 */
export function pushLiveServerLog(
  buffer: LiveServerRequestLogEntry[],
  entry: LiveServerRequestLogEntry,
  max: number = LIVE_SERVER_LOG_BUFFER_MAX
): void {
  buffer.push(entry);
  if (buffer.length > max) {
    buffer.splice(0, buffer.length - max);
  }
}
