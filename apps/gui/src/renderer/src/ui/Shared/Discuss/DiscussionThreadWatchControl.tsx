import { useCallback, useEffect, useState, type JSX } from 'react';
import { Button } from '@harborclient/sdk/components';
import { isTeamHubNoticesGracefulError } from '#/renderer/src/ui/Sidebars/CollectionSidebar/shell/TeamHubRailAvatars/isTeamHubNoticesGracefulError';

interface Props {
  /**
   * Team Hub connection id backing the discussion thread.
   */
  hubId: string;

  /**
   * Root comment id identifying the thread for subscription routes.
   */
  rootCommentId: string;
}

/**
 * Subscribe/unsubscribe control for a Team Hub discussion thread.
 *
 * @returns Toolbar watch button, or null when the hub does not support watch.
 */
export function DiscussionThreadWatchControl({ hubId, rootCommentId }: Props): JSX.Element | null {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  /**
   * Loads the current user's subscription state for this discussion thread.
   */
  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await window.api.getTeamHubDiscussionThreadSubscription(
        hubId,
        rootCommentId
      );
      setSubscribed(response.subscribed);
      setUnsupported(false);
    } catch (err) {
      if (isTeamHubNoticesGracefulError(err)) {
        setUnsupported(true);
        setSubscribed(null);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [hubId, rootCommentId]);

  /**
   * Loads subscription state when the hub thread changes.
   */
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        void refresh();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  /**
   * Toggles thread subscription through the Team Hub API.
   */
  const handleToggle = useCallback(async (): Promise<void> => {
    if (subscribed == null) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = subscribed
        ? await window.api.unsubscribeTeamHubDiscussionThread(hubId, rootCommentId)
        : await window.api.subscribeTeamHubDiscussionThread(hubId, rootCommentId);
      setSubscribed(response.subscribed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [hubId, rootCommentId, subscribed]);

  if (unsupported) {
    return null;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2" aria-busy={loading || saving}>
      <Button
        type="button"
        variant="toolbar"
        aria-pressed={subscribed === true}
        aria-label={subscribed ? 'Stop watching this discussion' : 'Watch this discussion'}
        disabled={loading || saving || subscribed == null}
        onClick={() => {
          void handleToggle();
        }}
      >
        {loading ? 'Loading…' : subscribed ? 'Watching' : 'Watch thread'}
      </Button>
      {error != null ? (
        <span className="text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
