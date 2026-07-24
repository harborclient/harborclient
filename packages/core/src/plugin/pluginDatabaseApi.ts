import type { PluginDatabase, PluginDatabaseTx, PluginRunResult } from './databaseTypes';

/**
 * Backend used to implement {@link PluginDatabase} in renderer or main plugin runtimes.
 */
export interface PluginDatabaseBackend {
  /**
   * Runs one query mode, optionally inside a transaction.
   *
   * @param mode - Query shape to execute.
   * @param sql - Parameterized SQL statement.
   * @param params - Bound parameter values.
   * @param txnId - Active transaction id when applicable.
   */
  query(
    mode: 'get' | 'all' | 'run',
    sql: string,
    params?: unknown[],
    txnId?: string
  ): Promise<unknown>;

  /**
   * Executes a multi-statement SQL script.
   *
   * @param sql - DDL or migration script.
   */
  exec(sql: string): Promise<void>;

  /**
   * Starts an exclusive transaction.
   */
  beginTransaction(): Promise<string>;

  /**
   * Commits or rolls back an open transaction.
   *
   * @param txnId - Transaction id from {@link beginTransaction}.
   * @param action - Whether to commit or roll back.
   */
  endTransaction(txnId: string, action: 'commit' | 'rollback'): Promise<void>;
}

/**
 * Builds the plugin database API surface from a runtime-specific backend.
 *
 * @param backend - IPC or child-process bridge implementing database operations.
 */
export function createPluginDatabaseApi(backend: PluginDatabaseBackend): PluginDatabase {
  /**
   * Runs one query mode through the backend.
   *
   * @param mode - Query shape to execute.
   * @param sql - Parameterized SQL statement.
   * @param params - Bound parameter values.
   * @param txnId - Active transaction id when applicable.
   */
  const query = (
    mode: 'get' | 'all' | 'run',
    sql: string,
    params?: unknown[],
    txnId?: string
  ): Promise<unknown> => backend.query(mode, sql, params, txnId);

  /**
   * Transaction-scoped helpers passed to {@link PluginDatabase.transaction}.
   *
   * @param txnId - Active transaction id.
   */
  const createTx = (txnId: string): PluginDatabaseTx => ({
    get: async <T>(sql: string, params?: unknown[]) =>
      (await query('get', sql, params, txnId)) as T | undefined,
    all: async <T>(sql: string, params?: unknown[]) =>
      (await query('all', sql, params, txnId)) as T[],
    run: async (sql: string, params?: unknown[]) =>
      (await query('run', sql, params, txnId)) as PluginRunResult
  });

  return {
    get: async <T>(sql: string, params?: unknown[]) =>
      (await query('get', sql, params)) as T | undefined,
    all: async <T>(sql: string, params?: unknown[]) => (await query('all', sql, params)) as T[],
    run: async (sql: string, params?: unknown[]) =>
      (await query('run', sql, params)) as PluginRunResult,
    exec: (sql: string) => backend.exec(sql),
    transaction: async <T>(fn: (tx: PluginDatabaseTx) => Promise<T>) => {
      const txnId = await backend.beginTransaction();
      try {
        const result = await fn(createTx(txnId));
        await backend.endTransaction(txnId, 'commit');
        return result;
      } catch (error) {
        await backend.endTransaction(txnId, 'rollback');
        throw error;
      }
    }
  };
}
