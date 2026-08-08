import { Counter, Gauge, Histogram } from 'prom-client';
import { metricsRegistry } from '#/server/metrics/registry.js';

/**
 * Total HTTP requests completed by the Team Hub API.
 */
export const httpRequestsTotal = new Counter({
  name: 'team_hub_http_requests_total',
  help: 'Total number of HTTP requests handled by Team Hub.',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry]
});

/**
 * HTTP request latency histogram in seconds.
 */
export const httpRequestDurationSeconds = new Histogram({
  name: 'team_hub_http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry]
});

/**
 * Open notice SSE connections on this process.
 */
export const sseConnections = new Gauge({
  name: 'team_hub_sse_connections',
  help: 'Number of open notice SSE connections on this Team Hub process.',
  registers: [metricsRegistry]
});

/**
 * Database pool connection counts by state.
 */
export const dbPoolConnections = new Gauge({
  name: 'team_hub_db_pool_connections',
  help: 'Database pool connections by state (total, idle, waiting).',
  labelNames: ['state', 'backend'] as const,
  registers: [metricsRegistry]
});

/**
 * Configured maximum database pool size.
 */
export const dbPoolMax = new Gauge({
  name: 'team_hub_db_pool_max',
  help: 'Configured maximum database pool size.',
  labelNames: ['backend'] as const,
  registers: [metricsRegistry]
});

/**
 * Auth and invitation throttle rejections that returned HTTP 429.
 */
export const authThrottledTotal = new Counter({
  name: 'team_hub_auth_throttled_total',
  help: 'Number of requests rejected with HTTP 429 due to auth or invitation throttling.',
  labelNames: ['scope'] as const,
  registers: [metricsRegistry]
});

/**
 * Notice stream events published after persistence.
 */
export const noticeEventsPublishedTotal = new Counter({
  name: 'team_hub_notice_events_published_total',
  help: 'Number of notice stream events published after persistence.',
  labelNames: ['type'] as const,
  registers: [metricsRegistry]
});

/**
 * Increments the auth throttle counter for a 429 response.
 *
 * @param scope - Throttle surface that produced the rejection.
 */
export function recordAuthThrottled(scope: 'bearer' | 'invitation'): void {
  authThrottledTotal.inc({ scope });
}

/**
 * Increments the notice publish counter for a single fan-out event.
 *
 * @param type - Notice stream event type (for example `notice.created`).
 */
export function recordNoticeEventPublished(type: string): void {
  noticeEventsPublishedTotal.inc({ type });
}
