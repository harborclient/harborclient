import type { JSX } from 'react';
import type { StorageConnection } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { StorageConnectionForm } from './StorageConnectionForm';

interface Props {
  /**
   * Connection being edited in the modal.
   */
  connection: StorageConnection;

  /**
   * Whether this is a new connection.
   */
  isNew: boolean;

  /**
   * Whether save is in progress.
   */
  saving: boolean;

  /**
   * Inline error message from save or validation.
   */
  error: string | null;

  /**
   * Called when the connection draft changes.
   */
  onChange: (connection: StorageConnection) => void;

  /**
   * Dismisses the modal without saving.
   */
  onCancel: () => void;

  /**
   * Persists the connection draft.
   */
  onSave: () => void;
}

/**
 * Modal for adding or editing a named storage connection.
 */
export function ConnectionEditModal({
  connection,
  isNew,
  saving,
  error,
  onChange,
  onCancel,
  onSave
}: Props): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="max-h-[85vh] w-[480px] overflow-y-auto rounded-lg border border-separator bg-surface p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="m-0 mb-1 text-[14px] font-semibold text-text">
          {isNew ? 'Add storage location' : 'Edit storage location'}
        </h2>
        <p className="mb-4 text-[14px] text-muted">
          Choose a name and configure connection settings for this storage location.
        </p>

        <StorageConnectionForm
          connection={connection}
          isNew={isNew}
          disabled={saving}
          onChange={onChange}
        />

        {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void onSave()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
