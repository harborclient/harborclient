import { useCallback, useEffect, useState } from 'react';
import type { TeamHubAdminFolderSummary, TeamHubAdminRequestSummary } from '#/shared/types';

/**
 * Loaded Team Hub admin collection contents and bootstrap state from IPC.
 */
export interface TeamHubAdminCollectionContentsState {
  /**
   * Folder records in the selected collection.
   */
  folders: TeamHubAdminFolderSummary[];

  /**
   * Saved request records in the selected collection.
   */
  requests: TeamHubAdminRequestSummary[];

  /**
   * True while the initial or retried IPC load is in flight.
   */
  loading: boolean;

  /**
   * User-facing message when the IPC bootstrap fails; null on success or before first attempt.
   */
  error: string | null;

  /**
   * Re-runs the IPC bootstrap for the current hub and collection ids.
   */
  reload: () => void;
}

/**
 * Loads folders and saved requests for a hub collection via admin IPC.
 *
 * @param hubId - Team hub connection id with an admin token, or null to skip loading.
 * @param collectionId - Server collection UUID, or null to skip loading.
 * @returns Folder and request lists, loading/error flags, and a reload callback.
 */
export function useTeamHubAdminCollectionContents(
  hubId: string | null,
  collectionId: string | null
): TeamHubAdminCollectionContentsState {
  const [folders, setFolders] = useState<TeamHubAdminFolderSummary[]>([]);
  const [requests, setRequests] = useState<TeamHubAdminRequestSummary[]>([]);
  const [loading, setLoading] = useState(Boolean(hubId && collectionId));
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * Triggers a fresh IPC bootstrap without changing external dependencies.
   */
  const reload = useCallback((): void => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!hubId || !collectionId) {
      return;
    }

    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setLoading(true);
        setError(null);
        return window.api.listTeamHubAdminCollectionContents(hubId, collectionId);
      })
      .then((result) => {
        if (cancelled || result === undefined) return;
        setFolders(result.folders);
        setRequests(result.requests);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [hubId, collectionId, reloadToken]);

  if (!hubId || !collectionId) {
    return { folders: [], requests: [], loading: false, error: null, reload };
  }

  return { folders, requests, loading, error, reload };
}
