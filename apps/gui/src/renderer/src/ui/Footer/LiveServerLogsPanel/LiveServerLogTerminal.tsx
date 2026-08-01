import { CopyToChatButton } from '@harborclient/sdk/components';
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { LiveServerLogEntry } from '@harborclient/core/types';
import { useCopyToChat } from '#/renderer/src/hooks/useCopyToChat';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { setLiveServerLogsSelection } from '#/renderer/src/store/slices/liveServersSlice';
import { formatLiveServerLogLine } from './formatLiveServerLogLine';
import {
  buildLiveServerLogsSelectionToken,
  captureLiveServerLogSelection,
  getLiveServerLogSelectionToolbarCoords,
  LIVE_SERVER_LOG_SELECTION_TOOLBAR_DELAY_MS
} from './captureLiveServerLogSelection';

/**
 * One filtered terminal row with its original 1-based buffer line number.
 */
export interface LiveServerLogTerminalRow {
  /**
   * Log entry to render.
   */
  entry: LiveServerLogEntry;

  /**
   * 1-based line index in the full unfiltered session buffer (for `@logs`).
   */
  line: number;
}

interface Props {
  /**
   * Filtered log rows with original 1-based buffer line numbers (oldest first).
   */
  rows: LiveServerLogTerminalRow[];

  /**
   * When true, the empty-state copy assumes the server is currently running.
   */
  isRunning: boolean;

  /**
   * When true, no saved server is selected for the panel yet.
   */
  noServerSelected: boolean;

  /**
   * When true, a non-empty filter is applied (empty list means no matches).
   */
  filterActive: boolean;

  /**
   * Number of buffer lines hidden by the active filter (0 when none hidden).
   */
  hiddenCount: number;

  /**
   * Saved live server UUID used for `@logs` chat pointers, when known.
   */
  liveServerUuid: string | null;

  /**
   * Display name of the live server for selection snapshot labels.
   */
  serverName: string;
}

/**
 * Distance from the bottom (px) within which new lines keep auto-scrolling.
 */
const AUTO_SCROLL_THRESHOLD_PX = 48;

/**
 * Monospace terminal body that streams live-server Express request logs.
 *
 * Auto-scrolls to the newest line when the user is already near the bottom.
 * When AI is available, a floating Copy-to-chat control appears for text
 * selections and inserts `@logs.<uuid>#start.end`.
 *
 * @param props - Log rows, server identity, and empty-state context.
 * @returns Scrollable log region.
 */
