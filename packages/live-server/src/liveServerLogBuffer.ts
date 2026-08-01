import type { LiveServerLogEntry } from '@harborclient/core/types';

/**
 * Maximum access + script log lines retained per running live server instance.
 */
export const LIVE_SERVER_LOG_BUFFER_MAX = 1000;

/**
 * Appends a log entry to a ring buffer, dropping oldest lines past the max.
 *
 * Mutates `buffer` in place so callers can share the same array reference between
 * the Express/script callbacks and the host entry map. Accepts mixed access and
 * script lines ({@link LiveServerLogEntry}).
 *
 * @param buffer - Per-instance log buffer to mutate.
 * @param entry - Access or script log line to append.
 * @param max - Maximum retained entries; defaults to {@link LIVE_SERVER_LOG_BUFFER_MAX}.
 */
export function pushLiveServerLog(
  buffer: LiveServerLogEntry[],
  entry: LiveServerLogEntry,
  max: number = LIVE_SERVER_LOG_BUFFER_MAX
): void {
  buffer.push(entry);
  if (buffer.length > max) {
    buffer.splice(0, buffer.length - max);
  }
}
