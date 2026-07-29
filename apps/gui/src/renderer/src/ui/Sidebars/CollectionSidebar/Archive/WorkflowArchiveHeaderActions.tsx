import { Button, FaIcon } from '@harborclient/sdk/components';
import { useCallback, type JSX } from 'react';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectArchivedWorkflows } from '#/renderer/src/store/selectors';
import { emptyWorkflowArchive } from '#/renderer/src/store/thunks/workflows';
import { faEraser } from '#/renderer/src/fontawesome';
import { SidebarSortButton } from '../sort/SidebarSortButton';

/**
 * Header actions for the Workflows Archive sidebar section (sort + empty archive).
 */
export function WorkflowArchiveHeaderActions(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const workflows = useAppSelector(selectArchivedWorkflows);
  const isEmpty = workflows.length === 0;

  /**
   * Moves every archived workflow to trash after confirmation.
   */
  const handleEmptyArchive = useCallback(async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Empty archive',
      message: 'Move all archived workflows to trash?',
      confirmLabel: 'Empty archive',
      variant: 'danger'
    });
    if (confirmed) {
      void dispatch(emptyWorkflowArchive());
    }
  }, [confirm, dispatch]);

  return (
    <>
      <SidebarSortButton sectionKey="archive" ariaLabel="Sort archive" title="Sort archive" />
      <Button
        variant="toolbar"
        className="text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Empty archive"
        title="Empty archive"
        disabled={isEmpty}
        onClick={() => {
          void handleEmptyArchive();
        }}
      >
        <FaIcon icon={faEraser} className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}