export function LiveServerLogTerminal({
  rows,
  isRunning,
  noServerSelected,
  filterActive,
  hiddenCount,
  liveServerUuid,
  serverName
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const selectionToolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dispatch = useAppDispatch();
  const { aiAvailable, copyToChat } = useCopyToChat();
  const [selectionToolbarVisible, setSelectionToolbarVisible] = useState(false);
  const [selectionToolbarCoords, setSelectionToolbarCoords] = useState<{
    top: number;
    left: number;
  } | null>(null);

  /**
   * Hides the floating copy-to-chat toolbar and clears any pending show timer.
   */
  const hideSelectionToolbar = useCallback((): void => {
    if (selectionToolbarTimerRef.current != null) {
      clearTimeout(selectionToolbarTimerRef.current);
      selectionToolbarTimerRef.current = null;
    }

    setSelectionToolbarVisible(false);
    setSelectionToolbarCoords(null);
  }, []);

  /**
   * Copies the current access-log selection into the AI chat composer.
   */
  const handleCopySelectionToChat = useCallback(async (): Promise<void> => {
    const container = containerRef.current;
    if (container == null || liveServerUuid == null) {
      return;
    }

    const capture = captureLiveServerLogSelection(container);
    if (capture == null) {
      return;
    }

    const token = buildLiveServerLogsSelectionToken(
      liveServerUuid,
      capture.startLine,
      capture.endLine
    );
    dispatch(
      setLiveServerLogsSelection({
        token,
        snapshot: {
          label: `Logs: ${serverName}`,
          startLine: capture.startLine,
          endLine: capture.endLine,
          selectedText: capture.selectedText,
          contextText: capture.contextText
        }
      })
    );
    await copyToChat(token);
    window.getSelection()?.removeAllRanges();
    hideSelectionToolbar();
  }, [copyToChat, dispatch, hideSelectionToolbar, liveServerUuid, serverName]);

  /**
   * Tracks whether the user is near the bottom so new lines can auto-scroll.
   */
  useEffect(() => {
    const element = containerRef.current;
    if (element == null) {
      return;
    }

    /**
     * Updates the stick-to-bottom flag from the current scroll position.
     */
    const handleScroll = (): void => {
      const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      stickToBottomRef.current = distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX;
    };

    element.addEventListener('scroll', handleScroll);
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [rows.length]);

  /**
   * Scrolls to the latest line when rows change and the user is pinned to the bottom.
   */
  useEffect(() => {
    const element = containerRef.current;
    if (element == null || !stickToBottomRef.current) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [rows]);

  /**
   * Shows a floating Copy-to-chat toolbar after the user finishes selecting log text.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (container == null || !aiAvailable || liveServerUuid == null) {
      hideSelectionToolbar();
      return;
    }

    /**
     * Schedules a toolbar update after the selection settles.
     */
    const scheduleToolbarUpdate = (): void => {
      if (selectionToolbarTimerRef.current != null) {
        clearTimeout(selectionToolbarTimerRef.current);
      }

      selectionToolbarTimerRef.current = setTimeout(() => {
        selectionToolbarTimerRef.current = null;
        const capture = captureLiveServerLogSelection(container);
        const coords = getLiveServerLogSelectionToolbarCoords(container);
        if (capture == null || coords == null || capture.selectedText.trim().length < 2) {
          hideSelectionToolbar();
          return;
        }

        setSelectionToolbarCoords(coords);
        setSelectionToolbarVisible(true);
      }, LIVE_SERVER_LOG_SELECTION_TOOLBAR_DELAY_MS);
    };

    /**
     * Hides the toolbar when the selection collapses or moves outside the log.
     */
    const handleSelectionChange = (): void => {
      const capture = captureLiveServerLogSelection(container);
      if (capture == null) {
        hideSelectionToolbar();
      }
    };

    container.addEventListener('mouseup', scheduleToolbarUpdate);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      if (selectionToolbarTimerRef.current != null) {
        clearTimeout(selectionToolbarTimerRef.current);
        selectionToolbarTimerRef.current = null;
      }
      container.removeEventListener('mouseup', scheduleToolbarUpdate);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [aiAvailable, hideSelectionToolbar, liveServerUuid, rows.length]);

  if (rows.length === 0) {
    let emptyMessage = 'Server is stopped. Start it to begin streaming Express request logs.';
    if (noServerSelected) {
      emptyMessage = 'Choose Logs from a live server in the sidebar to stream access logs here.';
    } else if (filterActive) {
      emptyMessage = 'No matching logs.';
    } else if (isRunning) {
      emptyMessage =
        'No requests logged yet. Load a page from this live server to see access logs.';
    }

    return (
      <div
        className="flex h-full min-h-0 flex-1 items-center justify-center bg-terminal px-4 py-6"
        role="status"
      >
        <p className="text-muted text-center">{emptyMessage}</p>
      </div>
    );
  }

  const showSelectionToolbar =
    selectionToolbarVisible &&
    selectionToolbarCoords != null &&
    aiAvailable &&
    liveServerUuid != null;

  return (
    <div className="relative h-full min-h-0 flex-1">
      <div
        ref={containerRef}
        className="h-full min-h-0 flex-1 overflow-auto bg-terminal px-3 py-2 font-mono text-[14px] text-text"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Live server request log"
      >
        {rows.map(({ entry, line }) => (
          <div
            key={`${entry.kind ?? 'access'}-${entry.timestamp}-${line}`}
            data-line={line}
            className="whitespace-pre-wrap break-all"
          >
            {formatLiveServerLogLine(entry)}
          </div>
        ))}
        {hiddenCount > 0 ? (
          <div className="text-muted pt-1 font-sans text-[14px]" role="status" aria-live="polite">
            {hiddenCount === 1 ? '1 result hidden' : `${hiddenCount} results hidden`}
          </div>
        ) : null}
      </div>
      {showSelectionToolbar ? (
        <CopyToChatButton
          coords={selectionToolbarCoords}
          aria-label={`Copy selection from Logs: ${serverName} to chat`}
          onSelect={() => {
            void handleCopySelectionToChat();
          }}
        />
      ) : null}
    </div>
  );
}
