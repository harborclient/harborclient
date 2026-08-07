import { describe, expect, it } from 'vitest';
import {
  buildDeviceKeyRecord,
  formatDeviceKeyFingerprintPrefix,
  hashDeviceKeyFingerprint,
  validateCreateDeviceKeyInput
} from '#/db/deviceKeyLogic.js';

describe('deviceKeyLogic', () => {
  it('hashes public key material deterministically', () => {
    const fingerprint = hashDeviceKeyFingerprint('dGVzdC1rZXk=');
    expect(fingerprint).toHaveLength(64);
    expect(formatDeviceKeyFingerprintPrefix(fingerprint)).toHaveLength(8);
  });

  it('builds a device key record with identity-v1 defaults', () => {
    const record = buildDeviceKeyRecord(
      {
        userId: 'user-1',
        deviceId: '550e8400-e29b-41d4-a716-446655440000',
        label: 'Alice laptop',
        publicKeyMaterial: 'dGVzdC1rZXk='
      },
      'user-1'
    );

    expect(record.keyFormat).toBe('identity-v1');
    expect(record.revokedAt).toBeNull();
    expect(record.fingerprint).toBe(hashDeviceKeyFingerprint('dGVzdC1rZXk='));
  });

  it('rejects invalid enrollment input', () => {
    expect(() =>
      validateCreateDeviceKeyInput({
        userId: 'user-1',
        deviceId: 'not-a-uuid',
        label: 'Alice laptop',
        publicKeyMaterial: 'dGVzdC1rZXk='
      })
    ).toThrow(/UUID v4/);
  });
});
