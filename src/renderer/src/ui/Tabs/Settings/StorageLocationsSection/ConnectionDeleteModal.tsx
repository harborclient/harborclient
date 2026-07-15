import { Button, Modal, ModalFooter } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { StorageConnection } from '#/shared/types';

interface Props {
  /**
   * Connection the user is about to delete.
   */
  connection: StorageConnection;

  /**
   * Whether this connection is currently active.
   */
  isActive: boolean;

  /**
   * Dismisses the confirmation modal.
   */
  onCancel: () => void;

  /**
   * Deletes the connection after confirmation.
   */
  onConfirm: () => void;
}

/**
 * Confirmation modal for removing a storage connection.
 */
export function ConnectionDeleteModal({
  connection,
  isActive,
  onCancel,
  onConfirm
}: Props): JSX.Element {
  return (
    <Modal
      labelledBy="storage-connection-delete-title"
      onClose={onCancel}
      title="Delete storage location?"
      description={
        <>
          Are you sure you want to delete &ldquo;
          {connection.name || 'Untitled'}&rdquo;? This cannot be undone.
          {isActive ? (
            <>
              {' '}
              This is the active storage location. Another location will become active after
              restart.
            </>
          ) : null}
        </>
      }
    >
      <ModalFooter>
        <Button type="button" variant="primaryDanger" onClick={() => void onConfirm()}>
          Delete
        </Button>
      </ModalFooter>
    </Modal>
  );
}
