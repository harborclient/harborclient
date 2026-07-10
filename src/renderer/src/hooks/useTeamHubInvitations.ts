import { useCallback, useEffect, useState } from 'react';
import type { HubInvitationRecord } from '#/shared/types';

interface UseTeamHubInvitationsResult {
  /**
   * Invitation records returned by the admin management API.
   */
  invitations: HubInvitationRecord[];

  /**
   * True while the invitation list is loading.
   */
  loading: boolean;

  /**
   * Human-readable load error, if any.
   */
  error: string | null;

  /**
   * Reloads invitations from the Team Hub server.
   */
  reload: () => void;
}

/**
 * Loads onboarding invitations for a Team Hub admin connection.
 *
 * @param hubId - Team hub connection id with an admin token.
 */
export function useTeamHubInvitations(hubId: string): UseTeamHubInvitationsResult {
  const [invitations, setInvitations] = useState<HubInvitationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * Bumps the reload token so the invitation list refetches.
   */
  const reload = useCallback((): void => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (cancelled) {
          return;
        }
        setLoading(true);
        setError(null);
        return window.api.listTeamHubInvitations(hubId);
      })
      .then((rows) => {
        if (cancelled || rows === undefined) {
          return;
        }
        setInvitations(rows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setInvitations([]);
        setLoading(false);
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [hubId, reloadToken]);

  return { invitations, loading, error, reload };
}
