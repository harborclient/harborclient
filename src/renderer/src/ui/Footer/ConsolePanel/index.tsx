import { useCallback, useState, type JSX } from 'react';
import type { ConsoleEntry } from '#/renderer/src/store';
import { Button } from '#/renderer/src/components/Button';
import { Resizable } from '#/renderer/src/components/Resizable';
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

  /**
   * Closes the console panel and collapses any expanded entry.
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
    <Resizable
      id="footer-console-panel"
      open={open}
      onClose={handleClose}
      closeLabel="console"
      storageKey="hc.consoleHeight"
      title={
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
      }
    >
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
    </Resizable>
  );
}
