import { useEffect, useMemo, useState, type JSX } from 'react';
import type { ScriptLogEntry, ScriptRunError } from '@harborclient/core/types';
import { ScriptLogsView } from '#/renderer/src/ui/Shared/ConsoleDetails/ScriptLogsView';
import { LogSearchInput } from '#/renderer/src/ui/Shared/LogSearch/LogSearchInput';
import {
  DEFAULT_LOG_MATCH_OPTIONS,
  isLogFilterQueryValid,
  matchesLogText,
  type LogMatchOptions
} from '#/renderer/src/ui/Shared/LogSearch/logMatchOptions';
import { matchesScriptLogEntry, matchesScriptRunError } from './matchesScriptLogEntry';

/**
 * Debounce window before applying the filter query to request log rows.
 */
const FILTER_DEBOUNCE_MS = 150;

interface Props {
  /**
   * Console output captured from scripts for the last send.
   */
  scriptLogs: ScriptLogEntry[];

  /**
   * Aggregated script runtime errors from the last send.
   */
  scriptError?: string;

  /**
   * Structured script failures with slot metadata and mapped locations.
   */
  scriptErrors?: ScriptRunError[];

  /**
   * Request tab that produced these results; preferred for jump-to-editor.
   */
  requestTabId?: string;
}

/**
 * Response viewer Logs tab: DevTools-style script console output and errors
 * with a debounced filter (case / whole-word / regex toggles).
 *
 * @param props - Script logs, errors, and optional request tab id.
 * @returns Filter row plus filtered script log list.
 */
export function Logs({ scriptLogs, scriptError, scriptErrors, requestTabId }: Props): JSX.Element {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [matchOptions, setMatchOptions] = useState<LogMatchOptions>(DEFAULT_LOG_MATCH_OPTIONS);

  /**
   * Whether a non-empty filter is active after debounce.
   */
  const filterActive = debouncedQuery.trim().length > 0;

  /**
   * Whether the live (undebounced) query is an invalid regex while regex mode is on.
   */
  const invalidRegex = !isLogFilterQueryValid(query, matchOptions);

  /**
   * Debounces the filter query so typing does not refilter on every keystroke.
   */
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, FILTER_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(handle);
    };
  }, [query]);

  /**
   * Script console rows that match the debounced filter.
   */
  const filteredLogs = useMemo(
    () => scriptLogs.filter((entry) => matchesScriptLogEntry(entry, debouncedQuery, matchOptions)),
    [debouncedQuery, matchOptions, scriptLogs]
  );

  /**
   * Structured errors that match the debounced filter.
   */
  const filteredScriptErrors = useMemo(() => {
    if (scriptErrors == null) {
      return undefined;
    }
    return scriptErrors.filter((error) =>
      matchesScriptRunError(error, debouncedQuery, matchOptions)
    );
  }, [debouncedQuery, matchOptions, scriptErrors]);

  /**
   * Legacy aggregated error string when it matches the filter.
   * Omitted when structured errors are present (same precedence as {@link ScriptLogsView}).
   */
  const filteredScriptError = useMemo(() => {
    if (scriptErrors != null && scriptErrors.length > 0) {
      return undefined;
    }
    if (scriptError == null || scriptError === '') {
      return undefined;
    }
    return matchesLogText(scriptError, debouncedQuery, matchOptions) ? scriptError : undefined;
  }, [debouncedQuery, matchOptions, scriptError, scriptErrors]);

  /**
   * Whether any filtered output remains visible.
   */
  const hasFilteredOutput =
    filteredLogs.length > 0 ||
    (filteredScriptErrors != null && filteredScriptErrors.length > 0) ||
    Boolean(filteredScriptError);

  /**
   * Whether the unfiltered tab had any logs/errors at all.
   */
  const hasAnyOutput =
    scriptLogs.length > 0 ||
    Boolean(scriptError) ||
    (scriptErrors != null && scriptErrors.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 pb-3 pt-2.5">
        <LogSearchInput
          id="response-logs-search"
          label="Filter request logs"
          value={query}
          onChange={setQuery}
          options={matchOptions}
          onOptionsChange={setMatchOptions}
          invalidRegex={invalidRegex}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {filterActive && hasAnyOutput && !hasFilteredOutput ? (
          <div className="px-2.5 py-2 text-center text-[14px] text-muted" role="status">
            No matching logs.
          </div>
        ) : (
          <ScriptLogsView
            logs={filteredLogs}
            scriptError={filteredScriptError}
            scriptErrors={filteredScriptErrors}
            requestTabId={requestTabId}
          />
        )}
      </div>
    </div>
  );
}
