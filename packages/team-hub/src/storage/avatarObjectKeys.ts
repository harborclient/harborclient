/**
 * Maps an avatar MIME type to a stable object-key file extension.
 *
 * @param mime - Image MIME type (for example `image/jpeg`).
 * @returns Extension including the leading dot.
 */
export function avatarExtensionForMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.bin';
  }
}

/**
 * Builds the object key for a hub (tenant) avatar image.
 *
 * @param prefix - Configured storage prefix (no leading/trailing slashes).
 * @param tenantId - Tenant namespace owning the hub avatar.
 * @param mime - Image MIME type used to choose a file extension.
 * @returns Object key under the bucket.
 */
export function buildHubAvatarObjectKey(prefix: string, tenantId: string, mime: string): string {
  const ext = avatarExtensionForMime(mime);
  return `${prefix}/tenants/${tenantId}/hub/avatar${ext}`;
}

/**
 * Builds the object key for a user avatar image.
 *
 * @param prefix - Configured storage prefix (no leading/trailing slashes).
 * @param tenantId - Tenant namespace owning the user.
 * @param userId - User account id.
 * @param mime - Image MIME type used to choose a file extension.
 * @returns Object key under the bucket.
 */
export function buildUserAvatarObjectKey(
  prefix: string,
  tenantId: string,
  userId: string,
  mime: string
): string {
  const ext = avatarExtensionForMime(mime);
  return `${prefix}/tenants/${tenantId}/users/${userId}/avatar${ext}`;
}
