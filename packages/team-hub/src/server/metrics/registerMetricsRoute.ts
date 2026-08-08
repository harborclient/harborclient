import type { FastifyInstance } from 'fastify';
import type { MetricsConfig } from '#/config/metricsConfig.js';
import type { IDatabase } from '#/db/IDatabase.js';
import { metricsRegistry } from '#/server/metrics/registry.js';
import { updateLiveGauges } from '#/server/metrics/updatePoolMetrics.js';

/**
 * Options for {@link registerMetricsRoute}.
 */
export interface RegisterMetricsRouteOptions {
  /**
   * Normalized metrics configuration from server.yaml.
   */
  metrics: MetricsConfig;

  /**
   * Root database used to refresh pool gauges on scrape.
   */
  db: IDatabase;
}

/**
 * Registers the Prometheus scrape endpoint when metrics are enabled.
 *
 * When `metrics.authToken` is set, scrapers must send
 * `Authorization: Bearer <token>`. Leave the token unset and keep the path
 * off public Ingress so only the pod network (or NetworkPolicy) can scrape.
 *
 * @param app - Fastify public route scope.
 * @param options - Metrics config and database handle.
 */
export async function registerMetricsRoute(
  app: FastifyInstance,
  options: RegisterMetricsRouteOptions
): Promise<void> {
  if (!options.metrics.enabled) {
    return;
  }

  app.get(options.metrics.path, async (request, reply) => {
    if (options.metrics.authToken) {
      const expected = `Bearer ${options.metrics.authToken}`;
      if (request.headers.authorization !== expected) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    }

    updateLiveGauges(options.db);
    reply.header('Content-Type', metricsRegistry.contentType);
    return metricsRegistry.metrics();
  });
}
