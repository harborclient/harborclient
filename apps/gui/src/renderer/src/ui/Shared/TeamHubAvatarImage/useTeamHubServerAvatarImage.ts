import { useEffect, useState } from 'react';
import { loadTeamHubServerAvatarImage } from './teamHubAvatarImageCache';

/**
 * Loads a Team Hub server avatar image data URL for display with initials fallback.
 *
 * @param hubId - Team hub connection id used for authenticated fetch.
 * @param imageUrl - Relative hub avatar image URL from the session payload, when present.
 * @returns Data URL when loaded, otherwise null while loading or on failure.
 */
export function useTeamHubServerAvatarImage(
  hubId: string | undefined,
  imageUrl: string | undefined
): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const canLoad = hubId != null && imageUrl != null && imageUrl.length > 0;

  /**
   * Fetches and caches the hub avatar image whenever the hub or image URL changes.
   *
   * Ignores stale responses after the consuming component unmounts or the inputs
   * change again. When no image URL is available, the hook returns null without
   * writing empty state into the effect body.
   */
  useEffect(() => {
    if (!canLoad || hubId == null || imageUrl == null) {
      return;
    }

    let cancelled = false;

    void loadTeamHubServerAvatarImage(hubId, imageUrl)
      .then((next) => {
        if (!cancelled) {
          setDataUrl(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDataUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canLoad, hubId, imageUrl]);

  return canLoad ? dataUrl : null;
}
