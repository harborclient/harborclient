import { useCallback, useEffect, useState } from 'react';
import type { HubApiTokenRecord } from '#/shared/types';

/**
 * Loaded Team Hub token list and bootstrap state from IPC.
 */
export interface TeamHubTokensState {
  /**
   * API tokens returned by the management API.
   */
  tokens: HubApiTokenRecord[];

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
 * Loads Team Hub API tokens for an admin hub connection via IPC.
 *
 * @param hubId - Team hub connection id with an admin token, or null to skip loading.
 * @returns Token list, loading/error flags, and a reload callback.
 */
export function useTeamHubTokens(hubId: string | null): TeamHubTokensState {
  const [tokens, setTokens] = useState<HubApiTokenRecord[]>([]);
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
        return window.api.listTeamHubTokens(hubId);
      })
      .then((result) => {
        if (cancelled || result === undefined) return;
        setTokens(result);
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
    return { tokens: [], loading: false, error: null, reload };
  }

  return { tokens, loading, error, reload };
}
