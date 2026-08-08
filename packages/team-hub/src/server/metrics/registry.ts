import { collectDefaultMetrics, Registry } from 'prom-client';

/**
 * Process-local Prometheus registry for Team Hub application metrics.
 *
 * Uses a dedicated registry (not the prom-client default) so tests can reset
 * series without colliding with other packages.
 */
export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });
