import { z } from 'zod';
import type { DeviceKeyRecord } from '#/db/types.js';
import { formatDeviceKeyFingerprintPrefix } from '#/db/deviceKeyLogic.js';
import { timestampSchema } from '#/server/routes/schemas/common.js';

/**
 * Supported public key material formats for device enrollment payloads.
 */
export const deviceKeyFormatSchema = z.enum(['identity-v1', 'mls-key-package']);

/**
 * Device key metadata returned by enrollment and admin routes.
 */
export const hubDeviceKeyRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  deviceId: z.string(),
  label: z.string(),
  keyFormat: deviceKeyFormatSchema,
  fingerprint: z.string(),
  fingerprintPrefix: z.string(),
  createdAt: timestampSchema,
  lastSeenAt: timestampSchema.nullable(),
  revokedAt: timestampSchema.nullable()
});

/**
 * Request body schema for `POST /devices`.
 */
export const enrollDeviceBodySchema = z.object({
  deviceId: z.string().uuid(),
  label: z.string().trim().min(1),
  publicKeyMaterial: z.string().trim().min(1),
  keyFormat: deviceKeyFormatSchema.optional()
});

/**
 * Response body schema for `POST /devices`.
 */
export const enrolledDeviceResponseSchema = z.object({
  device: hubDeviceKeyRecordSchema
});

/**
 * Response body schema for `GET /devices` and admin device listings.
 */
export const listDeviceKeysResponseSchema = z.object({
  devices: z.array(hubDeviceKeyRecordSchema)
});

/**
 * Serializes a device key record for REST responses without exposing public key bytes.
 *
 * @param record - Device enrollment record from the database.
 * @returns Client-safe device key payload.
 */
export function serializeDeviceKey(record: DeviceKeyRecord) {
  return hubDeviceKeyRecordSchema.parse({
    id: record.id,
    userId: record.userId,
    deviceId: record.deviceId,
    label: record.label,
    keyFormat: record.keyFormat,
    fingerprint: record.fingerprint,
    fingerprintPrefix: formatDeviceKeyFingerprintPrefix(record.fingerprint),
    createdAt: record.createdAt.toISOString(),
    lastSeenAt: record.lastSeenAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null
  });
}
