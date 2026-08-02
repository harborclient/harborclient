import { useEffect, useMemo, useState } from 'react';
import type { McpServerLogEntry } from '@harborclient/core/types';
import {
  DEFAULT_LOG_MATCH_OPTIONS,
  isLogFilterQueryValid,
  matchesLogText,
  type LogMatchOptions
} from '#/renderer/src/ui/Shared/LogSearch/logMatchOptions';
import { formatMcpLogLine } from './formatMcpLogLine';
import type { McpLogTerminalRow } from './McpLogTerminal';

/**
 * Debounce window before applying the filter query to terminal lines.
 */
const FILTER_DEBOUNCE_MS = 150;

interface Options {
  /**
   * When true, hydrates and streams MCP server logs for the footer viewer.
   */
  active: boolean;

  /**
   * Whether Keep logs is enabled in the current settings form.
   */
  keepLogs: boolean;
}

/**
 * Returns whether a formatted MCP log line matches the active filter.
 *
 * @param entry - Sanitized MCP server log entry.
 * @param query - Debounced filter query.
 * @param options - Case / word / regex toggles.
 */
function matchesMcpLogEntry(
  entry: McpServerLogEntry,
  query: string,
  options: LogMatchOptions
): boolean {
  return matchesLogText(formatMcpLogLine(entry), query, options);
}

/**
 * MCP server logs viewer state for the footer panel body.
 *
 * Hydrates persisted LocalDatabase rows, streams push events, and derives
 * filtered terminal rows for {@link McpLogsView}.
 *
 * @param options - Whether the logs view is active and Keep logs is enabled.
 */
export function useMcpLogsController(options: Options): {
  query: string;
  setQuery: (value: string) => void;
  matchOptions: LogMatchOptions;
  setMatchOptions: (value: LogMatchOptions) => void;
  invalidRegex: boolean;
  filterActive: boolean;
  filteredRows: McpLogTerminalRow[];
  hiddenCount: number;
  keepLogs: boolean;
} {
  const { active, keepLogs } = options;
  const [entries, setEntries] = useState<McpServerLogEntry[]>([]);
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
   * Rows that match the debounced filter, keeping original 1-based line numbers.
   */
  const filteredRows = useMemo((): McpLogTerminalRow[] => {
    const rows: McpLogTerminalRow[] = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry == null) {
        continue;
      }
      if (!matchesMcpLogEntry(entry, debouncedQuery, matchOptions)) {
        continue;
      }
      rows.push({ entry, line: index + 1 });
    }
    return rows;
  }, [debouncedQuery, entries, matchOptions]);

  /**
   * Count of buffer lines hidden by the active filter.
   */
  const hiddenCount = filterActive ? entries.length - filteredRows.length : 0;

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
   * Hydrates persisted MCP server logs when the logs view becomes active.
   */
  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;

    /**
     * Loads the current LocalDatabase snapshot oldest-first.
     */
    const hydrate = async (): Promise<void> => {
      try {
        const logs = await window.api.getMcpServerLogs();
        if (!cancelled) {
          setEntries(logs);
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [active]);

  /**
   * Subscribes to newly appended MCP server log pushes while the logs view is open.
   */
  useEffect(() => {
    if (!active) {
      return;
    }

    /**
     * Appends one pushed log entry, replacing any prior row with the same id.
     *
     * @param entry - Sanitized log line from the main process.
     */
    const handleLog = (entry: McpServerLogEntry): void => {
      setEntries((current) => {
        if (current.some((row) => row.id === entry.id)) {
          return current;
        }
        return [...current, entry];
      });
    };

    return window.api.onMcpServerLog(handleLog);
  }, [active]);

  return {
    query,
    setQuery,
    matchOptions,
    setMatchOptions,
    invalidRegex,
    filterActive,
    filteredRows,
    hiddenCount,
    keepLogs
  };
}
