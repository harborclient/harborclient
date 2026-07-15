import { Button, FaIcon } from '@harborclient/sdk/components';
import { useCallback, type JSX } from 'react';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectRequestHistory } from '#/renderer/src/store/slices/requestHistorySlice';
import { clearRequestHistory } from '#/renderer/src/store/thunks/requestHistory';
import { faEraser } from '#/renderer/src/fontawesome';

/**
 * Header actions for the History sidebar section.
 */
export function HistoryHeaderActions(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const entries = useAppSelector(selectRequestHistory);
  const isEmpty = entries.length === 0;

  /**
   * Clears all request history entries after confirmation.
   */
  const handleClearHistory = useCallback(async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Clear history',
      message: 'Clear all request history?',
      confirmLabel: 'Clear',
      variant: 'danger'
    });
    if (confirmed) {
      void dispatch(clearRequestHistory());
    }
  }, [confirm, dispatch]);

  return (
    <Button
      variant="toolbar"
      className="text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Clear request history"
      disabled={isEmpty}
      onClick={() => {
        void handleClearHistory();
      }}
    >
      <FaIcon icon={faEraser} className="h-3.5 w-3.5" />
    </Button>
  );
}
