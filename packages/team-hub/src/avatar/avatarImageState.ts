/**
 * Fields used to decide whether an uploaded avatar image is present.
 */
export interface AvatarImageFields {
  /**
   * Legacy base64 image payload stored in the database.
   */
  avatarImage: string | null;

  /**
   * Object-store key when external blob storage is used.
   */
  avatarImageKey: string | null;

  /**
   * Image MIME type.
   */
  avatarImageMime: string | null;

  /**
   * Timestamp when the image was last replaced.
   */
  avatarImageUpdatedAt: Date | null;
}

/**
 * Returns true when the record has a persisted avatar image (DB blob or object key).
 *
 * @param fields - Avatar image columns from a user or tenant record.
 */
export function hasPersistedAvatarImage(fields: AvatarImageFields): boolean {
  if (fields.avatarImageMime == null || fields.avatarImageMime.length === 0) {
    return false;
  }

  if (fields.avatarImageUpdatedAt == null) {
    return false;
  }

  const hasKey = fields.avatarImageKey != null && fields.avatarImageKey.length > 0;
  const hasBlob = fields.avatarImage != null && fields.avatarImage.length > 0;
  return hasKey || hasBlob;
}
