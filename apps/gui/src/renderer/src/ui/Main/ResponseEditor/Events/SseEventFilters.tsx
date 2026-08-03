import type { JSX } from 'react';
import type { SseEvent } from '@harborclient/core/types';
import { LogSearchInput } from '#/renderer/src/ui/Shared/LogSearch/LogSearchInput';
import {
  isLogFilterQueryValid,
  type LogMatchOptions
} from '#/renderer/src/ui/Shared/LogSearch/logMatchOptions';

interface Props {
  /**
   * Current filter query text.
   */
  query: string;

  /**
   * Called when the filter query changes.
   */
  onQueryChange: (query: string) => void;

  /**
   * Case / whole-word / regex match toggles.
   */
  matchOptions: LogMatchOptions;

  /**
   * Called when match toggles change.
   */
  onMatchOptionsChange: (options: LogMatchOptions) => void;

  /**
   * Whether auto-scroll following is paused.
   */
  paused: boolean;

  /**
   * Toggles the pause state.
   */
  onPausedChange: (paused: boolean) => void;

  /**
   * Currently selected event, when any (reserved for future filter hints).
   */
  selectedEvent?: SseEvent | null;
}

/**
 * Filter row and pause toggle for the SSE Events viewer.
 *
 * @param props - Filter state and pause flag.
 * @returns Search controls above the events table.
 */
export function SseEventFilters({
  query,
  onQueryChange,
  matchOptions,
  onMatchOptionsChange,
  paused,
  onPausedChange
}: Props): JSX.Element {
  /**
   * Whether the live query is an invalid regex while regex mode is on.
   */
  const invalidRegex = !isLogFilterQueryValid(query, matchOptions);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1">
        <LogSearchInput
          id="sse-events-filter"
          label="Filter SSE events"
          value={query}
          onChange={onQueryChange}
          options={matchOptions}
          onOptionsChange={onMatchOptionsChange}
          invalidRegex={invalidRegex}
          placeholder="Filter events"
        />
      </div>
      <button
        type="button"
        className="shrink-0 rounded-md border border-separator bg-surface px-2 py-1 text-[14px] text-text hover:bg-selection focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-pressed={paused}
        aria-label={paused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
        onClick={() => onPausedChange(!paused)}
      >
        {paused ? 'Resume' : 'Pause'}
      </button>
    </div>
  );
}
