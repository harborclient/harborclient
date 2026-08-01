import { describe, expect, it } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import {
  authHeader,
  createProtectedTestApp,
  sampleUserRecord
} from '#/server/routes/test/createTestApp.js';
import { sampleAttribution } from '#/server/routes/test/sampleAttribution.js';

const sampleLivePage = {
  id: 'page-1',
  name: 'Dashboard',
  payload: { url: 'https://example.test/app', homeUrl: 'https://example.test' },
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...sampleAttribution,
  deletionLocked: false
};

describe('live page routes', () => {
  it('lists accessible records with flattened payloads', async () => {
    const db = createStubDatabase();
    db.listLivePages.mockResolvedValue([sampleLivePage]);
    const app = await createProtectedTestApp({ db, withValidAuth: true });
    const response = await app.inject({ method: 'GET', url: '/live-pages', headers: authHeader() });
    expect(response.statusCode).toBe(200);
    expect(response.json().livePages[0]).toMatchObject({
      id: 'page-1',
      name: 'Dashboard',
      url: 'https://example.test/app'
    });
    await app.close();
  });

  it('stores flattened create fields in the payload', async () => {
    const db = createStubDatabase();
    db.createLivePage.mockResolvedValue(sampleLivePage);
    const app = await createProtectedTestApp({ db, withValidAuth: true });
    const response = await app.inject({
      method: 'POST',
      url: '/live-pages',
      headers: authHeader(),
      payload: {
        name: 'Dashboard',
        url: 'https://example.test/app',
        homeUrl: 'https://example.test'
      }
    });
    expect(response.statusCode).toBe(200);
    expect(db.createLivePage).toHaveBeenCalledWith(
      {
        name: 'Dashboard',
        payload: { url: 'https://example.test/app', homeUrl: 'https://example.test' }
      },
      'user-1'
    );
    await app.close();
  });

  it('updates an explicitly accessible live page', async () => {
    const db = createStubDatabase();
    db.updateLivePage.mockResolvedValue(sampleLivePage);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      user: { ...sampleUserRecord, livePageAccess: ['page-1'] }
    });
    const response = await app.inject({
      method: 'PUT',
      url: '/live-pages/page-1',
      headers: authHeader(),
      payload: { name: 'Dashboard', url: 'https://example.test/app' }
    });
    expect(response.statusCode).toBe(200);
    expect(db.updateLivePage).toHaveBeenCalledWith(
      'page-1',
      { name: 'Dashboard', payload: { url: 'https://example.test/app' } },
      'user-1'
    );
    await app.close();
  });
});
