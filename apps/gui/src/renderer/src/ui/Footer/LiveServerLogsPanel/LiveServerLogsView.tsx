import { type JSX } from 'react';
import { LiveServerLogSearch } from './LiveServerLogSearch';
import { LiveServerLogTerminal, type LiveServerLogTerminalRow } from './LiveServerLogTerminal';
import type { LogMatchOptions } from '#/renderer/src/ui/Shared/LogSearch/logMatchOptions';

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
  filteredRows: LiveServerLogTerminalRow[];

  /**
   * Whether the selected session is still running.
   */
  isRunning: boolean;

  /**
   * Whether no log session is selected.
   */
  noServerSelected: boolean;

  /**
   * Whether a non-empty filter is active after debounce.
   */
  filterActive: boolean;

  /**
   * Count of buffer lines hidden by the active filter.
   */
  hiddenCount: number;

  /**
   * Saved live server uuid for `@logs` selection ranges, when known.
   */
  liveServerUuid: string | null;

  /**
   * Display name for the selected server.
   */
  serverName: string;
}

/**
 * Filter bar and terminal body for the live-server logs viewer.
 *
 * Shared by the footer panel and right-sidebar hosts so both render the same
 * search/stream surface without duplicating markup.
 *
 * @param props - Filter state and terminal rows from {@link useLiveServerLogsController}.
 * @returns Column with search controls and the log terminal.
 */
export function LiveServerLogsView({
  query,
  onQueryChange,
  matchOptions,
  onMatchOptionsChange,
  invalidRegex,
  filteredRows,
  isRunning,
  noServerSelected,
  filterActive,
  hiddenCount,
  liveServerUuid,
  serverName
}: Props): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <LiveServerLogSearch
        value={query}
        onChange={onQueryChange}
        options={matchOptions}
        onOptionsChange={onMatchOptionsChange}
        invalidRegex={invalidRegex}
      />
      <div className="min-h-0 flex-1">
        <LiveServerLogTerminal
          rows={filteredRows}
          isRunning={isRunning}
          noServerSelected={noServerSelected}
          filterActive={filterActive}
          hiddenCount={hiddenCount}
          liveServerUuid={liveServerUuid}
          serverName={serverName}
        />
      </div>
    </div>
  );
}
