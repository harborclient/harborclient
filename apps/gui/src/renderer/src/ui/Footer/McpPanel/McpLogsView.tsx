import type { JSX } from 'react';
import { LogSearchInput } from '#/renderer/src/ui/Shared/LogSearch/LogSearchInput';
import type { LogMatchOptions } from '#/renderer/src/ui/Shared/LogSearch/logMatchOptions';
import { McpLogTerminal, type McpLogTerminalRow } from './McpLogTerminal';

interface Props {
  /**
   * Live filter query text.
   */
  query: string;

  /**
   * Updates the live filter query.
   */
  onQueryChange: (value: string) => void;

  /**
   * Case / word / regex match toggles.
   */
  matchOptions: LogMatchOptions;

  /**
   * Updates match toggles.
   */
  onMatchOptionsChange: (value: LogMatchOptions) => void;

  /**
   * Whether the live query is an invalid regex while regex mode is on.
   */
  invalidRegex: boolean;

  /**
   * Filtered terminal rows with original 1-based line numbers.
   */
  filteredRows: McpLogTerminalRow[];

  /**
   * Whether a non-empty filter is active after debounce.
   */
  filterActive: boolean;

  /**
   * Count of buffer lines hidden by the active filter.
   */
  hiddenCount: number;

  /**
   * Whether Keep logs is currently enabled in settings.
   */
  keepLogs: boolean;
}

/**
 * Filter bar and terminal body for the MCP server logs viewer.
 *
 * @param props - Filter state and terminal rows from {@link useMcpLogsController}.
 * @returns Column with search controls and the log terminal.
 */
export function McpLogsView({
  query,
  onQueryChange,
  matchOptions,
  onMatchOptionsChange,
  invalidRegex,
  filteredRows,
  filterActive,
  hiddenCount,
  keepLogs
}: Props): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 p-3">
        <LogSearchInput
          id="footer-mcp-logs-search"
          label="Filter MCP server logs"
          value={query}
          onChange={onQueryChange}
          options={matchOptions}
          onOptionsChange={onMatchOptionsChange}
          invalidRegex={invalidRegex}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <McpLogTerminal
          rows={filteredRows}
          filterActive={filterActive}
          hiddenCount={hiddenCount}
          keepLogs={keepLogs}
        />
      </div>
    </div>
  );
}
