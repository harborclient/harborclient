import { useEffect, useMemo, useRef, useState, type JSX, type UIEvent } from 'react';
import type { SseEvent } from '@harborclient/core/types';
import {
  EmptySectionLabel,
  Table,
  TableBody,
  TableHead,
  TableHeader
} from '@harborclient/sdk/components';
import {
  DEFAULT_LOG_MATCH_OPTIONS,
  matchesLogText,
  type LogMatchOptions
} from '#/renderer/src/ui/Shared/LogSearch/logMatchOptions';
import { SseEventDetail } from './SseEventDetail';
import { SseEventFilters } from './SseEventFilters';
import { SseEventRow } from './SseEventRow';

/**
 * Distance from the bottom (px) within which new events keep auto-scrolling.
 */
const AUTO_SCROLL_THRESHOLD_PX = 48;

/**
 * Debounce window before applying the filter query to event rows.
 */
const FILTER_DEBOUNCE_MS = 150;

interface Props {
  /**
   * Retained SSE events for the current session.
   */
  events: SseEvent[];
}

/**
 * Returns whether an SSE event matches the active log filter.
 *
 * @param event - Candidate event.
 * @param query - Debounced filter query.
 * @param options - Match toggles.
 * @returns True when the event should remain visible.
 */
function matchesSseEvent(event: SseEvent, query: string, options: LogMatchOptions): boolean {
  if (!query.trim()) {
    return true;
  }
  const haystack = [event.type, event.id ?? '', event.data, event.raw].join('\n');
  return matchesLogText(haystack, query, options);
}

/**
 * SSE Events tab: filterable, auto-scrolling event table with a detail modal.
 *
 * @param props - Session events to display.
 * @returns Events viewer with pause and filter controls.
 */
export function Events({ events }: Props): JSX.Element {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [matchOptions, setMatchOptions] = useState<LogMatchOptions>(DEFAULT_LOG_MATCH_OPTIONS);
  const [paused, setPaused] = useState(false);
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  /**
   * Increments only on table-row selection so the detail modal can exit Diff
   * mode for direct picks without clearing Diff when stepping Previous/Next.
   */
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [stickToBottom, setStickToBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

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
   * Events that match the debounced filter query.
   */
  const filteredEvents = useMemo(
    () => events.filter((event) => matchesSseEvent(event, debouncedQuery, matchOptions)),
    [debouncedQuery, events, matchOptions]
  );

  /**
   * Latest filtered list for navigation handlers so prev/next never read a stale
   * closure after the modal stays open across renders.
   */
  const filteredEventsRef = useRef(filteredEvents);

  /**
   * Keeps the navigation ref aligned with the latest filtered event list.
   */
  useEffect(() => {
    filteredEventsRef.current = filteredEvents;
  }, [filteredEvents]);

  /**
   * Currently selected event from the filtered list, when any.
   */
  const selectedEvent = useMemo(
    () => filteredEvents.find((event) => event.seq === selectedSeq) ?? null,
    [filteredEvents, selectedSeq]
  );

  /**
   * Position of the selected event in the filtered list so modal navigation
   * follows the same order the table is showing.
   */
  const selectedIndex = useMemo(
    () => filteredEvents.findIndex((event) => event.seq === selectedSeq),
    [filteredEvents, selectedSeq]
  );

  /**
   * Auto-scrolls to the bottom when new events arrive and the user has not scrolled away.
   */
  useEffect(() => {
    const node = scrollRef.current;
    if (!node || paused || !stickToBottom) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [filteredEvents.length, paused, stickToBottom]);

  /**
   * Tracks whether the user is near the bottom so new events can auto-scroll.
   *
   * @param event - Scroll event from the events list container.
   */
  const handleScroll = (event: UIEvent<HTMLDivElement>): void => {
    const node = event.currentTarget;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    setStickToBottom(distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX);
  };

  /**
   * Opens the event detail modal for the activated row and bumps the selection
   * revision so Diff mode resets on direct picks.
   *
   * @param event - Event the user activated.
   */
  const handleSelect = (event: SseEvent): void => {
    setSelectionRevision((revision) => revision + 1);
    setSelectedSeq(event.seq);
  };

  /**
   * Closes the event detail modal.
   */
  const handleCloseDetail = (): void => {
    setSelectedSeq(null);
  };

  /**
   * Selects the previous filtered event when modal navigation is available.
   */
  const handlePreviousDetail = (): void => {
    setSelectedSeq((current) => {
      if (current == null) {
        return current;
      }
      const list = filteredEventsRef.current;
      const index = list.findIndex((event) => event.seq === current);
      if (index <= 0) {
        return current;
      }
      return list[index - 1]?.seq ?? current;
    });
  };

  /**
   * Selects the next filtered event when modal navigation is available.
   */
  const handleNextDetail = (): void => {
    setSelectedSeq((current) => {
      if (current == null) {
        return current;
      }
      const list = filteredEventsRef.current;
      const index = list.findIndex((event) => event.seq === current);
      if (index < 0 || index >= list.length - 1) {
        return current;
      }
      return list[index + 1]?.seq ?? current;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SseEventFilters
        query={query}
        onQueryChange={setQuery}
        matchOptions={matchOptions}
        onMatchOptionsChange={setMatchOptions}
        paused={paused}
        onPausedChange={setPaused}
      />
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="SSE events"
        className="min-h-0 flex-1 overflow-auto rounded-md border border-separator"
        onScroll={handleScroll}
      >
        {filteredEvents.length === 0 ? (
          <EmptySectionLabel label={events.length === 0 ? 'No events yet' : 'No matching events'} />
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <TableHead className="w-14 text-center">#</TableHead>
                <TableHead className="w-28">Time</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-28">Id</TableHead>
                <TableHead>Data</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((event) => (
                <SseEventRow
                  key={event.seq}
                  event={event}
                  selected={event.seq === selectedSeq}
                  onSelect={handleSelect}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      {selectedEvent != null ? (
        <SseEventDetail
          event={selectedEvent}
          previousEvent={selectedIndex > 0 ? (filteredEvents[selectedIndex - 1] ?? null) : null}
          nextEvent={
            selectedIndex >= 0 && selectedIndex < filteredEvents.length - 1
              ? (filteredEvents[selectedIndex + 1] ?? null)
              : null
          }
          selectionRevision={selectionRevision}
          canGoPrevious={selectedIndex > 0}
          canGoNext={selectedIndex >= 0 && selectedIndex < filteredEvents.length - 1}
          onPrevious={handlePreviousDetail}
          onNext={handleNextDetail}
          onClose={handleCloseDetail}
        />
      ) : null}
    </div>
  );
}
