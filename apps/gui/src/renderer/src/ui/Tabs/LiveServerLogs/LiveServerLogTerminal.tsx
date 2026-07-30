import { useEffect, useRef, type JSX } from 'react';
import type { LiveServerRequestLogEntry } from '@harborclient/core/types';
import { formatLiveServerLogLine } from './formatLiveServerLogLine';

interface Props {
  /**
   * Ordered access-log entries to render (oldest first).
   */
  entries: LiveServerRequestLogEntry[];

  /**
   * When true, the empty-state copy assumes the server is currently running.
   */
  isRunning: boolean;
}

/**
 * Distance from the bottom (px) within which new lines keep auto-scrolling.
 */
const AUTO_SCROLL_THRESHOLD_PX = 48;

/**
 * Full-page monospace terminal that streams live-server Express request logs.
 *
 * Auto-scrolls to the newest line when the user is already near the bottom.
 *
 * @param props - Log entries and running state for empty copy.
 * @returns Scrollable log region.
 */
export function LiveServerLogTerminal({ entries, isRunning }: Props): JSX.Element {
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
  }, []);

  /**
   * Scrolls to the latest line when entries change and the user is pinned to the bottom.
   */
  useEffect(() => {
    const element = containerRef.current;
    if (element == null || !stickToBottomRef.current) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div
        className="flex min-h-0 flex-1 items-center justify-center bg-terminal px-4 py-6"
        role="status"
      >
        <p className="text-muted text-center">
          {isRunning
            ? 'No requests logged yet. Load a page from this live server to see access logs.'
            : 'Server is stopped. Start it to begin streaming Express request logs.'}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-auto bg-terminal px-3 py-2 font-mono text-[14px] text-text"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Live server request log"
    >
      {entries.map((entry, index) => (
        <div
          key={`${entry.timestamp}-${entry.method}-${entry.url}-${entry.statusCode}-${entry.durationMs}-${index}`}
          className="whitespace-pre-wrap break-all"
        >
          {formatLiveServerLogLine(entry)}
        </div>
      ))}
    </div>
  );
}
