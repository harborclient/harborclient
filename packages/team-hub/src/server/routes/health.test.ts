import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COLLABORATION_CONFIG } from '#/config/collaborationConfig.js';
import { DEFAULT_LOGGING_CONFIG } from '#/config/loggingConfig.js';
import { DEFAULT_METRICS_CONFIG } from '#/config/metricsConfig.js';
import { DEFAULT_STORAGE_CONFIG } from '#/config/storageConfig.js';
import { createStubDatabase } from '#/db/stubDatabase.js';
import { createServer } from '#/server/createServer.js';
import { createStubThrottleStore } from '#/server/auth/throttle/stubThrottleStore.js';
import type { INoticeEventBus } from '#/server/notices/INoticeEventBus.js';
import { InMemoryNoticeEventBus } from '#/server/notices/InMemoryNoticeEventBus.js';
import { beginShuttingDown, resetShuttingDownForTests } from '#/server/shutdownState.js';

/**
 * Builds a minimal database stub for route tests.
 *
 * @returns Mock database with no-op lifecycle methods and a successful ping.
 */
function createHealthStubDatabase() {
  const db = createStubDatabase();
  db.connect.mockResolvedValue(undefined);
  db.disconnect.mockResolvedValue(undefined);
  db.ping.mockResolvedValue(undefined);
  db.migrate.mockResolvedValue(undefined);
  db.createApiToken.mockResolvedValue(undefined);
  db.findActiveApiTokenByHash.mockResolvedValue(null);
  db.listApiTokens.mockResolvedValue([]);
  db.revokeApiToken.mockResolvedValue(false);
  db.touchApiTokenLastUsed.mockResolvedValue(undefined);
  return db;
}

/**
 * Builds a Fastify app with stubbed dependencies for health probe tests.
 *
 * @param overrides - Optional dependency overrides for failure-path coverage.
 * @returns Listening Fastify instance ready for `inject`.
 */
async function createHealthTestServer(overrides?: {
  db?: ReturnType<typeof createHealthStubDatabase>;
  throttleStore?: ReturnType<typeof createStubThrottleStore>;
  noticeEventBus?: INoticeEventBus;
}) {
  const db = overrides?.db ?? createHealthStubDatabase();
  const throttleStore = overrides?.throttleStore ?? createStubThrottleStore();
  if (!overrides?.throttleStore) {
    throttleStore.ping.mockResolvedValue(undefined);
  }

  return createServer(
    {
      host: '127.0.0.1',
      port: 8787,
      db: { driver: 'postgres' },
      redis: { host: '127.0.0.1', port: 6380 },
      llm: null,
      plugins: null,
      docs: null,
      logging: DEFAULT_LOGGING_CONFIG,
      metrics: DEFAULT_METRICS_CONFIG,
      storage: DEFAULT_STORAGE_CONFIG,
      multitenancy: { enabled: false },
      collaboration: DEFAULT_COLLABORATION_CONFIG
    },
    {
      version: '0.1.0',
      db,
      throttleStore,
      noticeEventBus: overrides?.noticeEventBus
    }
  );
}

/**
 * Builds a Redis-backed notice bus stub for readiness failure coverage.
 *
 * @param ensureReady - Implementation for {@link INoticeEventBus.ensureReady}.
 * @returns Notice event bus that reports Redis-backed mode.
 */
function createRedisNoticeEventBusStub(ensureReady: () => Promise<void>): INoticeEventBus {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isRedisBacked: () => true,
    ensureReady,
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: () => undefined })
  };
}

describe('GET /health', () => {
  it('returns ok status and version without authentication', async () => {
    const app = await createHealthTestServer();

    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      version: '0.1.0'
    });

    await app.close();
  });
});

describe('GET /healthz', () => {
  it('returns ok without touching DB or Redis', async () => {
    const db = createHealthStubDatabase();
    const throttleStore = createStubThrottleStore();
    const app = await createHealthTestServer({ db, throttleStore });

    const response = await app.inject({
      method: 'GET',
      url: '/healthz'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      version: '0.1.0'
    });
    expect(db.ping).not.toHaveBeenCalled();
    expect(throttleStore.ping).not.toHaveBeenCalled();

    await app.close();
  });
});

