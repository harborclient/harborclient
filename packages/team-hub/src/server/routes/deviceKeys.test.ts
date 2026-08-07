import { describe, expect, it } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import type { DeviceKeyRecord } from '#/db/types.js';
import { hashDeviceKeyFingerprint } from '#/db/deviceKeyLogic.js';
import {
  authHeader,
  createProtectedTestApp,
  sampleUserRecord
} from '#/server/routes/test/createTestApp.js';
import { DEVICE_ENROLLMENT_DISABLED_MESSAGE } from '#/server/routes/deviceKeys.js';

const sampleDeviceId = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Builds a device key fixture for route tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns Device key record fixture.
 */
function sampleDeviceKey(overrides: Partial<DeviceKeyRecord> = {}): DeviceKeyRecord {
  const publicKeyMaterial = 'dGVzdC1rZXk=';
  return {
    id: 'device-key-1',
    userId: sampleUserRecord.id,
    deviceId: sampleDeviceId,
    label: 'Alice laptop',
    keyFormat: 'identity-v1',
    publicKeyMaterial,
    fingerprint: hashDeviceKeyFingerprint(publicKeyMaterial),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    lastSeenAt: new Date('2026-01-01T00:00:00.000Z'),
    revokedAt: null,
    createdByUserId: sampleUserRecord.id,
    updatedByUserId: sampleUserRecord.id,
    ...overrides
  };
}

describe('device key routes', () => {
  it('rejects enrollment when discussion E2EE is disabled', async () => {
    const db = createStubDatabase();
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const response = await app.inject({
      method: 'POST',
      url: '/devices',
      headers: authHeader(),
      payload: {
        deviceId: sampleDeviceId,
        label: 'Alice laptop',
        publicKeyMaterial: 'dGVzdC1rZXk='
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: DEVICE_ENROLLMENT_DISABLED_MESSAGE });
    expect(db.createDeviceKey).not.toHaveBeenCalled();
  });

  it('enrolls a device on an E2EE hub', async () => {
    const db = createStubDatabase();
    db.findActiveDeviceKeyByUserAndDeviceId.mockResolvedValue(null);
    db.createDeviceKey.mockResolvedValue(undefined);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/devices',
      headers: authHeader(),
      payload: {
        deviceId: sampleDeviceId,
        label: 'Alice laptop',
        publicKeyMaterial: 'dGVzdC1rZXk='
      }
    });

    expect(response.statusCode).toBe(201);
    expect(db.createDeviceKey).toHaveBeenCalledOnce();
    expect(response.json().device).toMatchObject({
      userId: sampleUserRecord.id,
      deviceId: sampleDeviceId,
      label: 'Alice laptop',
      keyFormat: 'identity-v1',
      revokedAt: null
    });
  });

  it('returns conflict when the same device id is already enrolled', async () => {
    const db = createStubDatabase();
    db.findActiveDeviceKeyByUserAndDeviceId.mockResolvedValue(sampleDeviceKey());
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/devices',
      headers: authHeader(),
      payload: {
        deviceId: sampleDeviceId,
        label: 'Alice laptop',
        publicKeyMaterial: 'dGVzdC1rZXk='
      }
    });

    expect(response.statusCode).toBe(409);
    expect(db.createDeviceKey).not.toHaveBeenCalled();
  });

  it('lists the authenticated user devices on an E2EE hub', async () => {
    const db = createStubDatabase();
    db.listDeviceKeysByUserId.mockResolvedValue([sampleDeviceKey()]);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/devices',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().devices).toHaveLength(1);
    expect(db.listDeviceKeysByUserId).toHaveBeenCalledWith(sampleUserRecord.id);
  });

  it('revokes the authenticated user device', async () => {
    const db = createStubDatabase();
    db.findDeviceKeyById.mockResolvedValue(sampleDeviceKey());
    db.revokeDeviceKey.mockResolvedValue(true);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const response = await app.inject({
      method: 'DELETE',
      url: '/devices/device-key-1',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(204);
    expect(db.revokeDeviceKey).toHaveBeenCalledWith('device-key-1', sampleUserRecord.id);
  });

  it('allows admins to revoke another user device', async () => {
    const db = createStubDatabase();
    db.findDeviceKeyById.mockResolvedValue(sampleDeviceKey());
    db.revokeDeviceKey.mockResolvedValue(true);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true },
      user: { ...sampleUserRecord, id: 'admin-1', role: 'admin' }
    });

    const response = await app.inject({
      method: 'DELETE',
      url: '/admin/device-keys/device-key-1',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(204);
    expect(db.revokeDeviceKey).toHaveBeenCalledWith('device-key-1', 'admin-1');
  });

  it('forbids non-admin users from admin device revocation', async () => {
    const db = createStubDatabase();
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const response = await app.inject({
      method: 'DELETE',
      url: '/admin/device-keys/device-key-1',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(403);
    expect(db.revokeDeviceKey).not.toHaveBeenCalled();
  });
});
