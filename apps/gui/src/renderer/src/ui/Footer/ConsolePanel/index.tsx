import { EmptyState, RoundButton, FooterPanel } from '@harborclient/sdk/components';
import { useCallback, useState, type JSX } from 'react';
import type { ConsoleEntry } from '#/renderer/src/store';
import { EntryRow } from './EntryRow';
import { faEraser } from '@fortawesome/free-solid-svg-icons';

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
    <FooterPanel
      id="footer-console-panel"
      open={open}
      onClose={handleClose}
      closeLabel="console"
      storageKey="hc.consoleHeight"
      title="Console"
      buttons={[
        <RoundButton
          key="close"
          icon={faEraser}
          onClick={onClear}
          title="Clear"
          ariaLabel="Clear terminal"
        />
      ]}
    >
      {entries.length === 0 ? (
        <EmptyState variant="centered" className="h-full">
          No requests logged yet. Send a request to see it here.
        </EmptyState>
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
    </FooterPanel>
  );
}
