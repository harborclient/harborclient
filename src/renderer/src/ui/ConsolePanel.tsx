import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
  type MouseEvent as ReactMouseEvent
} from 'react';
import type { ConsoleEntry } from '#/renderer/src/store';
import { formatBytes, RequestDetails } from './responseFormat';
import { METHOD_CLASSES, secondaryButton, statusDotClass } from './classes';

interface Props {
  /**
   * Console log entries, newest first.
   */
  entries: ConsoleEntry[];

  /**
   * Whether the panel is visible (slides up when true).
   */
  open: boolean;

  /**
   * Closes the console panel.
   */
  onClose: () => void;

  /**
   * Clears all console entries.
   */
  onClear: () => void;
}

const DEFAULT_HEIGHT = 280;
const MIN_HEIGHT = 120;

interface ConsoleEntryRowProps {
  entry: ConsoleEntry;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * A single expandable console log entry.
 */
function ConsoleEntryRow({ entry, expanded, onToggle }: ConsoleEntryRowProps): JSX.Element {
  const { result } = entry;
  const method = result.request?.method ?? 'GET';
  const methodClass = METHOD_CLASSES[method.toLowerCase()] ?? METHOD_CLASSES.get;
  const url = result.request?.url ?? '—';
  const statusLabel = result.error ? 'Error' : `${result.status} ${result.statusText}`;

  return (
    <div className="border-b border-separator last:border-b-0">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-selection/60 app-no-drag"
        onClick={onToggle}
      >
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusDotClass(result.status)}`}
        />
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${methodClass}`}
        >
          {method}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-text">{url}</span>
        <span className="shrink-0 text-muted">{statusLabel}</span>
        <span className="shrink-0 text-muted">{result.timeMs} ms</span>
        <span className="shrink-0 text-muted">{formatBytes(result.sizeBytes)}</span>
        <span className="shrink-0 text-[12px] text-muted">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        {(entry.requestName || entry.collectionName) && (
          <span className="max-w-[120px] shrink-0 truncate text-[12px] text-muted">
            {entry.collectionName ? `${entry.collectionName} / ` : ''}
            {entry.requestName}
          </span>
        )}
        <span className="shrink-0 text-muted">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="border-t border-separator bg-surface px-3 py-3">
          <RequestDetails result={result} />
        </div>
      )}
    </div>
  );
}

/**
 * Slide-up, resizable console panel showing a global request log.
 */
export function ConsolePanel({ entries, open, onClose, onClear }: Props): JSX.Element {
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(DEFAULT_HEIGHT);

  const getMaxHeight = useCallback((): number => {
    const container = containerRef.current?.parentElement;
    if (!container) return window.innerHeight * 0.8;
    return container.clientHeight - 40;
  }, []);

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      resizingRef.current = true;
      startYRef.current = event.clientY;
      startHeightRef.current = height;
    },
    [height]
  );

  const handleClose = useCallback(() => {
    setExpandedId(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent): void => {
      if (!resizingRef.current) return;
      const delta = startYRef.current - event.clientY;
      const maxHeight = getMaxHeight();
      const nextHeight = Math.min(maxHeight, Math.max(MIN_HEIGHT, startHeightRef.current + delta));
      setHeight(nextHeight);
    };

    const handleMouseUp = (): void => {
      resizingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [getMaxHeight]);

  const toggleExpanded = (id: string): void => {
    setExpandedId((current) => (current === id ? null : id));
  };

  const effectiveExpandedId = open ? expandedId : null;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-x-0 bottom-0 z-40 flex flex-col border-t border-separator bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out app-no-drag ${
        open ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ height }}
      aria-hidden={!open}
    >
      <div
        className="flex h-1.5 shrink-0 cursor-row-resize items-center justify-center border-b border-separator bg-control hover:bg-selection/60"
        onMouseDown={handleResizeStart}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize console panel"
      >
        <div className="h-0.5 w-8 rounded-full bg-muted/50" />
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-separator px-3 py-2">
        <div className="flex items-center gap-2 text-[13px] font-medium text-text">
          <span>Console</span>
          {entries.length > 0 && (
            <span className="text-[12px] font-normal text-muted">({entries.length})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={secondaryButton}
            onClick={onClear}
            disabled={entries.length === 0}
          >
            Clear
          </button>
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[14px] text-muted hover:bg-selection hover:text-text app-no-drag"
            onClick={handleClose}
            aria-label="Close console"
          >
            ×
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-[13px] text-muted">
            No requests logged yet. Send a request to see it here.
          </div>
        ) : (
          entries.map((entry) => (
            <ConsoleEntryRow
              key={entry.id}
              entry={entry}
              expanded={effectiveExpandedId === entry.id}
              onToggle={() => toggleExpanded(entry.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
