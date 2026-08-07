import { createHash, randomUUID } from 'node:crypto';
import type { CreateDeviceKeyInput, DeviceKeyFormat, DeviceKeyRecord } from '#/db/types.js';

/**
 * Maximum length for device labels shown in admin listings.
 */
export const MAX_DEVICE_KEY_LABEL_LENGTH = 128;

/**
 * Maximum byte length accepted for base64 public key material payloads.
 */
export const MAX_DEVICE_KEY_PUBLIC_MATERIAL_LENGTH = 65_536;

const DEVICE_KEY_FORMATS: DeviceKeyFormat[] = ['identity-v1', 'mls-key-package'];
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Computes the sha256 fingerprint used to identify uploaded public key material.
 *
 * @param publicKeyMaterial - Base64-encoded public payload from the client.
 * @returns Lowercase hex digest.
 */
export function hashDeviceKeyFingerprint(publicKeyMaterial: string): string {
  return createHash('sha256').update(publicKeyMaterial, 'utf8').digest('hex');
}

/**
 * Returns a short fingerprint prefix suitable for operator listings.
 *
 * @param fingerprint - Full sha256 hex digest.
 * @returns First eight characters of the digest.
 */
export function formatDeviceKeyFingerprintPrefix(fingerprint: string): string {
  return fingerprint.slice(0, 8);
}

/**
 * Validates client enrollment input before persisting public key material.
 *
 * @param input - Enrollment payload from an authenticated device.
 * @throws Error When any field is missing or out of range.
 */
export function validateCreateDeviceKeyInput(input: CreateDeviceKeyInput): void {
  const label = input.label.trim();
  if (label.length === 0) {
    throw new Error('Device label is required');
  }

  if (label.length > MAX_DEVICE_KEY_LABEL_LENGTH) {
    throw new Error(`Device label must be at most ${MAX_DEVICE_KEY_LABEL_LENGTH} characters`);
  }

  if (!UUID_V4_PATTERN.test(input.deviceId)) {
    throw new Error('Device id must be a UUID v4 value');
  }

  const publicKeyMaterial = input.publicKeyMaterial.trim();
  if (publicKeyMaterial.length === 0) {
    throw new Error('Public key material is required');
  }

  if (publicKeyMaterial.length > MAX_DEVICE_KEY_PUBLIC_MATERIAL_LENGTH) {
    throw new Error('Public key material is too large');
  }

  const keyFormat = input.keyFormat ?? 'identity-v1';
  if (!DEVICE_KEY_FORMATS.includes(keyFormat)) {
    throw new Error('Unsupported device key format');
  }
}

/**
 * Builds a persisted device key record from validated enrollment input.
 *
 * @param input - Enrollment payload from an authenticated device.
 * @param actingUserId - User performing the enrollment action.
 * @returns Device key record ready for database insertion.
 */
export function buildDeviceKeyRecord(
  input: CreateDeviceKeyInput,
  actingUserId: string
): DeviceKeyRecord {
  validateCreateDeviceKeyInput(input);

  const now = new Date();
  const publicKeyMaterial = input.publicKeyMaterial.trim();

  return {
    id: randomUUID(),
    userId: input.userId,
    deviceId: input.deviceId,
    label: input.label.trim(),
    keyFormat: input.keyFormat ?? 'identity-v1',
    publicKeyMaterial,
    fingerprint: hashDeviceKeyFingerprint(publicKeyMaterial),
    createdAt: now,
    lastSeenAt: now,
    revokedAt: null,
    createdByUserId: actingUserId,
    updatedByUserId: actingUserId
  };
}
