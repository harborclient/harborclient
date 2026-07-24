import { Button, Modal, ModalFormLayout, FieldError } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { StorageConnection } from '#/shared/types';

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
    <Modal
      className="w-[680px] max-w-[90vw]"
      labelledBy="storage-connection-edit-title"
      onClose={onCancel}
      title={isNew ? 'Add storage location' : 'Edit storage location'}
      description="Choose a name and configure connection settings for this storage location."
      closeDisabled={saving}
      disableEscape={saving}
    >
      <ModalFormLayout
        error={error ? <FieldError spacing="modal">{error}</FieldError> : undefined}
        actions={
          <Button type="button" disabled={saving} onClick={() => void onSave()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <StorageConnectionForm
          connection={connection}
          isNew={isNew}
          disabled={saving}
          onChange={onChange}
        />
      </ModalFormLayout>
    </Modal>
  );
}
