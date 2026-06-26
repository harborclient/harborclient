import type { JSX } from 'react';
import type { StorageConnection } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="w-96 rounded-lg border border-separator bg-surface p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="m-0 mb-1 text-[14px] font-semibold text-text">Delete storage location?</h2>
        <p className="mb-2 text-[14px] text-muted">
          Are you sure you want to delete &ldquo;
          {connection.name || 'Untitled'}&rdquo;? This cannot be undone.
        </p>
        {isActive && (
          <p className="mb-4 text-[14px] text-muted">
            This is the active storage location. Another location will become active after restart.
          </p>
        )}
        {!isActive && <div className="mb-4" />}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="secondaryDanger" onClick={() => void onConfirm()}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
