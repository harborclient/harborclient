import {
  type AvatarColorKey,
  type AvatarPresentation,
  defaultAvatarPresentation,
  hasPersistedAvatar,
  normalizeAvatarColor,
  normalizeAvatarInitials
} from '#/avatar/avatarPresentation.js';
import { hasPersistedAvatarImage } from '#/avatar/avatarImageState.js';
import type { StorageConfig } from '#/config/storageConfig.js';
import { isExternalBlobStorage } from '#/config/storageConfig.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { UserRecord } from '#/db/types.js';
import { ValidationError } from '#/server/admin/userValidation.js';
import { buildUserAvatarObjectKey } from '#/storage/avatarObjectKeys.js';
import type { IBlobStorage } from '#/storage/IBlobStorage.js';

/**
 * Optional object-storage dependencies for avatar image persistence.
 */
export interface AvatarBlobStorageOptions {
  /**
   * Normalized storage configuration from server.yaml.
   */
  storage: StorageConfig;

  /**
   * Blob storage client for the active driver.
   */
  blobStorage: IBlobStorage;
}

/**
 * Maximum accepted uploaded avatar image size in bytes (~200 KB).
 */
export const MAX_AVATAR_IMAGE_BYTES = 200 * 1024;

/**
 * MIME types accepted for uploaded user avatar images.
 */
export const ALLOWED_AVATAR_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
] as const;

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

  /**
   * Relative URL for the uploaded avatar image when present.
   */
  imageUrl?: string;
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

  /**
   * Cropped avatar image as a data URL (`data:image/…;base64,…`).
   *
   * Pass `null` to clear a previously uploaded image.
   */
  imageDataUrl?: string | null;
}

/**
 * Decoded avatar image payload ready for persistence.
 */
export interface DecodedAvatarImage {
  /**
   * Image MIME type.
   */
  mime: string;

  /**
   * Base64-encoded image bytes.
   */
  base64: string;

  /**
   * Raw decoded byte length used for size validation.
   */
  byteLength: number;
}

/**
 * Builds a relative avatar image URL with a cache-busting version query.
 *
 * @param userId - User account identifier.
 * @param updatedAt - Timestamp when the image was last replaced.
 * @returns Relative path suitable for API clients to resolve against the hub base URL.
 */
export function buildUserAvatarImageUrl(userId: string, updatedAt: Date): string {
  return `/auth/users/${encodeURIComponent(userId)}/avatar?v=${updatedAt.getTime()}`;
}

/**
 * Returns the relative avatar image URL for a user when an image is persisted.
 *
 * @param user - User record that may include uploaded image fields.
 * @returns Relative image URL, or undefined when no image is stored.
 */
export function resolveUserAvatarImageUrl(user: UserRecord): string | undefined {
  if (!hasPersistedAvatarImage(user) || user.avatarImageUpdatedAt == null) {
    return undefined;
  }

  return buildUserAvatarImageUrl(user.id, user.avatarImageUpdatedAt);
}

/**
 * Parses and validates an avatar image data URL.
 *
 * @param imageDataUrl - Data URL produced by the client cropper.
 * @returns Decoded MIME type and base64 payload.
 * @throws {ValidationError} When the payload is missing, malformed, oversized, or not an image.
 */
export function parseAvatarImageDataUrl(imageDataUrl: string): DecodedAvatarImage {
  const trimmed = imageDataUrl.trim();
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(trimmed);
  if (!match) {
    throw new ValidationError('Avatar image must be a base64 image data URL.');
  }

  const mime = match[1]!.toLowerCase();
  if (
    !(ALLOWED_AVATAR_IMAGE_MIME_TYPES as readonly string[]).includes(mime) &&
    mime !== 'image/jpg'
  ) {
    throw new ValidationError(
      `Avatar image type "${mime}" is not supported. Use JPEG, PNG, WebP, or GIF.`
    );
  }

  const base64 = match[2]!.replace(/\s+/g, '');
  let byteLength: number;
  try {
    byteLength = Buffer.from(base64, 'base64').byteLength;
  } catch {
    throw new ValidationError('Avatar image payload is not valid base64.');
  }

  if (byteLength === 0) {
    throw new ValidationError('Avatar image payload is empty.');
  }

  if (byteLength > MAX_AVATAR_IMAGE_BYTES) {
    throw new ValidationError(
      `Avatar image exceeds the maximum size of ${MAX_AVATAR_IMAGE_BYTES} bytes.`
    );
  }

  return {
    mime: mime === 'image/jpg' ? 'image/jpeg' : mime,
    base64,
    byteLength
  };
}

