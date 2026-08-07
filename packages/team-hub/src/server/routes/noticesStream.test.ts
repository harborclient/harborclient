import { describe, expect, it } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import { InMemoryNoticeEventBus } from '#/server/notices/InMemoryNoticeEventBus.js';
import { authHeader, createProtectedTestApp } from '#/server/routes/test/createTestApp.js';

describe('notice stream route', () => {
  it('rejects unauthenticated stream requests', async () => {
    const db = createStubDatabase();
    const app = await createProtectedTestApp({ db, withValidAuth: false });

    const response = await app.inject({
      method: 'GET',
      url: '/notices/stream',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 503 when a Redis-backed bus is unavailable', async () => {
    const db = createStubDatabase();
    const eventBus = new InMemoryNoticeEventBus();
    eventBus.isRedisBacked = () => true;
    eventBus.ensureReady = async () => {
      throw new Error('Redis unavailable');
    };

    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      noticeEventBus: eventBus
    });

    const response = await app.inject({
      method: 'GET',
      url: '/notices/stream',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(503);
    await app.close();
  });
});
