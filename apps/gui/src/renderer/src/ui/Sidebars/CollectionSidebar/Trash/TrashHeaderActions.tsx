import { Button, FaIcon } from '@harborclient/sdk/components';
import { useCallback, type JSX } from 'react';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectTrashItems } from '#/renderer/src/store/slices/trashSlice';
import { emptyTrash } from '#/renderer/src/store/thunks/trash';
import { faCircleMinus } from '#/renderer/src/fontawesome';

/**
 * Header actions for the Trash sidebar section.
 */
export function TrashHeaderActions(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const items = useAppSelector(selectTrashItems);
  const isEmpty = items.length === 0;

  /**
   * Permanently deletes every trash snapshot row after confirmation.
   */
  const handleEmptyTrash = useCallback(async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Empty trash',
      message: 'Permanently delete everything in trash? This cannot be undone.',
      confirmLabel: 'Empty trash',
      variant: 'danger'
    });
    if (confirmed) {
      void dispatch(emptyTrash());
    }
  }, [confirm, dispatch]);

  return (
    <Button
      variant="toolbar"
      className="text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Empty trash"
      disabled={isEmpty}
      onClick={() => {
        void handleEmptyTrash();
      }}
    >
      <FaIcon icon={faCircleMinus} className="h-3.5 w-3.5" />
    </Button>
  );
}
