import type { IDatabase } from '#/db/IDatabase.js';
import { hasPoolStats } from '#/db/poolStats.js';
import { getOpenNoticeStreamCount } from '#/server/notices/noticeStreamRegistry.js';
import { dbPoolConnections, dbPoolMax, sseConnections } from '#/server/metrics/teamHubMetrics.js';

/**
 * Refreshes scrape-time gauges from live process and database state.
 *
 * Called from the `/metrics` handler before serializing Prometheus text so
 * SSE and pool utilization reflect the current process rather than stale
 * background samples.
 *
 * @param db - Root database handle from runtime context.
 */
export function updateLiveGauges(db: IDatabase): void {
  sseConnections.set(getOpenNoticeStreamCount());

  if (!hasPoolStats(db)) {
    return;
  }

  const stats = db.getPoolStats();
  if (!stats) {
    return;
  }

  dbPoolConnections.set({ state: 'total', backend: stats.backend }, stats.total);
  dbPoolConnections.set({ state: 'idle', backend: stats.backend }, stats.idle);
  dbPoolConnections.set({ state: 'waiting', backend: stats.backend }, stats.waiting);
  dbPoolMax.set({ backend: stats.backend }, stats.max);
}