/**
 * Resolves avatar presentation from a user record, using persisted values when
 * present or computing defaults without writing.
 *
 * @param user - User record from the database layer.
 * @returns Avatar initials, color, optional image URL, id, and display name.
 */
export function resolveUserAvatarFromRecord(user: UserRecord): UserAvatarMetadata {
  const imageUrl = resolveUserAvatarImageUrl(user);

  if (hasPersistedAvatar(user.avatarInitials, user.avatarColor)) {
    return {
      id: user.id,
      name: user.name,
      initials: user.avatarInitials!.trim(),
      color: user.avatarColor!.trim() as AvatarColorKey,
      ...(imageUrl ? { imageUrl } : {})
    };
  }

  const defaults = defaultAvatarPresentation(user.name, user.id);
  return {
    id: user.id,
    name: user.name,
    initials: defaults.initials,
    color: defaults.color,
    ...(imageUrl ? { imageUrl } : {})
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
 * Updates avatar presentation and/or uploaded image for a user account.
 *
 * @param db - Tenant-scoped database handle.
 * @param userId - User account to update.
 * @param input - Replacement initials, color, and/or image data URL.
 * @param actingUserId - User performing the update.
 * @param blobOptions - Optional external blob storage wiring.
 * @returns Updated avatar metadata.
 * @throws {ValidationError} When input is invalid.
 * @throws {Error} When the user is missing.
 */
export async function updateUserAvatar(
  db: IDatabase,
  userId: string,
  input: UpdateUserAvatarInput,
  actingUserId: string,
  blobOptions?: AvatarBlobStorageOptions
): Promise<UserAvatarMetadata> {
  if (input.initials == null && input.color == null && input.imageDataUrl === undefined) {
    throw new ValidationError('At least one of initials, color, or imageDataUrl is required.');
  }

  const user = await db.findUserById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  const current = resolveUserAvatarFromRecord(user);
  let initials = current.initials;
  let color = current.color;

  try {
    if (input.initials != null) {
      initials = normalizeAvatarInitials(input.initials);
    }
    if (input.color != null) {
      color = normalizeAvatarColor(input.color);
    }
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : String(error));
  }

  const patch: {
    avatarInitials: string;
    avatarColor: AvatarColorKey;
    avatarImage?: string | null;
    avatarImageKey?: string | null;
    avatarImageMime?: string | null;
    avatarImageUpdatedAt?: Date | null;
  } = {
    avatarInitials: initials,
    avatarColor: color
  };

  const useExternal = blobOptions != null && isExternalBlobStorage(blobOptions.storage);

  if (input.imageDataUrl === null) {
    if (useExternal && user.avatarImageKey) {
      await blobOptions!.blobStorage.deleteObject(user.avatarImageKey);
    }
    patch.avatarImage = null;
    patch.avatarImageKey = null;
    patch.avatarImageMime = null;
    patch.avatarImageUpdatedAt = null;
  } else if (input.imageDataUrl !== undefined) {
    const decoded = parseAvatarImageDataUrl(input.imageDataUrl);
    const updatedAt = new Date();

    if (useExternal) {
      const key = buildUserAvatarObjectKey(
        blobOptions!.storage.prefix,
        db.getTenantId(),
        userId,
        decoded.mime
      );
      const bytes = Buffer.from(decoded.base64, 'base64');
      await blobOptions!.blobStorage.putObject(key, bytes, decoded.mime);
      if (user.avatarImageKey && user.avatarImageKey !== key) {
        await blobOptions!.blobStorage.deleteObject(user.avatarImageKey);
      }
      patch.avatarImage = null;
      patch.avatarImageKey = key;
      patch.avatarImageMime = decoded.mime;
      patch.avatarImageUpdatedAt = updatedAt;
    } else {
      patch.avatarImage = decoded.base64;
      patch.avatarImageKey = null;
      patch.avatarImageMime = decoded.mime;
      patch.avatarImageUpdatedAt = updatedAt;
    }
  }

  const updated = await db.updateUser(userId, patch, actingUserId);
  return resolveUserAvatarFromRecord(updated);
}
