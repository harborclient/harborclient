import { Button, FaIcon } from '@harborclient/sdk/components';
import { useCallback, type JSX } from 'react';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectLiveServerLogSessions } from '#/renderer/src/store/selectors';
import { clearAllLiveServerLogSessions } from '#/renderer/src/store/thunks/liveServers';
import { faEraser } from '#/renderer/src/fontawesome';

/**
 * Header actions for the Server Logs sidebar section (clear all sessions).
 */
export function ServerLogsHeaderActions(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const sessions = useAppSelector(selectLiveServerLogSessions);
  const isEmpty = sessions.length === 0;

  /**
   * Clears every retained live-server log session after confirmation.
   */
  const handleClear = useCallback(async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Clear server logs',
      message: 'Clear all server logs?',
      confirmLabel: 'Clear',
      variant: 'danger'
    });
    if (confirmed) {
      void dispatch(clearAllLiveServerLogSessions());
    }
  }, [confirm, dispatch]);

  return (
    <Button
      variant="toolbar"
      className="text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Clear server logs"
      disabled={isEmpty}
      onClick={() => {
        void handleClear();
      }}
    >
      <FaIcon icon={faEraser} className="h-3.5 w-3.5" />
    </Button>
  );
}
