import { useCallback, useRef, useState, type JSX } from 'react';
import type { ConsoleEntry } from '#/renderer/src/store';
import { Button } from '#/renderer/src/components/Button';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { ResizeHandle, useResizable } from '#/renderer/src/components/Resizable';
import { faXmark } from '#/renderer/src/fontawesome';
import {
  DEFAULT_HEIGHT,
  MIN_HEIGHT,
  footerPanelClassName,
  footerPanelCloseButtonClassName,
  getFooterPanelMaxSize
} from '../panelUtils';
import { EntryRow } from './EntryRow';

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

/**
 * Slide-up, resizable console panel showing a global request log.
 */
export function ConsolePanel({ entries, open, onClose, onClear }: Props): JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    size: height,
    minSize: panelMinSize,
    maxSize: panelMaxSize,
    onResizeStart,
    onKeyboardResize
  } = useResizable({
    axis: 'y',
    direction: -1,
    defaultSize: DEFAULT_HEIGHT,
    minSize: MIN_HEIGHT,
    getMaxSize: () => getFooterPanelMaxSize(containerRef),
    storageKey: 'hc.consoleHeight'
  });

  /**
   * Closes the console panel.
   */
  const handleClose = useCallback(() => {
    setExpandedId(null);
    onClose();
  }, [onClose]);

  /**
   * Toggles the expanded state of a console entry.
   */
  const toggleExpanded = (id: string): void => {
    setExpandedId((current) => (current === id ? null : id));
  };

  const effectiveExpandedId = open ? expandedId : null;

  return (
    <div
      ref={containerRef}
      id="footer-console-panel"
      className={footerPanelClassName(open)}
      style={{ height }}
      aria-hidden={!open}
    >
      <ResizeHandle
        orientation="horizontal"
        value={height}
        min={panelMinSize}
        max={panelMaxSize}
        onResizeStart={onResizeStart}
        onKeyboardResize={onKeyboardResize}
        ariaLabel="Resize console panel"
      />

      <div className="flex shrink-0 items-center justify-between border-b border-separator px-3 py-2">
        <div className="flex items-center gap-2 text-[14px] font-medium text-text">
          <span>Console</span>
          {entries.length > 0 && (
            <span className="text-[14px] font-normal text-muted">({entries.length})</span>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={onClear}
            disabled={entries.length === 0}
          >
            Clear
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={footerPanelCloseButtonClassName}
            onClick={handleClose}
            aria-label="Close console"
          >
            <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-[14px] text-muted">
            No requests logged yet. Send a request to see it here.
          </div>
        ) : (
          entries.map((entry) => (
            <EntryRow
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
