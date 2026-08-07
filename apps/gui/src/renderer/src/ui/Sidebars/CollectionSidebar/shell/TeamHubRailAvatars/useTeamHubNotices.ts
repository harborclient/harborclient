import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TeamHub, TeamHubNotice } from '@harborclient/core/types';
import { isTeamHubNoticesGracefulError } from './isTeamHubNoticesGracefulError';

/**
 * Polling interval used when SSE is unavailable or as a safety reconcile loop.
 */
const NOTICE_POLL_INTERVAL_MS = 60_000;

/**
 * Per-hub notice state tracked by {@link useTeamHubNotices}.
 */
export interface TeamHubNoticeBucket {
  /**
   * Latest unread notice count for the hub.
   */
  unreadCount: number;

  /**
   * Most recently loaded notice page.
   */
  notices: TeamHubNotice[];

  /**
   * True while unread count or notice list is loading.
   */
  loading: boolean;

  /**
   * Inline error message for the notices panel, when present.
   */
  error: string | null;

  /**
   * When true, the hub server does not expose notice routes.
   */
  unsupported: boolean;

  /**
   * When true, the hub is offline or unreachable for notice fetches.
   */
  unreachable: boolean;
}

/**
 * Mutable notice state and refresh helpers for Team Hub rail avatars.
 */
export interface TeamHubNoticesState {
  /**
   * Notice buckets keyed by hub connection id.
   */
  bucketsByHubId: Map<string, TeamHubNoticeBucket>;

  /**
   * Refreshes unread counts for connected hubs that support communication.
   */
  refreshUnreadCounts: () => Promise<void>;

  /**
   * Loads the first page of notices for one hub.
   *
   * @param hubId - Team hub connection id.
   */
  loadNotices: (hubId: string) => Promise<void>;

  /**
   * Marks one notice as read and refreshes unread counts.
   *
   * @param hubId - Team hub connection id.
   * @param noticeId - Notice record identifier.
   */
  markNoticeRead: (hubId: string, noticeId: string) => Promise<void>;

  /**
   * Marks every notice as read for one hub.
   *
   * @param hubId - Team hub connection id.
   */
  markAllRead: (hubId: string) => Promise<void>;
}

/**
 * Builds an empty notice bucket for a hub that has not been fetched yet.
 */
function emptyBucket(): TeamHubNoticeBucket {
  return {
    unreadCount: 0,
    notices: [],
    loading: false,
    error: null,
    unsupported: false,
    unreachable: false
  };
}

/**
 * Tracks notice unread counts and list state for connected Team Hub rail avatars.
 *
 * Refreshes on hub list changes, window focus, and manual rescan triggers.
 *
 * @param teamHubs - Configured team hub connections.
 * @param communicationByHubId - Hub ids whose servers expose communication routes.
 * @param rescanToken - Counter that changes when service scans should re-run notice fetches.
 * @param enabled - When false, skips notice polling until prerequisites are ready.
 */
