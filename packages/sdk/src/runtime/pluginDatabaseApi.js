/**
 * Builds the plugin database API surface from a runtime-specific backend.
 *
 * @param {object} backend - IPC or child-process bridge implementing database operations.
 * @param {(mode: 'get' | 'all' | 'run', sql: string, params?: unknown[], txnId?: string) => Promise<unknown>} backend.query
 * @param {(sql: string) => Promise<void>} backend.exec
 * @param {() => Promise<string>} backend.beginTransaction
 * @param {(txnId: string, action: 'commit' | 'rollback') => Promise<void>} backend.endTransaction
 * @returns {import('../types.js').PluginDatabase}
 */
export function createPluginDatabaseApi(backend) {
  /**
   * Runs one query mode through the backend.
   *
   * @param {'get' | 'all' | 'run'} mode - Query shape to execute.
   * @param {string} sql - Parameterized SQL statement.
   * @param {unknown[]} [params] - Bound parameter values.
   * @param {string} [txnId] - Active transaction id when applicable.
   * @returns {Promise<unknown>}
   */
  const query = (mode, sql, params, txnId) => backend.query(mode, sql, params, txnId);

  /**
   * Transaction-scoped helpers passed to {@link PluginDatabase.transaction}.
   *
   * @param {string} txnId - Active transaction id.
   * @returns {import('../types.js').PluginDatabaseTx}
   */
  const createTx = (txnId) => ({
    get: async (sql, params) => query('get', sql, params, txnId),
    all: async (sql, params) => query('all', sql, params, txnId),
    run: async (sql, params) => query('run', sql, params, txnId)
  });

  return {
    get: async (sql, params) => query('get', sql, params),
    all: async (sql, params) => query('all', sql, params),
    run: async (sql, params) => query('run', sql, params),
    exec: (sql) => backend.exec(sql),
    transaction: async (fn) => {
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
