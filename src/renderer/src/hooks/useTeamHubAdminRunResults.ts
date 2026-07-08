import { useCallback, useEffect, useState } from 'react';
import type { TeamHubAdminRunResult } from '#/shared/types';

/**
 * Loaded Team Hub admin run result list and bootstrap state from IPC.
 */
export interface TeamHubAdminRunResultsState {
  /**
   * Run result records returned by the admin management API.
   */
  runResults: TeamHubAdminRunResult[];

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
 * Loads Team Hub run results for an admin hub connection via IPC.
 *
 * @param hubId - Team hub connection id with an admin token, or null to skip loading.
 * @returns Run result list, loading/error flags, and a reload callback.
 */
export function useTeamHubAdminRunResults(hubId: string | null): TeamHubAdminRunResultsState {
  const [runResults, setRunResults] = useState<TeamHubAdminRunResult[]>([]);
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
        return window.api.listTeamHubAdminRunResults(hubId);
      })
      .then((result) => {
        if (cancelled || result === undefined) return;
        setRunResults(result);
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
    return { runResults: [], loading: false, error: null, reload };
  }

  return { runResults, loading, error, reload };
}
