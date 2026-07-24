import { useCallback, useEffect, useState } from 'react';
import type { SourceControlStatus } from '#/shared/types';
import { subscribeStorageConnectionsChanged } from './subscribeStorageConnectionsChanged';

/**
 * Polls git source-control status for mounted git connections.
 *
 * @param pollIntervalMs - Optional polling interval; defaults to 10 seconds.
 * @param onWorkingTreeChanged - Optional callback when the working tree changes on disk.
 */
export function useGitStatuses(
  pollIntervalMs = 10000,
  onWorkingTreeChanged?: (connectionId: string) => void
): {
  statuses: Record<string, SourceControlStatus>;
  refresh: () => void;
} {
  const [statuses, setStatuses] = useState<Record<string, SourceControlStatus>>({});

  /**
   * Fetches latest git statuses from the main process.
   */
  const refresh = useCallback((): void => {
    void window.api
      .listGitStatuses()
      .then(setStatuses)
      .catch(() => {
        // Keep last-known statuses; next poll or focus will retry.
      });
  }, []);

  /**
   * Polls git status on an interval, when the window regains focus, when the
   * working tree changes on disk (pull or external git operations), and when
   * storage connections change.
   */
  useEffect(() => {
    refresh();

    const intervalId = window.setInterval(refresh, pollIntervalMs);
    const handleFocus = (): void => {
      refresh();
    };
    window.addEventListener('focus', handleFocus);
    const unsubscribeConnectionsChanged = subscribeStorageConnectionsChanged(() => {
      refresh();
    });

    const unsubscribe =
      onWorkingTreeChanged != null
        ? window.api.onGitWorkingTreeChanged((connectionId) => {
            refresh();
            onWorkingTreeChanged(connectionId);
          })
        : undefined;

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      unsubscribeConnectionsChanged();
      unsubscribe?.();
    };
  }, [pollIntervalMs, refresh, onWorkingTreeChanged]);

  return { statuses, refresh };
}
