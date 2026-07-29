import { Button, FaIcon } from '@harborclient/sdk/components';
import { useCallback, type JSX } from 'react';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectWorkflowRunHistory } from '#/renderer/src/store/slices/workflowRunHistorySlice';
import { clearWorkflowRunHistory } from '#/renderer/src/store/thunks/workflowRunHistory';
import { faEraser } from '#/renderer/src/fontawesome';
import { SidebarSortButton } from '../sort/SidebarSortButton';

/**
 * Header actions for the Workflows History sidebar section (sort + clear).
 */
export function WorkflowHistoryHeaderActions(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const entries = useAppSelector(selectWorkflowRunHistory);
  const isEmpty = entries.length === 0;

  /**
   * Clears all workflow run history entries after confirmation.
   */
  const handleClearHistory = useCallback(async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Clear history',
      message: 'Clear all workflow run history?',
      confirmLabel: 'Clear',
      variant: 'danger'
    });
    if (confirmed) {
      void dispatch(clearWorkflowRunHistory());
    }
  }, [confirm, dispatch]);

  return (
    <>
      <SidebarSortButton sectionKey="history" ariaLabel="Sort history" title="Sort history" />
      <Button
        variant="toolbar"
        className="text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Clear workflow run history"
        disabled={isEmpty}
        onClick={() => {
          void handleClearHistory();
        }}
      >
        <FaIcon icon={faEraser} className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}
