import { useCallback, useEffect, useState } from 'react';
import type { GitRequestFileStatus } from '#/shared/types';

/**
 * Loads and refreshes per-document git status for one git-backed collection.
 *
 * @param connectionId - Git connection id, when the collection is git-backed.
 * @param collectionUuid - Stable collection uuid.
 * @param enabled - When false, skips network calls.
 */
export function useGitDocumentStatuses(
  connectionId: string | undefined,
  collectionUuid: string | undefined,
  enabled: boolean
): {
  statuses: Record<string, GitRequestFileStatus>;
  refresh: () => Promise<void>;
} {
  const [statuses, setStatuses] = useState<Record<string, GitRequestFileStatus>>({});

  /**
   * Reloads document git status from the main process.
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (!enabled || connectionId == null || collectionUuid == null) {
      return;
    }

    try {
      const next = await window.api.gitDocumentStatuses({ connectionId, collectionUuid });
      setStatuses(next);
    } catch {
      setStatuses({});
    }
  }, [collectionUuid, connectionId, enabled]);

  /**
   * Loads document status when the collection becomes visible.
   */
  useEffect(() => {
    if (!enabled || connectionId == null || collectionUuid == null) {
      return;
    }

    let cancelled = false;

    void window.api
      .gitDocumentStatuses({ connectionId, collectionUuid })
      .then((next) => {
        if (!cancelled) {
          setStatuses(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatuses({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [collectionUuid, connectionId, enabled]);

  /**
   * Refreshes document status when the git working tree changes for this connection.
   */
  useEffect(() => {
    if (!enabled || connectionId == null) {
      return;
    }

    const unsubscribe = window.api.onGitWorkingTreeChanged((changedConnectionId) => {
      if (changedConnectionId === connectionId) {
        void refresh();
      }
    });

    return unsubscribe;
  }, [connectionId, enabled, refresh]);

  return { statuses, refresh };
}
