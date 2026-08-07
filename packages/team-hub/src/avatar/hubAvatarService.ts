import {
  type AvatarColorKey,
  type AvatarPresentation,
  defaultAvatarPresentation,
  hasPersistedAvatar,
  normalizeAvatarColor,
  normalizeAvatarInitials
} from '#/avatar/avatarPresentation.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { TenantRecord } from '#/db/types.js';
import { ValidationError } from '#/server/admin/userValidation.js';

/**
 * Hub avatar metadata exposed on session and admin routes.
 */
export interface HubAvatarMetadata extends AvatarPresentation {
  /**
   * Human-readable hub/tenant display name.
   */
  name: string;
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
}

/**
 * Resolves hub avatar presentation from a tenant record, using persisted values
 * when present or computing defaults without writing.
 *
 * @param tenant - Tenant record for the active hub namespace.
 * @returns Avatar initials, color, and display name.
 */
export function resolveHubAvatarFromTenant(tenant: TenantRecord): HubAvatarMetadata {
  if (hasPersistedAvatar(tenant.avatarInitials, tenant.avatarColor)) {
    return {
      name: tenant.name,
      initials: tenant.avatarInitials!.trim(),
      color: tenant.avatarColor!.trim() as AvatarColorKey
    };
  }

  const defaults = defaultAvatarPresentation(tenant.name, tenant.id);
  return {
    name: tenant.name,
    initials: defaults.initials,
    color: defaults.color
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
 * Updates hub avatar presentation for a tenant namespace.
 *
 * @param db - Root database handle used for global tenant records.
 * @param tenantId - Tenant namespace to update.
 * @param input - Replacement initials and/or color.
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
  if (input.initials == null && input.color == null) {
    throw new ValidationError('At least one of initials or color is required.');
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

  const updated = await db.updateTenantAvatar(tenantId, initials, color, actingUserId);
  return resolveHubAvatarFromTenant(updated);
}
