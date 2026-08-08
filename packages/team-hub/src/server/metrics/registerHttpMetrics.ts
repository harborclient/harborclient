import type { FastifyInstance } from 'fastify';
import { httpRequestDurationSeconds, httpRequestsTotal } from '#/server/metrics/teamHubMetrics.js';

/**
 * Routes excluded from HTTP request metrics to avoid probe/scrape noise.
 */
const DEFAULT_EXCLUDED_ROUTES = new Set(['/health', '/healthz', '/readyz']);

/**
 * Options for {@link registerHttpMetrics}.
 */
export interface RegisterHttpMetricsOptions {
  /**
   * Configured Prometheus scrape path; also excluded from HTTP series.
   */
  metricsPath: string;
}

/**
 * Registers Fastify hooks that record HTTP request count and duration.
 *
 * Probe and metrics paths are excluded so readiness scrapes do not dominate
 * histograms. Route labels use Fastify's route template (`routeOptions.url`)
 * to keep cardinality bounded.
 *
 * @param app - Fastify server to attach hooks to.
 * @param options - Metrics path used for exclusion.
 */
export function registerHttpMetrics(
  app: FastifyInstance,
  options: RegisterHttpMetricsOptions
): void {
  const excludedRoutes = new Set(DEFAULT_EXCLUDED_ROUTES);
  excludedRoutes.add(options.metricsPath);

  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? 'unknown';
    if (excludedRoutes.has(route)) {
      return;
    }

    const method = request.method;
    const statusCode = String(reply.statusCode);
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method, route }, reply.elapsedTime / 1000);
  });
}
