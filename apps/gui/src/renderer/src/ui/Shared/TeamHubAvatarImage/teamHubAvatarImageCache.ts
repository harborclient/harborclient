/**
 * In-memory cache of Team Hub avatar image data URLs keyed by hub, user, and version.
 */
const avatarImageCache = new Map<string, string>();

/**
 * In-flight avatar fetches keyed the same way as {@link avatarImageCache}.
 */
const avatarImageInflight = new Map<string, Promise<string>>();

/**
 * Builds a stable cache key for a Team Hub avatar image fetch.
 *
 * @param hubId - Team hub connection id.
 * @param userId - User account id owning the avatar.
 * @param version - Optional cache-busting version from the avatar image URL.
 */
export function teamHubAvatarCacheKey(hubId: string, userId: string, version?: string): string {
  return `${hubId}:${userId}:${version ?? ''}`;
}

/**
 * Extracts the cache-busting version query from a relative avatar image URL.
 *
 * @param imageUrl - Relative avatar URL such as `/auth/users/{id}/avatar?v=123`.
 * @returns Version string when present.
 */
export function avatarVersionFromUrl(imageUrl: string | undefined): string | undefined {
  if (imageUrl == null || imageUrl.length === 0) {
    return undefined;
  }

  try {
    const parsed = new URL(imageUrl, 'https://team-hub.local');
    return parsed.searchParams.get('v') ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Loads a Team Hub avatar image data URL, reusing in-memory cache and in-flight requests.
 *
 * @param hubId - Team hub connection id.
 * @param userId - User account whose avatar image should be loaded.
 * @param imageUrl - Relative avatar image URL from the API payload.
 * @returns Data URL for the avatar image.
 */
export async function loadTeamHubAvatarImage(
  hubId: string,
  userId: string,
  imageUrl: string
): Promise<string> {
  const version = avatarVersionFromUrl(imageUrl);
  const key = teamHubAvatarCacheKey(hubId, userId, version);
  const cached = avatarImageCache.get(key);
  if (cached != null) {
    return cached;
  }

  const inflight = avatarImageInflight.get(key);
  if (inflight != null) {
    return inflight;
  }

  const request = window.api
    .getTeamHubUserAvatar(hubId, userId, version)
    .then((image) => {
      avatarImageCache.set(key, image.dataUrl);
      avatarImageInflight.delete(key);
      return image.dataUrl;
    })
    .catch((error) => {
      avatarImageInflight.delete(key);
      throw error;
    });

  avatarImageInflight.set(key, request);
  return request;
}

/**
 * Builds a stable cache key for a Team Hub server avatar image fetch.
 *
 * @param hubId - Team hub connection id.
 * @param version - Optional cache-busting version from the hub avatar image URL.
 */
export function teamHubServerAvatarCacheKey(hubId: string, version?: string): string {
  return `${hubId}:hub:${version ?? ''}`;
}

/**
 * Loads a Team Hub server avatar image data URL, reusing in-memory cache and in-flight requests.
 *
 * @param hubId - Team hub connection id.
 * @param imageUrl - Relative hub avatar image URL from the session payload.
 * @returns Data URL for the hub avatar image.
 */
export async function loadTeamHubServerAvatarImage(
  hubId: string,
  imageUrl: string
): Promise<string> {
  const version = avatarVersionFromUrl(imageUrl);
  const key = teamHubServerAvatarCacheKey(hubId, version);
  const cached = avatarImageCache.get(key);
  if (cached != null) {
    return cached;
  }

  const inflight = avatarImageInflight.get(key);
  if (inflight != null) {
    return inflight;
  }

  const request = window.api
    .getTeamHubAvatar(hubId, version)
    .then((image) => {
      avatarImageCache.set(key, image.dataUrl);
      avatarImageInflight.delete(key);
      return image.dataUrl;
    })
    .catch((error) => {
      avatarImageInflight.delete(key);
      throw error;
    });

  avatarImageInflight.set(key, request);
  return request;
}

/**
 * Seeds the server avatar cache with a known data URL after a successful upload.
 *
 * @param hubId - Team hub connection id.
 * @param imageUrl - Relative hub avatar image URL returned by the update API.
 * @param dataUrl - Cropped image data URL that was just persisted.
 */
export function primeTeamHubServerAvatarImage(
  hubId: string,
  imageUrl: string,
  dataUrl: string
): void {
  const version = avatarVersionFromUrl(imageUrl);
  const key = teamHubServerAvatarCacheKey(hubId, version);
  avatarImageCache.set(key, dataUrl);
}
