import { useCallback, useEffect, useState, type JSX } from 'react';
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
 */
export function DiscussionThreadWatchControl({ hubId, rootCommentId }: Props): JSX.Element {
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
    return (
      <p className="m-0 text-muted" role="status">
        Thread watch controls are unavailable on this Team Hub.
      </p>
    );
  }

  const label =
    subscribed === true
      ? 'Watching this discussion'
      : subscribed === false
        ? 'Not watching this discussion'
        : 'Discussion watch status unknown';

  return (
    <div className="flex flex-wrap items-center gap-3" aria-busy={loading || saving}>
      <button
        type="button"
        className="cursor-pointer rounded border border-separator bg-surface px-3 py-1.5 text-[14px] text-text hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        aria-pressed={subscribed === true}
        aria-label={subscribed ? 'Stop watching this discussion' : 'Watch this discussion'}
        disabled={loading || saving || subscribed == null}
        onClick={() => {
          void handleToggle();
        }}
      >
        {loading ? 'Loading…' : subscribed ? 'Watching' : 'Watch thread'}
      </button>
      <span className="text-muted" role="status" aria-live="polite">
        {label}
      </span>
      {error != null ? (
        <span className="text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
