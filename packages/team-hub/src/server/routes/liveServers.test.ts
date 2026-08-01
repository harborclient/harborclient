import { describe, expect, it } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import {
  authHeader,
  createProtectedTestApp,
  sampleUserRecord
} from '#/server/routes/test/createTestApp.js';
import { sampleAttribution } from '#/server/routes/test/sampleAttribution.js';

const sampleLiveServer = {
  id: 'server-1',
  name: 'Docs',
  payload: { root: '/srv/docs', watch: true },
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...sampleAttribution,
  deletionLocked: false
};

describe('live server routes', () => {
  it('lists accessible records with flattened payloads', async () => {
    const db = createStubDatabase();
    db.listLiveServers.mockResolvedValue([sampleLiveServer]);
    const app = await createProtectedTestApp({ db, withValidAuth: true });
    const response = await app.inject({
      method: 'GET',
      url: '/live-servers',
      headers: authHeader()
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().liveServers[0]).toMatchObject({
      id: 'server-1',
      name: 'Docs',
      root: '/srv/docs',
      watch: true
    });
    await app.close();
  });

  it('stores flattened create fields in the payload', async () => {
    const db = createStubDatabase();
    db.createLiveServer.mockResolvedValue(sampleLiveServer);
    const app = await createProtectedTestApp({ db, withValidAuth: true });
    const response = await app.inject({
      method: 'POST',
      url: '/live-servers',
      headers: authHeader(),
      payload: { name: 'Docs', root: '/srv/docs', watch: true }
    });
    expect(response.statusCode).toBe(200);
    expect(db.createLiveServer).toHaveBeenCalledWith(
      { name: 'Docs', payload: { root: '/srv/docs', watch: true } },
      'user-1'
    );
    await app.close();
  });

  it('enforces scoped access and deletion locks', async () => {
    const db = createStubDatabase();
    db.findLiveServerById.mockResolvedValue({ ...sampleLiveServer, deletionLocked: true });
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      user: { ...sampleUserRecord, liveServerAccess: ['server-1'] }
    });
    const response = await app.inject({
      method: 'DELETE',
      url: '/live-servers/server-1',
      headers: authHeader()
    });
    expect(response.statusCode).toBe(403);
    expect(db.deleteLiveServer).not.toHaveBeenCalled();
    await app.close();
  });
});
