import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerHttpLogging } from '#/server/logging/httpLogging.js';
import type { Logger } from '#/server/logging/logger.js';

/**
 * Builds a mock Winston logger for HTTP logging hook tests.
 *
 * @returns Logger stub with debug, info, and error methods.
 */
function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  } as unknown as Logger;
}

describe('registerHttpLogging', () => {
  it('logs incoming requests at debug level', async () => {
    const logger = createMockLogger();
    const app = Fastify();
    registerHttpLogging(app, { logger, format: 'json' });

    app.get('/test', async () => ({ ok: true }));

    const response = await app.inject({
      method: 'GET',
      url: '/test'
    });

    expect(response.statusCode).toBe(200);
    expect(logger.debug).toHaveBeenCalledWith(
      'request',
      expect.objectContaining({
        method: 'GET',
        url: '/test'
      })
    );

    await app.close();
  });

  it('logs request completion at info when format is json', async () => {
    const logger = createMockLogger();
    const app = Fastify();
    registerHttpLogging(app, { logger, format: 'json' });

    app.get('/test', async () => ({ ok: true }));

    await app.inject({ method: 'GET', url: '/test' });

    expect(logger.info).toHaveBeenCalledWith(
      'request completed',
      expect.objectContaining({
        method: 'GET',
        url: '/test',
        route: '/test',
        statusCode: 200,
        durationMs: expect.any(Number)
      })
    );

    await app.close();
  });

  it('logs request completion at debug when format is simple', async () => {
    const logger = createMockLogger();
    const app = Fastify();
    registerHttpLogging(app, { logger, format: 'simple' });

    app.get('/test', async () => ({ ok: true }));

    await app.inject({ method: 'GET', url: '/test' });

    expect(logger.debug).toHaveBeenCalledWith(
      'request completed',
      expect.objectContaining({
        statusCode: 200,
        durationMs: expect.any(Number)
      })
    );
    expect(logger.info).not.toHaveBeenCalled();

    await app.close();
  });

  it('logs request errors at error level', async () => {
    const logger = createMockLogger();
    const app = Fastify();
    registerHttpLogging(app, { logger, format: 'json' });

    app.get('/fail', async () => {
      throw new Error('boom');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/fail'
    });

    expect(response.statusCode).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      'request error',
      expect.objectContaining({
        method: 'GET',
        url: '/fail',
        message: 'boom'
      })
    );

    await app.close();
  });
});
