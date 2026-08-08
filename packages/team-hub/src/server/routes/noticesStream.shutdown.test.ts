import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_COLLABORATION_CONFIG } from '#/config/collaborationConfig.js';
import { DEFAULT_LOGGING_CONFIG } from '#/config/loggingConfig.js';
import { DEFAULT_METRICS_CONFIG } from '#/config/metricsConfig.js';
import { DEFAULT_STORAGE_CONFIG } from '#/config/storageConfig.js';
import { createStubDatabase } from '#/db/stubDatabase.js';
import { createStubThrottleStore } from '#/server/auth/throttle/stubThrottleStore.js';
import { createServer } from '#/server/createServer.js';
import { InMemoryNoticeEventBus } from '#/server/notices/InMemoryNoticeEventBus.js';
import {
  closeAllNoticeStreams,
  getOpenNoticeStreamCount
} from '#/server/notices/noticeStreamRegistry.js';
import {
  sampleApiTokenRecord,
  sampleUserRecord,
  validBearerToken
} from '#/server/routes/test/createTestApp.js';

/**
 * Builds a createServer instance with auth stubs for real SSE connection tests.
 *
 * @returns Listening Fastify app bound to an ephemeral port.
 */
async function createListeningNoticeStreamServer() {
  const db = createStubDatabase();
  db.forTenant.mockImplementation(() => db);
  db.getTenantId.mockReturnValue('__default__');
  db.findActiveApiTokenByHash.mockResolvedValue(sampleApiTokenRecord);
  db.findUserById.mockResolvedValue(sampleUserRecord);
  db.touchApiTokenLastUsed.mockResolvedValue(undefined);
  db.ping.mockResolvedValue(undefined);

  const throttleStore = createStubThrottleStore();
  throttleStore.isBlocked.mockResolvedValue(false);
  throttleStore.recordFailure.mockResolvedValue(false);
  throttleStore.reset.mockResolvedValue(undefined);
  throttleStore.ping.mockResolvedValue(undefined);

  const noticeEventBus = new InMemoryNoticeEventBus();

  const app = await createServer(
    {
      host: '127.0.0.1',
      port: 0,
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
      noticeEventBus
    }
  );

  await app.listen({ host: '127.0.0.1', port: 0 });
  return app;
}

/**
 * Opens a long-lived SSE request and resolves once response headers arrive.
 *
 * @param port - Listening TCP port.
 * @returns HTTP response and a function that destroys the client socket.
 */
function openNoticeStream(port: number): Promise<{
  response: http.IncomingMessage;
  destroy: () => void;
}> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/notices/stream',
        method: 'GET',
        headers: {
          authorization: `Bearer ${validBearerToken}`,
          accept: 'text/event-stream'
        }
      },
      (response) => {
        resolve({
          response,
          destroy: () => {
            request.destroy();
            response.destroy();
          }
        });
      }
    );

    request.setTimeout(3_000, () => {
      request.destroy();
      reject(new Error('Timed out waiting for SSE response headers.'));
    });
    request.on('error', reject);
    request.end();
  });
}

describe('notice stream graceful shutdown', () => {
  afterEach(() => {
    closeAllNoticeStreams();
  });

  it('closes open SSE streams during app.close so shutdown completes quickly', async () => {
    const app = await createListeningNoticeStreamServer();
    const address = app.server.address();
    if (!address || typeof address === 'string') {
      await app.close();
      throw new Error('Expected a TCP listen address.');
    }

    const { response, destroy } = await openNoticeStream(address.port);
    expect(response.statusCode).toBe(200);
    expect(getOpenNoticeStreamCount()).toBe(1);

    const closeStarted = Date.now();
    await expect(app.close()).resolves.toBeUndefined();
    expect(Date.now() - closeStarted).toBeLessThan(2_000);
    expect(getOpenNoticeStreamCount()).toBe(0);

    destroy();
  }, 15_000);
});
