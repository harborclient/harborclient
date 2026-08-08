/**
 * Runtime connection-pool utilization for SQL database backends.
 *
 * Firestore and other non-pooled drivers omit this surface.
 */
export interface DbPoolStats {
  /**
   * SQL driver that owns the pool.
   */
  backend: 'postgres' | 'mysql';

  /**
   * Connections currently held by the pool (idle + checked out).
   */
  total: number;

  /**
   * Idle connections available for checkout.
   */
  idle: number;

  /**
   * Clients waiting for a free connection.
   */
  waiting: number;

  /**
   * Configured maximum pool size.
   */
  max: number;
}

/**
 * Narrow interface for databases that can report pool utilization.
 */
export interface DatabaseWithPoolStats {
  /**
   * Returns live pool stats, or null when the pool is not connected.
   */
  getPoolStats(): DbPoolStats | null;
}

/**
 * Returns whether a database instance exposes {@link DatabaseWithPoolStats.getPoolStats}.
 *
 * @param db - Database handle from runtime context or tests.
 * @returns True when pool stats can be collected for Prometheus gauges.
 */
export function hasPoolStats(db: unknown): db is DatabaseWithPoolStats {
  return (
    typeof db === 'object' &&
    db !== null &&
    'getPoolStats' in db &&
    typeof (db as DatabaseWithPoolStats).getPoolStats === 'function'
  );
}
