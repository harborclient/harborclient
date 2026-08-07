import { describe, expect, it } from 'vitest';
import { avatarColorFromSeed } from '#/avatar/avatarPresentation.js';
import { createStubDatabase } from '#/db/stubDatabase.js';
import type { TenantRecord } from '#/db/types.js';
import {
  authHeader,
  createProtectedTestApp,
  sampleUserRecord
} from '#/server/routes/test/createTestApp.js';

const defaultTenant: TenantRecord = {
  id: '__default__',
  name: 'Default',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdByUserId: null,
  updatedByUserId: null,
  avatarInitials: 'DE',
  avatarColor: 'sky-600'
};

/**
 * Configures tenant avatar mocks used by session and admin route tests.
 *
 * @param db - Database stub for protected route tests.
 */
function mockDefaultTenantAvatar(db: ReturnType<typeof createStubDatabase>): void {
  db.findTenantById.mockResolvedValue(defaultTenant);
}

describe('GET /auth/session hub avatar', () => {
  it('includes persisted hub avatar metadata in the session payload', async () => {
    const db = createStubDatabase();
    mockDefaultTenantAvatar(db);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      user: sampleUserRecord
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      hub: {
        name: 'Default',
        initials: 'DE',
        color: 'sky-600'
      }
    });

    await app.close();
  });

  it('auto-assigns and persists default hub avatar when fields are missing', async () => {
    const db = createStubDatabase();
    db.findTenantById.mockResolvedValue({
      ...defaultTenant,
      avatarInitials: null,
      avatarColor: null
    });
    db.updateTenantAvatar.mockResolvedValue({
      ...defaultTenant,
      avatarInitials: 'DE',
      avatarColor: avatarColorFromSeed('__default__')
    });

    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      user: sampleUserRecord
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().hub).toEqual({
      name: 'Default',
      initials: 'DE',
      color: avatarColorFromSeed('__default__')
    });
    expect(db.updateTenantAvatar).toHaveBeenCalledWith(
      '__default__',
      'DE',
      avatarColorFromSeed('__default__'),
      null
    );

    await app.close();
  });
});

describe('PUT /admin/hub/avatar', () => {
  it('updates hub avatar for admin-role tokens', async () => {
    const db = createStubDatabase();
    mockDefaultTenantAvatar(db);
    db.updateTenantAvatar.mockResolvedValue({
      ...defaultTenant,
      avatarInitials: 'HH',
      avatarColor: 'amber-600',
      updatedByUserId: sampleUserRecord.id
    });

    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      user: {
        ...sampleUserRecord,
        role: 'admin',
        collectionAccess: [],
        environmentAccess: [],
        snippetAccess: []
      }
    });

    const response = await app.inject({
      method: 'PUT',
      url: '/admin/hub/avatar',
      headers: authHeader(),
      payload: { initials: 'hh', color: 'amber-600' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      name: 'Default',
      initials: 'HH',
      color: 'amber-600'
    });
    expect(db.updateTenantAvatar).toHaveBeenCalledWith(
      '__default__',
      'HH',
      'amber-600',
      sampleUserRecord.id
    );

    await app.close();
  });

  it('returns 403 for user-role tokens', async () => {
    const db = createStubDatabase();
    mockDefaultTenantAvatar(db);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      user: sampleUserRecord
    });

    const response = await app.inject({
      method: 'PUT',
      url: '/admin/hub/avatar',
      headers: authHeader(),
      payload: { initials: 'HH' }
    });

    expect(response.statusCode).toBe(403);
    expect(db.updateTenantAvatar).not.toHaveBeenCalled();

    await app.close();
  });
});
