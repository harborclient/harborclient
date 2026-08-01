import type { LiveServerLogEntry } from '@harborclient/core/types';
import {
  DEFAULT_LOG_MATCH_OPTIONS,
  isLogFilterQueryValid,
  matchesLogText,
  type LogMatchOptions
} from '#/renderer/src/ui/Shared/LogSearch/logMatchOptions';
import { formatLiveServerLogLine } from './formatLiveServerLogLine';

/**
 * Match-mode toggles for the live-server logs filter (alias of {@link LogMatchOptions}).
 */
export type LiveServerLogMatchOptions = LogMatchOptions;

/**
 * Default filter options: case-insensitive substring match.
 */
export const DEFAULT_LIVE_SERVER_LOG_MATCH_OPTIONS = DEFAULT_LOG_MATCH_OPTIONS;

/**
 * Returns whether a non-empty regex filter query compiles successfully.
 *
 * @param query - Raw filter text.
 * @param options - Match toggles.
 * @returns False when regex mode is on and the pattern is invalid.
 */
export function isLiveServerLogFilterQueryValid(query: string, options: LogMatchOptions): boolean {
  return isLogFilterQueryValid(query, options);
}

/**
 * Returns whether a live-server log entry matches the filter query against the
 * formatted terminal line the user sees.
 *
 * @param entry - Access, script, or process log entry to test.
 * @param query - Raw search text; empty or whitespace-only matches everything.
 * @param options - Case, whole-word, and regex toggles (defaults: all off).
 * @returns True when the entry should remain visible for the query.
 */
export function matchesLiveServerLogEntry(
  entry: LiveServerLogEntry,
  query: string,
  options: LogMatchOptions = DEFAULT_LOG_MATCH_OPTIONS
): boolean {
  return matchesLogText(formatLiveServerLogLine(entry), query, options);
}
