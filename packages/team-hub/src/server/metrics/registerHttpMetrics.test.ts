import Fastify from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { metricsRegistry } from '#/server/metrics/registry.js';
import { registerHttpMetrics } from '#/server/metrics/registerHttpMetrics.js';

describe('registerHttpMetrics', () => {
  beforeEach(() => {
    metricsRegistry.resetMetrics();
  });

  it('increments request counters with normalized route labels', async () => {
    const app = Fastify();
    registerHttpMetrics(app, { metricsPath: '/metrics' });
    app.get('/items/:id', async () => ({ ok: true }));

    await app.inject({ method: 'GET', url: '/items/abc' });

    const body = await metricsRegistry.metrics();
    expect(body).toContain(
      'team_hub_http_requests_total{method="GET",route="/items/:id",status_code="200"} 1'
    );
    expect(body).toContain(
      'team_hub_http_request_duration_seconds_count{method="GET",route="/items/:id"} 1'
    );

    await app.close();
  });

  it('excludes probe and metrics paths', async () => {
    const app = Fastify();
    registerHttpMetrics(app, { metricsPath: '/metrics' });
    app.get('/healthz', async () => ({ status: 'ok' }));
    app.get('/readyz', async () => ({ status: 'ok' }));
    app.get('/health', async () => ({ status: 'ok' }));
    app.get('/metrics', async () => 'ok');
    app.get('/join', async () => ({ ok: true }));

    await app.inject({ method: 'GET', url: '/healthz' });
    await app.inject({ method: 'GET', url: '/readyz' });
    await app.inject({ method: 'GET', url: '/health' });
    await app.inject({ method: 'GET', url: '/metrics' });
    await app.inject({ method: 'GET', url: '/join' });

    const body = await metricsRegistry.metrics();
    expect(body).not.toContain('route="/healthz"');
    expect(body).not.toContain('route="/readyz"');
    expect(body).not.toContain('route="/health"');
    expect(body).not.toContain('route="/metrics"');
    expect(body).toContain('route="/join"');

    await app.close();
  });
});
