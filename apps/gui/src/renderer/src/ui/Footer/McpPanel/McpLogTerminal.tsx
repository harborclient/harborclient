import { useEffect, useRef, type JSX } from 'react';
import type { McpServerLogEntry } from '@harborclient/core/types';
import { formatMcpLogLine } from './formatMcpLogLine';

/**
 * One filtered terminal row with its original 1-based buffer line number.
 */
export interface McpLogTerminalRow {
  /**
   * Log entry to render.
   */
  entry: McpServerLogEntry;

  /**
   * 1-based line index in the full unfiltered buffer.
   */
  line: number;
}

interface Props {
  /**
   * Filtered log rows with original 1-based buffer line numbers (oldest first).
   */
  rows: McpLogTerminalRow[];

  /**
   * When true, a non-empty filter is applied (empty list means no matches).
   */
  filterActive: boolean;

  /**
   * Number of buffer lines hidden by the active filter (0 when none hidden).
   */
  hiddenCount: number;

  /**
   * Whether Keep logs is currently enabled in settings.
   */
  keepLogs: boolean;
}

/**
 * Distance from the bottom (px) within which new lines keep auto-scrolling.
 */
const AUTO_SCROLL_THRESHOLD_PX = 48;

/**
 * Monospace terminal body that streams sanitized MCP server logs.
 *
 * Auto-scrolls to the newest line when the user is already near the bottom.
 * Unlike live-server logs, this terminal has no AI selection or clear tooling.
 *
 * @param props - Filtered rows and empty-state context.
 * @returns Scrollable log region.
 */
export function McpLogTerminal({ rows, filterActive, hiddenCount, keepLogs }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

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

  if (rows.length === 0) {
    const loggingStatus = keepLogs ? 'Logging is enabled.' : 'Logging is disabled.';
    /**
     * Empty-state copy: filter miss, or no rows, always including logging status.
     */
    const emptyMessage = filterActive
      ? `No matching logs. ${loggingStatus}`
      : keepLogs
        ? `${loggingStatus} No MCP traffic logged yet. Start the server and send requests to see logs here.`
        : `${loggingStatus} Enable Keep logs and save settings to record sanitized MCP traffic.`;

    return (
      <div
        className="flex h-full min-h-0 flex-1 items-center justify-center bg-terminal px-4 py-6"
        role="status"
      >
        <p className="text-muted text-center">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full min-h-0 flex-1 overflow-auto bg-terminal px-3 py-2 font-mono text-[14px] text-text"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="MCP server log"
    >
      {rows.map(({ entry, line }) => (
        <div
          key={`${entry.id}-${entry.timestamp}-${line}`}
          data-line={line}
          className="whitespace-pre-wrap break-all"
        >
          {formatMcpLogLine(entry)}
        </div>
      ))}
      {hiddenCount > 0 ? (
        <div className="text-muted pt-1 font-sans text-[14px]" role="status" aria-live="polite">
          {hiddenCount === 1 ? '1 result hidden' : `${hiddenCount} results hidden`}
        </div>
      ) : null}
    </div>
  );
}