export function useTeamHubNotices(
  teamHubs: TeamHub[],
  communicationByHubId: Set<string>,
  rescanToken: number,
  enabled: boolean
): TeamHubNoticesState {
  const [bucketsByHubId, setBucketsByHubId] = useState(
    () => new Map<string, TeamHubNoticeBucket>()
  );

  /**
   * Updates one hub bucket immutably.
   *
   * @param hubId - Team hub connection id.
   * @param patch - Partial bucket fields to merge.
   */
  const patchBucket = useCallback((hubId: string, patch: Partial<TeamHubNoticeBucket>): void => {
    setBucketsByHubId((current) => {
      const next = new Map(current);
      const existing = next.get(hubId) ?? emptyBucket();
      next.set(hubId, { ...existing, ...patch });
      return next;
    });
  }, []);

  /**
   * Fetches unread counts for every connected hub with communication enabled.
   */
  const refreshUnreadCounts = useCallback(async (): Promise<void> => {
    const targets = teamHubs.filter(
      (hub) => hub.connected !== false && communicationByHubId.has(hub.id)
    );

    await Promise.all(
      targets.map(async (hub) => {
        patchBucket(hub.id, { loading: true, error: null });
        try {
          const response = await window.api.getTeamHubNoticesUnreadCount(hub.id);
          patchBucket(hub.id, {
            unreadCount: response.count,
            loading: false,
            unsupported: false,
            unreachable: false,
            error: null
          });
        } catch (err) {
          const graceful = isTeamHubNoticesGracefulError(err);
          patchBucket(hub.id, {
            loading: false,
            unsupported: graceful,
            unreachable: graceful,
            error: graceful ? null : err instanceof Error ? err.message : String(err)
          });
        }
      })
    );
  }, [communicationByHubId, patchBucket, teamHubs]);

  /**
   * Loads the first page of notices for one hub into its bucket.
   *
   * @param hubId - Team hub connection id.
   */
  const loadNotices = useCallback(
    async (hubId: string): Promise<void> => {
      patchBucket(hubId, { loading: true, error: null });
      try {
        const response = await window.api.listTeamHubNotices(hubId, { limit: 30 });
        patchBucket(hubId, {
          notices: response.notices,
          loading: false,
          unsupported: false,
          unreachable: false,
          error: null
        });
      } catch (err) {
        const graceful = isTeamHubNoticesGracefulError(err);
        patchBucket(hubId, {
          loading: false,
          unsupported: graceful,
          unreachable: graceful,
          error: graceful ? null : err instanceof Error ? err.message : String(err)
        });
      }
    },
    [patchBucket]
  );

  /**
   * Marks one notice as read and refreshes unread counts afterward.
   *
   * @param hubId - Team hub connection id.
   * @param noticeId - Notice record identifier.
   */
  const markNoticeRead = useCallback(
    async (hubId: string, noticeId: string): Promise<void> => {
      try {
        await window.api.markTeamHubNoticeRead(hubId, noticeId);
        patchBucket(hubId, {
          notices: (bucketsByHubId.get(hubId)?.notices ?? []).map((notice) =>
            notice.id === noticeId ? { ...notice, readAt: new Date().toISOString() } : notice
          )
        });
        await refreshUnreadCounts();
      } catch (err) {
        if (!isTeamHubNoticesGracefulError(err)) {
          patchBucket(hubId, {
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
    },
    [bucketsByHubId, patchBucket, refreshUnreadCounts]
  );

  /**
   * Marks every notice as read for one hub.
   *
   * @param hubId - Team hub connection id.
   */
  const markAllRead = useCallback(
    async (hubId: string): Promise<void> => {
      try {
        await window.api.markAllTeamHubNoticesRead(hubId);
        patchBucket(hubId, {
          notices: (bucketsByHubId.get(hubId)?.notices ?? []).map((notice) => ({
            ...notice,
            readAt: notice.readAt ?? new Date().toISOString()
          }))
        });
        await refreshUnreadCounts();
      } catch (err) {
        if (!isTeamHubNoticesGracefulError(err)) {
          patchBucket(hubId, {
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
    },
    [bucketsByHubId, patchBucket, refreshUnreadCounts]
  );

  /**
   * Refreshes unread counts when hubs, communication flags, or rescan tokens change.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        void refreshUnreadCounts();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshUnreadCounts, rescanToken]);

  /**
   * Refreshes unread counts when the application window regains focus.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleFocus = (): void => {
      void refreshUnreadCounts();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, refreshUnreadCounts]);

  /**
   * Keeps main-process notice SSE subscriptions aligned with connected hubs.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const hubIds = teamHubs
      .filter((hub) => hub.connected !== false && communicationByHubId.has(hub.id))
      .map((hub) => hub.id);

    void window.api.syncTeamHubNoticeStreams(hubIds);
  }, [communicationByHubId, enabled, rescanToken, teamHubs]);

  /**
   * Applies notice SSE events and reconnect reconciliation to hub buckets.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    return window.api.onTeamHubNoticeStream((message) => {
      if (message.kind === 'reconnected') {
        patchBucket(message.hubId, {
          unreadCount: message.unreadCount,
          unreachable: false,
          error: null
        });
        return;
      }

      patchBucket(message.hubId, {
        unreadCount: message.event.unreadCount,
        unreachable: false,
        error: null
      });
    });
  }, [enabled, patchBucket]);

  /**
   * Polls unread counts periodically as a fallback when SSE is unavailable.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshUnreadCounts();
    }, NOTICE_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, refreshUnreadCounts]);

  return useMemo(
    () => ({
      bucketsByHubId,
      refreshUnreadCounts,
      loadNotices,
      markNoticeRead,
      markAllRead
    }),
    [bucketsByHubId, loadNotices, markAllRead, markNoticeRead, refreshUnreadCounts]
  );
}
