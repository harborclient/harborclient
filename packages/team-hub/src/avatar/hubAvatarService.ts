import {
  type AvatarColorKey,
  type AvatarPresentation,
  defaultAvatarPresentation,
  hasPersistedAvatar,
  normalizeAvatarColor,
  normalizeAvatarInitials
} from '#/avatar/avatarPresentation.js';
import { parseAvatarImageDataUrl } from '#/avatar/userAvatarService.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { TenantAvatarImageUpdate, TenantRecord } from '#/db/types.js';
import { ValidationError } from '#/server/admin/userValidation.js';

/**
 * Hub avatar metadata exposed on session and admin routes.
 */
export interface HubAvatarMetadata extends AvatarPresentation {
  /**
   * Human-readable hub/tenant display name.
   */
  name: string;

  /**
   * Relative URL for the uploaded hub avatar image when present.
   */
  imageUrl?: string;
}

/**
 * Optional fields accepted when an admin updates hub avatar presentation.
 */
export interface UpdateHubAvatarInput {
  /**
   * Replacement initials tile text.
   */
  initials?: string;

  /**
   * Replacement palette color key.
   */
  color?: AvatarColorKey;

  /**
   * Cropped hub avatar image as a data URL (`data:image/…;base64,…`).
   *
   * Pass `null` to clear a previously uploaded image.
   */
  imageDataUrl?: string | null;
}

/**
 * Builds a relative hub avatar image URL with a cache-busting version query.
 *
 * @param updatedAt - Timestamp when the image was last replaced.
 * @returns Relative path suitable for API clients to resolve against the hub base URL.
 */
export function buildHubAvatarImageUrl(updatedAt: Date): string {
  return `/auth/hub/avatar?v=${updatedAt.getTime()}`;
}

/**
 * Returns the relative hub avatar image URL when an image is persisted on the tenant.
 *
 * @param tenant - Tenant record that may include uploaded image fields.
 * @returns Relative image URL, or undefined when no image is stored.
 */
export function resolveHubAvatarImageUrl(tenant: TenantRecord): string | undefined {
  if (
    tenant.avatarImage == null ||
    tenant.avatarImage.length === 0 ||
    tenant.avatarImageMime == null ||
    tenant.avatarImageUpdatedAt == null
  ) {
    return undefined;
  }

  return buildHubAvatarImageUrl(tenant.avatarImageUpdatedAt);
}

/**
 * Resolves hub avatar presentation from a tenant record, using persisted values
 * when present or computing defaults without writing.
 *
 * @param tenant - Tenant record for the active hub namespace.
 * @returns Avatar initials, color, optional image URL, and display name.
 */
export function resolveHubAvatarFromTenant(tenant: TenantRecord): HubAvatarMetadata {
  const imageUrl = resolveHubAvatarImageUrl(tenant);

  if (hasPersistedAvatar(tenant.avatarInitials, tenant.avatarColor)) {
    return {
      name: tenant.name,
      initials: tenant.avatarInitials!.trim(),
      color: tenant.avatarColor!.trim() as AvatarColorKey,
      ...(imageUrl ? { imageUrl } : {})
    };
  }

  const defaults = defaultAvatarPresentation(tenant.name, tenant.id);
  return {
    name: tenant.name,
    initials: defaults.initials,
    color: defaults.color,
    ...(imageUrl ? { imageUrl } : {})
  };
}

/**
 * Ensures the tenant has persisted hub avatar fields, assigning defaults when missing.
 *
 * @param db - Root database handle used for global tenant records.
 * @param tenantId - Effective tenant namespace for the session.
 * @returns Persisted hub avatar metadata.
 * @throws {Error} When the tenant record does not exist.
 */
export async function ensureHubAvatar(db: IDatabase, tenantId: string): Promise<HubAvatarMetadata> {
  const tenant = await db.findTenantById(tenantId);
  if (!tenant) {
    throw new Error('Tenant not found.');
  }

  if (hasPersistedAvatar(tenant.avatarInitials, tenant.avatarColor)) {
    return resolveHubAvatarFromTenant(tenant);
  }

  const defaults = defaultAvatarPresentation(tenant.name, tenant.id);
  const updated = await db.updateTenantAvatar(tenant.id, defaults.initials, defaults.color, null);

  return resolveHubAvatarFromTenant(updated);
}

/**
 * Updates hub avatar presentation and/or uploaded image for a tenant namespace.
 *
 * @param db - Root database handle used for global tenant records.
 * @param tenantId - Tenant namespace to update.
 * @param input - Replacement initials, color, and/or image data URL.
 * @param actingUserId - Admin performing the update.
 * @returns Updated hub avatar metadata.
 * @throws {Error} When the tenant is missing or input is invalid.
 */
export async function updateHubAvatar(
  db: IDatabase,
  tenantId: string,
  input: UpdateHubAvatarInput,
  actingUserId: string
): Promise<HubAvatarMetadata> {
  if (input.initials == null && input.color == null && input.imageDataUrl === undefined) {
    throw new ValidationError('At least one of initials, color, or imageDataUrl is required.');
  }

  const tenant = await db.findTenantById(tenantId);
  if (!tenant) {
    throw new ValidationError('Tenant not found.');
  }

  const current = resolveHubAvatarFromTenant(tenant);
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

  let image: TenantAvatarImageUpdate | undefined;
  if (input.imageDataUrl === null) {
    image = { imageBase64: null, mime: null, updatedAt: null };
  } else if (input.imageDataUrl !== undefined) {
    const decoded = parseAvatarImageDataUrl(input.imageDataUrl);
    image = {
      imageBase64: decoded.base64,
      mime: decoded.mime,
      updatedAt: new Date()
    };
  }

  const updated = await db.updateTenantAvatar(tenantId, initials, color, actingUserId, image);
  return resolveHubAvatarFromTenant(updated);
}
