import { useCallback, useEffect, useState } from 'react';
import type { TeamHub } from '#/shared/types';

/**
 * Loaded team hub list and bootstrap state from IPC.
 */
export interface TeamHubsState {
  /**
   * Configured team hubs from settings.
   */
  teamHubs: TeamHub[];

  /**
   * True while the initial or retried IPC load is in flight.
   */
  loading: boolean;

  /**
   * User-facing message when the IPC bootstrap fails; null on success or before first attempt.
   */
  error: string | null;

  /**
   * Re-runs the IPC bootstrap (clears error and sets loading).
   */
  reload: () => void;
}

/**
 * Loads team hubs via IPC. Handles cancellation on unmount, rejection with a
 * stable error message, and manual retry through {@link TeamHubsState.reload}.
 *
 * @returns Team hub list, loading/error flags, and a reload callback.
 */
export function useTeamHubs(): TeamHubsState {
  const [teamHubs, setTeamHubs] = useState<TeamHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * Triggers a fresh IPC bootstrap without changing external dependencies.
   */
  const reload = useCallback((): void => {
    setReloadToken((token) => token + 1);
  }, []);

  /**
   * Fetches team hubs; ignores results after cleanup or a newer run.
   */
  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setLoading(true);
        setError(null);
        return window.api.listTeamHubs();
      })
      .then((result) => {
        if (cancelled || result === undefined) return;
        setTeamHubs(result);
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
  }, [reloadToken]);

  return { teamHubs, loading, error, reload };
}
