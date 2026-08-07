import type { DeviceKeyFormat, DeviceKeyRecord } from '#/db/types.js';

/**
 * SQL row shape returned by relational backends for the device_keys table.
 */
export interface DeviceKeySqlRow {
  /**
   * Primary key identifier.
   */
  id: string;

  /**
   * Owning user identifier column.
   */
  user_id: string;

  /**
   * Client-generated device identifier column.
   */
  device_id: string;

  /**
   * Human-readable label column.
   */
  label: string;

  /**
   * Public key format column.
   */
  key_format: string;

  /**
   * Base64 public key material column.
   */
  public_key_material: string;

  /**
   * sha256 fingerprint column.
   */
  fingerprint: string;

  /**
   * Creation timestamp column.
   */
  created_at: Date;

  /**
   * Last-seen timestamp column, if any.
   */
  last_seen_at: Date | null;

  /**
   * Revocation timestamp column, if any.
   */
  revoked_at: Date | null;

  /**
   * Creating user identifier column.
   */
  created_by_user_id: string | null;

  /**
   * Last updating user identifier column.
   */
  updated_by_user_id: string | null;
}

/**
 * Column list shared by relational device key SELECT queries.
 */
export const DEVICE_KEY_SELECT_COLUMNS = `id, user_id, device_id, label, key_format, public_key_material, fingerprint, created_at, last_seen_at, revoked_at, created_by_user_id, updated_by_user_id`;

/**
 * Maps a snake_case SQL row to the shared {@link DeviceKeyRecord} shape.
 *
 * @param row - Database row from device_keys.
 * @returns Normalized device key record for application code.
 */
export function mapDeviceKeySqlRow(row: DeviceKeySqlRow): DeviceKeyRecord {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    label: row.label,
    keyFormat: row.key_format as DeviceKeyFormat,
    publicKeyMaterial: row.public_key_material,
    fingerprint: row.fingerprint,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
    createdByUserId: row.created_by_user_id ?? null,
    updatedByUserId: row.updated_by_user_id ?? null
  };
}
