import { Button, FaIcon } from '@harborclient/sdk/components';
import { useCallback, type JSX } from 'react';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectRunResults } from '#/renderer/src/store/slices/runResultsSlice';
import { clearRunResults } from '#/renderer/src/store/thunks/runResults';
import { faEraser } from '#/renderer/src/fontawesome';

/**
 * Header actions for the Runs sidebar section.
 */
export function RunsHeaderActions(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const runResults = useAppSelector(selectRunResults);
  const isEmpty = runResults.length === 0;

  /**
   * Clears all saved run results after confirmation.
   */
  const handleClearRuns = useCallback(async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Clear runs',
      message: 'Clear all saved runs?',
      confirmLabel: 'Clear',
      variant: 'danger'
    });
    if (confirmed) {
      void dispatch(clearRunResults());
    }
  }, [confirm, dispatch]);

  return (
    <Button
      variant="toolbar"
      className="text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Clear all runs"
      disabled={isEmpty}
      onClick={() => {
        void handleClearRuns();
      }}
    >
      <FaIcon icon={faEraser} className="h-3.5 w-3.5" />
    </Button>
  );
}
