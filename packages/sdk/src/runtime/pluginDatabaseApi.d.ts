import type { PluginDatabase } from '../types.js';

/**
 * Backend used to implement {@link PluginDatabase} in renderer or main plugin runtimes.
 */
export interface PluginDatabaseBackend {
  /**
   * Runs one query mode, optionally inside a transaction.
   */
  query(
    mode: 'get' | 'all' | 'run',
    sql: string,
    params?: unknown[],
    txnId?: string
  ): Promise<unknown>;

  /**
   * Executes a multi-statement SQL script.
   */
  exec(sql: string): Promise<void>;

  /**
   * Starts an exclusive transaction.
   */
  beginTransaction(): Promise<string>;

  /**
   * Commits or rolls back an open transaction.
   */
  endTransaction(txnId: string, action: 'commit' | 'rollback'): Promise<void>;
}

/**
 * Builds the plugin database API surface from a runtime-specific backend.
 */
export function createPluginDatabaseApi(backend: PluginDatabaseBackend): PluginDatabase;
