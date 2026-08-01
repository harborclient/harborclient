import type { ScriptLogEntry, ScriptRunError } from '@harborclient/core/types';
import {
  DEFAULT_LOG_MATCH_OPTIONS,
  matchesLogText,
  type LogMatchOptions
} from '#/renderer/src/ui/Shared/LogSearch/logMatchOptions';

/**
 * Builds the searchable haystack for a script console log row.
 *
 * @param entry - Script log entry shown in the Logs tab.
 * @returns Visible fields joined for substring / regex matching.
 */
export function scriptLogEntryHaystack(entry: ScriptLogEntry): string {
  return `${entry.level} ${entry.scriptName} ${entry.message}`;
}

/**
 * Builds the searchable haystack for a structured script error row.
 *
 * @param error - Structured script failure shown in the Logs tab.
 * @returns Visible fields joined for substring / regex matching.
 */
export function scriptRunErrorHaystack(error: ScriptRunError): string {
  return `${error.scriptName ?? ''} ${error.message}`;
}

/**
 * Returns whether a script log entry matches the filter query.
 *
 * @param entry - Script console log entry to test.
 * @param query - Raw search text; empty or whitespace-only matches everything.
 * @param options - Case, whole-word, and regex toggles.
 * @returns True when the entry should remain visible.
 */
export function matchesScriptLogEntry(
  entry: ScriptLogEntry,
  query: string,
  options: LogMatchOptions = DEFAULT_LOG_MATCH_OPTIONS
): boolean {
  return matchesLogText(scriptLogEntryHaystack(entry), query, options);
}

/**
 * Returns whether a structured script error matches the filter query.
 *
 * @param error - Structured script failure to test.
 * @param query - Raw search text; empty or whitespace-only matches everything.
 * @param options - Case, whole-word, and regex toggles.
 * @returns True when the error should remain visible.
 */
export function matchesScriptRunError(
  error: ScriptRunError,
  query: string,
  options: LogMatchOptions = DEFAULT_LOG_MATCH_OPTIONS
): boolean {
  return matchesLogText(scriptRunErrorHaystack(error), query, options);
}
