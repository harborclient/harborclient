import {
  type AvatarColorKey,
  type AvatarPresentation,
  defaultAvatarPresentation,
  hasPersistedAvatar,
  normalizeAvatarColor,
  normalizeAvatarInitials
} from '#/avatar/avatarPresentation.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { UserRecord } from '#/db/types.js';

/**
 * User avatar metadata exposed on session, admin, and author payloads.
 */
export interface UserAvatarMetadata extends AvatarPresentation {
  /**
   * Stable user account identifier.
   */
  id: string;

  /**
   * Unique display name for the account.
   */
  name: string;
}

/**
 * Optional fields accepted when updating user avatar presentation.
 */
export interface UpdateUserAvatarInput {
  /**
   * Replacement initials tile text.
   */
  initials?: string;

  /**
   * Replacement palette color key.
   */
  color?: AvatarColorKey;
}

/**
 * Resolves avatar presentation from a user record, using persisted values when
 * present or computing defaults without writing.
 *
 * @param user - User record from the database layer.
 * @returns Avatar initials, color, id, and display name.
 */
export function resolveUserAvatarFromRecord(user: UserRecord): UserAvatarMetadata {
  if (hasPersistedAvatar(user.avatarInitials, user.avatarColor)) {
    return {
      id: user.id,
      name: user.name,
      initials: user.avatarInitials!.trim(),
      color: user.avatarColor!.trim() as AvatarColorKey
    };
  }

  const defaults = defaultAvatarPresentation(user.name, user.id);
  return {
    id: user.id,
    name: user.name,
    initials: defaults.initials,
    color: defaults.color
  };
}

/**
 * Builds persisted avatar fields for a newly created user account.
 *
 * @param name - Display name used to derive default initials.
 * @param userId - Stable user id used to derive default color.
 * @param overrides - Optional admin-provided avatar overrides.
 * @returns Initials and color suitable for INSERT.
 */
export function buildUserAvatarFieldsForCreate(
  name: string,
  userId: string,
  overrides?: { avatarInitials?: string; avatarColor?: string }
): { avatarInitials: string; avatarColor: AvatarColorKey } {
  const defaults = defaultAvatarPresentation(name, userId);
  return {
    avatarInitials:
      overrides?.avatarInitials != null
        ? normalizeAvatarInitials(overrides.avatarInitials)
        : defaults.initials,
    avatarColor:
      overrides?.avatarColor != null ? normalizeAvatarColor(overrides.avatarColor) : defaults.color
  };
}

/**
 * Ensures the user has persisted avatar fields, assigning defaults when missing.
 *
 * @param db - Tenant-scoped database handle.
 * @param userId - User account to backfill when needed.
 * @returns Persisted avatar metadata.
 * @throws {Error} When the user record does not exist.
 */
export async function ensureUserAvatar(db: IDatabase, userId: string): Promise<UserAvatarMetadata> {
  const user = await db.findUserById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  if (hasPersistedAvatar(user.avatarInitials, user.avatarColor)) {
    return resolveUserAvatarFromRecord(user);
  }

  const defaults = defaultAvatarPresentation(user.name, user.id);
  const updated = await db.updateUser(
    user.id,
    {
      avatarInitials: defaults.initials,
      avatarColor: defaults.color
    },
    userId
  );

  return resolveUserAvatarFromRecord(updated);
}

/**
 * Updates avatar presentation for a user account.
 *
 * @param db - Tenant-scoped database handle.
 * @param userId - User account to update.
 * @param input - Replacement initials and/or color.
 * @param actingUserId - User performing the update.
 * @returns Updated avatar metadata.
 * @throws {Error} When the user is missing or input is invalid.
 */
export async function updateUserAvatar(
  db: IDatabase,
  userId: string,
  input: UpdateUserAvatarInput,
  actingUserId: string
): Promise<UserAvatarMetadata> {
  if (input.initials == null && input.color == null) {
    throw new Error('At least one of initials or color is required.');
  }

  const user = await db.findUserById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  const current = resolveUserAvatarFromRecord(user);
  const initials =
    input.initials == null ? current.initials : normalizeAvatarInitials(input.initials);
  const color = input.color == null ? current.color : normalizeAvatarColor(input.color);

  const updated = await db.updateUser(
    userId,
    {
      avatarInitials: initials,
      avatarColor: color
    },
    actingUserId
  );

  return resolveUserAvatarFromRecord(updated);
}
