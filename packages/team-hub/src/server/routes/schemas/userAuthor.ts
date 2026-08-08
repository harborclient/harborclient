import type { UserRecord } from '#/db/types.js';
import { resolveUserAvatarFromRecord } from '#/avatar/userAvatarService.js';

/**
 * Author metadata embedded in discussion and notice API responses.
 */
export interface UserAuthorMetadata {
  /**
   * Stable user account identifier.
   */
  id: string;

  /**
   * Display name for the author or actor.
   */
  name: string;

  /**
   * Avatar initials tile text.
   */
  avatarInitials: string;

  /**
   * Persisted avatar background color key (for example `sky-600`).
   */
  avatarColor: string;

  /**
   * Relative URL for the uploaded avatar image when present.
   */
  avatarImageUrl?: string;
}

/**
 * Discussion author payload with nested avatar metadata.
 */
export interface DiscussionAuthorPayload {
  /**
   * Stable user account identifier.
   */
  id: string;

  /**
   * Display name for the author.
   */
  name: string;

  /**
   * Avatar presentation for discussion list rendering.
   */
  avatar?: {
    /**
     * One or two uppercase initials.
     */
    initials: string;

    /**
     * Persisted palette color key.
     */
    color: string;

    /**
     * Relative URL for the uploaded avatar image when present.
     */
    imageUrl?: string;
  };
}

/**
 * Serializes flat author metadata for notice-style responses.
 *
 * @param user - User record resolved from the database layer.
 * @returns Author id, name, and avatar fields without extra lookups.
 */
export function serializeUserAuthorMetadata(user: UserRecord): UserAuthorMetadata {
  const avatar = resolveUserAvatarFromRecord(user);
  return {
    id: user.id,
    name: user.name,
    avatarInitials: avatar.initials,
    avatarColor: avatar.color,
    ...(avatar.imageUrl ? { avatarImageUrl: avatar.imageUrl } : {})
  };
}

/**
 * Serializes discussion author metadata with nested avatar presentation.
 *
 * @param user - User record resolved from the database layer.
 * @returns Author payload matching {@link @harborclient/team-hub-api} discussion shapes.
 */
export function serializeDiscussionAuthor(user: UserRecord): DiscussionAuthorPayload {
  const avatar = resolveUserAvatarFromRecord(user);
  return {
    id: user.id,
    name: user.name,
    avatar: {
      initials: avatar.initials,
      color: avatar.color,
      ...(avatar.imageUrl ? { imageUrl: avatar.imageUrl } : {})
    }
  };
}

/**
 * Serializes fallback author metadata when the backing user record is missing.
 *
 * @param userId - Author user id when known, otherwise null for anonymous rows.
 * @returns Minimal author payload without avatar presentation.
 */
export function serializeUnknownDiscussionAuthor(userId: string | null): DiscussionAuthorPayload {
  return {
    id: userId ?? '',
    name: 'Unknown user'
  };
}
