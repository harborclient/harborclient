import { beforeEach, describe, expect, it } from 'vitest';
import type { IDatabase } from '#/db/IDatabase.js';
import type { DbPoolStats } from '#/db/poolStats.js';
import { createStubDatabase } from '#/db/stubDatabase.js';
import { metricsRegistry } from '#/server/metrics/registry.js';
import { updateLiveGauges } from '#/server/metrics/updatePoolMetrics.js';
import {
  closeAllNoticeStreams,
  registerNoticeStream
} from '#/server/notices/noticeStreamRegistry.js';

/**
 * Builds a stub database that reports fixed Postgres pool stats.
 *
 * @param stats - Pool stats returned by getPoolStats.
 * @returns Database stub with getPoolStats attached.
 */
function createDbWithPoolStats(stats: DbPoolStats | null): IDatabase {
  const db = createStubDatabase() as unknown as IDatabase & {
    getPoolStats: () => DbPoolStats | null;
  };
  db.getPoolStats = () => stats;
  return db;
}

describe('updateLiveGauges', () => {
  beforeEach(() => {
    metricsRegistry.resetMetrics();
    closeAllNoticeStreams();
  });

  it('refreshes SSE and Postgres pool gauges', async () => {
    registerNoticeStream(() => undefined);
    registerNoticeStream(() => undefined);

    updateLiveGauges(
      createDbWithPoolStats({
        backend: 'postgres',
        total: 4,
        idle: 2,
        waiting: 1,
        max: 10
      })
    );

    const body = await metricsRegistry.metrics();
    expect(body).toContain('team_hub_sse_connections 2');
    expect(body).toContain('team_hub_db_pool_connections{state="total",backend="postgres"} 4');
    expect(body).toContain('team_hub_db_pool_connections{state="idle",backend="postgres"} 2');
    expect(body).toContain('team_hub_db_pool_connections{state="waiting",backend="postgres"} 1');
    expect(body).toContain('team_hub_db_pool_max{backend="postgres"} 10');
  });

  it('skips pool gauges when the database has no pool stats API', async () => {
    updateLiveGauges(createStubDatabase());

    const body = await metricsRegistry.metrics();
    expect(body).toContain('team_hub_sse_connections 0');
    expect(body).not.toMatch(/team_hub_db_pool_max\{/);
    expect(body).not.toMatch(/team_hub_db_pool_connections\{/);
  });
});
