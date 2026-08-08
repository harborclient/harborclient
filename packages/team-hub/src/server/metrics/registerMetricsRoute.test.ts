import Fastify from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_METRICS_CONFIG } from '#/config/metricsConfig.js';
import { createStubDatabase } from '#/db/stubDatabase.js';
import { metricsRegistry } from '#/server/metrics/registry.js';
import { registerMetricsRoute } from '#/server/metrics/registerMetricsRoute.js';
import { httpRequestsTotal } from '#/server/metrics/teamHubMetrics.js';

describe('registerMetricsRoute', () => {
  beforeEach(() => {
    metricsRegistry.resetMetrics();
  });

  it('returns Prometheus text with core series', async () => {
    const app = Fastify();
    await registerMetricsRoute(app, {
      metrics: DEFAULT_METRICS_CONFIG,
      db: createStubDatabase()
    });

    httpRequestsTotal.inc({ method: 'GET', route: '/join', status_code: '200' });

    const response = await app.inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('team_hub_http_requests_total');
    expect(response.body).toContain('team_hub_sse_connections');

    await app.close();
  });

  it('requires Bearer auth when authToken is configured', async () => {
    const app = Fastify();
    await registerMetricsRoute(app, {
      metrics: {
        enabled: true,
        path: '/metrics',
        authToken: 'scrape-secret'
      },
      db: createStubDatabase()
    });

    const unauthorized = await app.inject({ method: 'GET', url: '/metrics' });
    expect(unauthorized.statusCode).toBe(401);

    const authorized = await app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: 'Bearer scrape-secret' }
    });
    expect(authorized.statusCode).toBe(200);
    expect(authorized.body).toContain('team_hub_http_requests_total');

    await app.close();
  });

  it('skips registration when metrics are disabled', async () => {
    const app = Fastify();
    await registerMetricsRoute(app, {
      metrics: { ...DEFAULT_METRICS_CONFIG, enabled: false },
      db: createStubDatabase()
    });

    const response = await app.inject({ method: 'GET', url: '/metrics' });
    expect(response.statusCode).toBe(404);

    await app.close();
  });
});
