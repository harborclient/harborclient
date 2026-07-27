import { Modal } from '@harborclient/sdk/components';
import type { RequestHistoryEntry } from '@harborclient/core/types/requestHistory';
import { useId, type JSX } from 'react';
import { ResponseHistoryDiffPickerItem } from './ResponseHistoryDiffPickerItem';

interface Props {
  /**
   * Prior history entries the user can compare against the current response.
   */
  entries: RequestHistoryEntry[];

  /**
   * Closes the picker without selecting an entry.
   */
  onClose: () => void;

  /**
   * Called when the user chooses one history entry for Diff.
   *
   * @param entry - Selected prior history entry.
   */
  onSelect: (entry: RequestHistoryEntry) => void;
}

/**
 * Modal listing prior request history entries for choosing a Diff baseline.
 */
export function ResponseHistoryDiffPickerModal({ entries, onClose, onSelect }: Props): JSX.Element {
  const titleId = useId();

  return (
    <Modal
      onClose={onClose}
      className="flex w-[40rem] max-w-[calc(100vw-2rem)] max-h-[85vh] flex-col"
      labelledBy={titleId}
      title="Compare with history"
      description="Choose a previous response to Diff against the current one."
    >
      {entries.length === 0 ? (
        <p className="m-0 text-muted" role="status">
          No previous responses available.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5" role="listbox" aria-label="Request history">
          {entries.map((entry) => (
            <ResponseHistoryDiffPickerItem key={entry.id} entry={entry} onSelect={onSelect} />
          ))}
        </div>
      )}
    </Modal>
  );
}