describe('GET /readyz', () => {
  afterEach(() => {
    resetShuttingDownForTests();
  });

  it('returns 200 when DB and Redis are reachable', async () => {
    const app = await createHealthTestServer();

    const response = await app.inject({
      method: 'GET',
      url: '/readyz'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      version: '0.1.0',
      checks: {
        db: { status: 'ok' },
        redis: { status: 'ok' },
        noticeEvents: { status: 'ok' }
      }
    });

    await app.close();
  });

  it('returns 200 with an in-memory notice bus without Redis pub/sub checks', async () => {
    const noticeEventBus = new InMemoryNoticeEventBus();
    const ensureReadySpy = vi.spyOn(noticeEventBus, 'ensureReady');
    const app = await createHealthTestServer({ noticeEventBus });

    const response = await app.inject({
      method: 'GET',
      url: '/readyz'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().checks.noticeEvents).toEqual({ status: 'ok' });
    expect(ensureReadySpy).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 503 when the database ping fails', async () => {
    const db = createHealthStubDatabase();
    db.ping.mockRejectedValue(new Error('database offline'));
    const app = await createHealthTestServer({ db });

    const response = await app.inject({
      method: 'GET',
      url: '/readyz'
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'error',
      version: '0.1.0',
      checks: {
        db: { status: 'error', error: 'database offline' },
        redis: { status: 'ok' },
        noticeEvents: { status: 'ok' }
      }
    });

    await app.close();
  });

  it('returns 503 when the Redis ping fails', async () => {
    const throttleStore = createStubThrottleStore();
    throttleStore.ping.mockRejectedValue(new Error('redis offline'));
    const app = await createHealthTestServer({ throttleStore });

    const response = await app.inject({
      method: 'GET',
      url: '/readyz'
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'error',
      version: '0.1.0',
      checks: {
        db: { status: 'ok' },
        redis: { status: 'error', error: 'redis offline' },
        noticeEvents: { status: 'ok' }
      }
    });

    await app.close();
  });

  it('returns 503 when Redis-backed notice pub/sub is unavailable', async () => {
    const noticeEventBus = createRedisNoticeEventBusStub(async () => {
      throw new Error('notice pub/sub offline');
    });
    const app = await createHealthTestServer({ noticeEventBus });

    const response = await app.inject({
      method: 'GET',
      url: '/readyz'
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'error',
      version: '0.1.0',
      checks: {
        db: { status: 'ok' },
        redis: { status: 'ok' },
        noticeEvents: { status: 'error', error: 'notice pub/sub offline' }
      }
    });

    await app.close();
  });

  it('returns 200 when Redis-backed notice pub/sub is healthy', async () => {
    const noticeEventBus = createRedisNoticeEventBusStub(async () => undefined);
    const app = await createHealthTestServer({ noticeEventBus });

    const response = await app.inject({
      method: 'GET',
      url: '/readyz'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().checks.noticeEvents).toEqual({ status: 'ok' });

    await app.close();
  });

  it('returns 503 immediately when graceful shutdown has started', async () => {
    const db = createHealthStubDatabase();
    const throttleStore = createStubThrottleStore();
    throttleStore.ping.mockResolvedValue(undefined);
    const app = await createHealthTestServer({ db, throttleStore });

    beginShuttingDown();

    const response = await app.inject({
      method: 'GET',
      url: '/readyz'
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'error',
      version: '0.1.0',
      checks: {
        db: { status: 'error', error: 'shutting down' },
        redis: { status: 'error', error: 'shutting down' },
        noticeEvents: { status: 'error', error: 'shutting down' }
      }
    });
    expect(db.ping).not.toHaveBeenCalled();
    expect(throttleStore.ping).not.toHaveBeenCalled();

    await app.close();
  });
});
