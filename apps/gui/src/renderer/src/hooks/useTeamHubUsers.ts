import { useCallback, useEffect, useState } from 'react';
import type { HubUserRecord } from '#/shared/types';

/**
 * Loaded Team Hub user list and bootstrap state from IPC.
 */
export interface TeamHubUsersState {
  /**
   * User accounts returned by the management API.
   */
  users: HubUserRecord[];

  /**
   * True while the initial or retried IPC load is in flight.
   */
  loading: boolean;

  /**
   * User-facing message when the IPC bootstrap fails; null on success or before first attempt.
   */
  error: string | null;

  /**
   * Re-runs the IPC bootstrap for the current hub id.
   */
  reload: () => void;
}

/**
 * Loads Team Hub users for an admin hub connection via IPC.
 *
 * @param hubId - Team hub connection id with an admin token, or null to skip loading.
 * @returns User list, loading/error flags, and a reload callback.
 */
export function useTeamHubUsers(hubId: string | null): TeamHubUsersState {
  const [users, setUsers] = useState<HubUserRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(hubId));
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * Triggers a fresh IPC bootstrap without changing external dependencies.
   */
  const reload = useCallback((): void => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!hubId) {
      return;
    }

    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setLoading(true);
        setError(null);
        return window.api.listTeamHubUsers(hubId);
      })
      .then((result) => {
        if (cancelled || result === undefined) return;
        setUsers(result);
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
  }, [hubId, reloadToken]);

  if (!hubId) {
    return { users: [], loading: false, error: null, reload };
  }

  return { users, loading, error, reload };
}
