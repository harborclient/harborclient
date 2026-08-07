import { describe, expect, it } from 'vitest';
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

describe('GET /auth/session', () => {
  it('returns user, token, capabilities, and hub avatar for a user-role token', async () => {
    const db = createStubDatabase();
    db.findTenantById.mockResolvedValue(defaultTenant);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      user: {
        ...sampleUserRecord,
        llmAccess: true
      }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: sampleUserRecord.id,
        name: sampleUserRecord.name,
        role: 'user',
        avatarInitials: 'TU',
        avatarColor: 'sky-600'
      },
      token: {
        id: 'token-1',
        prefix: 'hbk_valid-'
      },
      capabilities: {
        dataApi: true,
        managementApi: false,
        llm: true,
        communication: true,
        discussionE2ee: false
      },
      tenantId: '__default__',
      hub: {
        name: 'Default',
        initials: 'DE',
        color: 'sky-600'
      }
    });

    await app.close();
  });

  it('returns admin capabilities for an admin-role token', async () => {
    const db = createStubDatabase();
    db.findTenantById.mockResolvedValue(defaultTenant);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      user: {
        ...sampleUserRecord,
        role: 'admin',
        collectionAccess: [],
        environmentAccess: [],
        snippetAccess: [],

        llmAccess: false
      }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: sampleUserRecord.id,
        name: sampleUserRecord.name,
        role: 'admin',
        avatarInitials: 'TU',
        avatarColor: 'sky-600'
      },
      token: {
        id: 'token-1',
        prefix: 'hbk_valid-'
      },
      capabilities: {
        dataApi: true,
        managementApi: true,
        llm: false,
        communication: true,
        discussionE2ee: false
      },
      tenantId: '__default__',
      hub: {
        name: 'Default',
        initials: 'DE',
        color: 'sky-600'
      }
    });

    await app.close();
  });

  it('returns discussionE2ee when collaboration.e2ee is enabled', async () => {
    const db = createStubDatabase();
    db.findTenantById.mockResolvedValue(defaultTenant);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().capabilities).toMatchObject({
      discussionE2ee: true
    });

    await app.close();
  });

  it('returns 401 without a bearer token', async () => {
    const db = createStubDatabase();
    const app = await createProtectedTestApp({ db });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/session'
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Unauthorized' });

    await app.close();
  });
});

describe('PUT /auth/profile/avatar', () => {
  it('updates avatar presentation for the authenticated user', async () => {
    const db = createStubDatabase();
    db.findTenantById.mockResolvedValue(defaultTenant);
    const updatedUser = {
      ...sampleUserRecord,
      avatarInitials: 'ME',
      avatarColor: 'rose-600'
    };
    db.updateUser.mockResolvedValue(updatedUser);

    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      user: sampleUserRecord
    });

    const response = await app.inject({
      method: 'PUT',
      url: '/auth/profile/avatar',
      headers: authHeader(),
      payload: {
        initials: 'ME',
        color: 'rose-600'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      avatarInitials: 'ME',
      avatarColor: 'rose-600'
    });
    expect(db.updateUser).toHaveBeenCalledWith(
      sampleUserRecord.id,
      {
        avatarInitials: 'ME',
        avatarColor: 'rose-600'
      },
      sampleUserRecord.id
    );

    await app.close();
  });

  it('returns 400 when neither initials nor color is provided', async () => {
    const db = createStubDatabase();
    db.findTenantById.mockResolvedValue(defaultTenant);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      user: sampleUserRecord
    });

    const response = await app.inject({
      method: 'PUT',
      url: '/auth/profile/avatar',
      headers: authHeader(),
      payload: {}
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });
});
