import type { Collection, SavedRequest, SendRequestInput, SendResult } from '#/shared/types';

/**
 * Result of a mutating plugin SQL statement.
 */
export interface PluginRunResult {
  /** Number of rows changed by the statement. */
  changes: number;

  /** Row id of the last insert, as a number or string when larger than `Number.MAX_SAFE_INTEGER`. */
  lastInsertRowid: number | string;
}

/**
 * Transaction-scoped database operations passed to plugin database `transaction` callbacks.
 */
export interface PluginDatabaseTx {
  /**
   * Returns the first row matching a parameterized query.
   *
   * @param sql - Single-statement SQL with `?` placeholders.
   * @param params - Bound parameter values.
   */
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;

  /**
   * Returns all rows matching a parameterized query.
   *
   * @param sql - Single-statement SQL with `?` placeholders.
   * @param params - Bound parameter values.
   */
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Runs a mutating parameterized statement.
   *
   * @param sql - Single-statement SQL with `?` placeholders.
   * @param params - Bound parameter values.
   */
  run(sql: string, params?: unknown[]): Promise<PluginRunResult>;
}

/**
 * Plugin-scoped SQLite database backed by an isolated file in the main process.
 */
export interface PluginDatabase extends PluginDatabaseTx {
  /**
   * Executes one or more DDL statements (migrations).
   *
   * @param sql - Multi-statement SQL script.
   */
  exec(sql: string): Promise<void>;

  /**
   * Runs a callback inside an exclusive transaction.
   *
   * @param fn - Callback receiving transaction-scoped query helpers.
   */
  transaction<T>(fn: (tx: PluginDatabaseTx) => Promise<T>): Promise<T>;
}

declare module '@harborclient/sdk' {
  interface PluginContext {
    database: PluginDatabase;
  }

  interface MainPluginContext {
    database: PluginDatabase;
  }

  interface PluginHost {
    /**
     * Returns saved requests for a collection or folder in sidebar run order.
     */
    listCollectionRequests(collectionId: number, folderId?: number | null): Promise<SavedRequest[]>;

    /**
     * Returns collection metadata needed to resolve saved requests in plugins.
     */
    getCollectionMetadata(collectionId: number): Promise<Collection>;

    /**
     * Appends one HTTP result to the footer session console from a renderer plugin.
     */
    logRequestToConsole(payload: {
      requestName: string;
      collectionName?: string;
      result: SendResult;
    }): Promise<void>;

    /**
     * Sends one HTTP request through the main-process pipeline, bypassing the
     * renderer's CORS restrictions. Failures resolve to an error result.
     */
    sendHttpRequest(input: SendRequestInput): Promise<SendResult>;

    /**
     * Clears the active request tab's last HTTP response so plugin-only response
     * views can take over the panel.
     */
    clearResponse(): Promise<void>;
  }
}
