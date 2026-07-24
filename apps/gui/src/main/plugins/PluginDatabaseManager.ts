import Database from 'better-sqlite3';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

/** Directory under userData holding one SQLite file per plugin id. */
export const PLUGIN_DATABASES_DIR = 'plugin-databases';

/** Default timeout for abandoned plugin database transactions. */
export const PLUGIN_DB_TX_TIMEOUT_MS = 30_000;

const PLUGIN_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9.-]*\.[a-zA-Z][a-zA-Z0-9.-]+$/;
const FORBIDDEN_EXEC_PATTERN = /\b(attach|detach|load_extension)\b/i;

/**
 * Result of a mutating plugin SQL statement.
 */
export interface PluginDatabaseRunResult {
  changes: number;
  lastInsertRowid: number | string;
}

type QueryMode = 'get' | 'all' | 'run';

interface ActiveTransaction {
  pluginId: string;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Manages isolated SQLite database files for plugins in the main process.
 *
 * Each plugin id maps to one file under userData/plugin-databases. Operations for a
 * given plugin are serialized so transactions remain safe across async IPC boundaries.
 */
export class PluginDatabaseManager {
  readonly #userDataPath: string;
  readonly #connections = new Map<string, Database.Database>();
  readonly #queues = new Map<string, Promise<unknown>>();
  readonly #transactions = new Map<string, ActiveTransaction>();
  #nextTxnId = 1;

  /**
   * @param userDataPath - Electron userData directory root.
   */
  constructor(userDataPath: string) {
    this.#userDataPath = userDataPath;
  }

  /**
   * Returns the first row for a parameterized single-statement query.
   *
   * @param pluginId - Plugin manifest id.
   * @param sql - SQL with optional `?` placeholders.
   * @param params - Bound parameter values.
   * @param txnId - Active transaction id when called inside a transaction.
   */
  get(
    pluginId: string,
    sql: string,
    params: unknown[] = [],
    txnId?: string
  ): Promise<unknown | undefined> {
    return this.#enqueue(pluginId, () => this.#query(pluginId, 'get', sql, params, txnId));
  }

  /**
   * Returns all rows for a parameterized single-statement query.
   *
   * @param pluginId - Plugin manifest id.
   * @param sql - SQL with optional `?` placeholders.
   * @param params - Bound parameter values.
   * @param txnId - Active transaction id when called inside a transaction.
   */
  all(pluginId: string, sql: string, params: unknown[] = [], txnId?: string): Promise<unknown[]> {
    return this.#enqueue(pluginId, () =>
      this.#query(pluginId, 'all', sql, params, txnId)
    ) as Promise<unknown[]>;
  }

  /**
   * Runs a mutating parameterized single-statement query.
   *
   * @param pluginId - Plugin manifest id.
   * @param sql - SQL with optional `?` placeholders.
   * @param params - Bound parameter values.
   * @param txnId - Active transaction id when called inside a transaction.
   */
  run(
    pluginId: string,
    sql: string,
    params: unknown[] = [],
    txnId?: string
  ): Promise<PluginDatabaseRunResult> {
    return this.#enqueue(pluginId, () =>
      this.#query(pluginId, 'run', sql, params, txnId)
    ) as Promise<PluginDatabaseRunResult>;
  }

  /**
   * Executes a multi-statement SQL script (migrations / DDL).
   *
   * @param pluginId - Plugin manifest id.
   * @param sql - DDL script rejected when it contains ATTACH, DETACH, or load_extension.
   */
  exec(pluginId: string, sql: string): Promise<void> {
    return this.#enqueue(pluginId, () => {
      assertSafeExecSql(sql);
      this.#open(pluginId).exec(sql);
    });
  }

  /**
   * Starts an exclusive transaction and returns an opaque transaction id.
   *
   * @param pluginId - Plugin manifest id.
   */
  beginTransaction(pluginId: string): Promise<string> {
    return this.#enqueue(pluginId, () => {
      for (const [txnId, txn] of this.#transactions.entries()) {
        if (txn.pluginId === pluginId) {
          throw new Error(
            `Plugin ${pluginId} already has an open database transaction (${txnId}).`
          );
        }
      }

      const db = this.#open(pluginId);
      db.exec('BEGIN IMMEDIATE');
      const txnId = String(this.#nextTxnId++);
      const timeout = setTimeout(() => {
        this.#rollbackTransaction(txnId, 'Plugin database transaction timed out.');
      }, PLUGIN_DB_TX_TIMEOUT_MS);
      this.#transactions.set(txnId, { pluginId, timeout });
      return txnId;
    });
  }

  /**
   * Commits or rolls back an open transaction.
   *
   * @param pluginId - Plugin manifest id.
   * @param txnId - Transaction id from {@link beginTransaction}.
   * @param action - Whether to commit or roll back.
   */
  endTransaction(pluginId: string, txnId: string, action: 'commit' | 'rollback'): Promise<void> {
    return this.#enqueue(pluginId, () => {
      const txn = this.#requireTransaction(pluginId, txnId);
      clearTimeout(txn.timeout);
      this.#transactions.delete(txnId);
      const db = this.#open(pluginId);
      if (action === 'commit') {
        db.exec('COMMIT');
        return;
      }
      db.exec('ROLLBACK');
    });
  }

  /**
   * Flushes WAL contents for every open plugin database (used before backup).
   */
  checkpointAll(): void {
    for (const db of this.#connections.values()) {
      db.pragma('wal_checkpoint(TRUNCATE)');
    }
  }

  /**
   * Closes one plugin database connection without deleting its file.
   *
   * @param pluginId - Plugin manifest id.
   */
  close(pluginId: string): void {
    this.#closeConnection(pluginId);
  }

  /**
   * Closes every open plugin database connection.
   */
  closeAll(): void {
    for (const pluginId of [...this.#connections.keys()]) {
      this.#closeConnection(pluginId);
    }
  }

  /**
   * Closes and deletes a plugin database file and WAL sidecars.
   *
   * @param pluginId - Plugin manifest id.
   */
  deleteDatabase(pluginId: string): void {
    assertValidPluginId(pluginId);
    this.#closeConnection(pluginId);
    const basePath = this.#dbPath(pluginId);
    for (const path of [basePath, `${basePath}-wal`, `${basePath}-shm`]) {
      if (existsSync(path)) {
        rmSync(path, { force: true });
      }
    }
  }

  /**
   * Serializes async work for one plugin id.
   *
   * @param pluginId - Plugin manifest id.
   * @param task - Synchronous or asynchronous work to run after prior tasks finish.
   */
  #enqueue<T>(pluginId: string, task: () => T | Promise<T>): Promise<T> {
    assertValidPluginId(pluginId);
    const previous = this.#queues.get(pluginId) ?? Promise.resolve();
    const next = previous.then(() => task()) as Promise<T>;
    this.#queues.set(
      pluginId,
      next.catch(() => undefined)
    );
    return next;
  }

  /**
   * Opens or returns a cached database connection for one plugin.
   *
   * @param pluginId - Plugin manifest id.
   */
  #open(pluginId: string): Database.Database {
    assertValidPluginId(pluginId);
    const existing = this.#connections.get(pluginId);
    if (existing) {
      return existing;
    }

    const dir = join(this.#userDataPath, PLUGIN_DATABASES_DIR);
    mkdirSync(dir, { recursive: true });
    const db = new Database(this.#dbPath(pluginId));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('trusted_schema = OFF');
    this.#connections.set(pluginId, db);
    return db;
  }

  /**
   * Resolves the on-disk path for one plugin database file.
   *
   * @param pluginId - Plugin manifest id.
   */
  #dbPath(pluginId: string): string {
    return join(this.#userDataPath, PLUGIN_DATABASES_DIR, `${pluginId}.sqlite`);
  }

  /**
   * Runs one query mode against the plugin connection.
   *
   * @param pluginId - Plugin manifest id.
   * @param mode - Query shape to execute.
   * @param sql - Single-statement SQL.
   * @param params - Bound parameter values.
   * @param txnId - Active transaction id when applicable.
   */
  #query(
    pluginId: string,
    mode: QueryMode,
    sql: string,
    params: unknown[],
    txnId?: string
  ): unknown {
    if (txnId) {
      this.#requireTransaction(pluginId, txnId);
    }

    const db = this.#open(pluginId);
    const statement = db.prepare(sql);

    if (mode === 'get') {
      const row = statement.get(...params) as Record<string, unknown> | undefined;
      return row ? cloneRow(row) : undefined;
    }

    if (mode === 'all') {
      const rows = statement.all(...params) as Record<string, unknown>[];
      return rows.map(cloneRow);
    }

    const result = statement.run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: normalizeLastInsertRowid(result.lastInsertRowid)
    };
  }

  /**
   * Rolls back and clears one timed-out or abandoned transaction.
   *
   * @param txnId - Transaction id.
   * @param reason - Error message when the timeout fired.
   */
  #rollbackTransaction(txnId: string, reason: string): void {
    const txn = this.#transactions.get(txnId);
    if (!txn) {
      return;
    }
    clearTimeout(txn.timeout);
    this.#transactions.delete(txnId);
    try {
      const db = this.#connections.get(txn.pluginId);
      db?.exec('ROLLBACK');
    } catch {
      // Ignore rollback failures during timeout cleanup.
    }
    console.warn(reason);
  }

  /**
   * Validates a transaction id belongs to the expected plugin.
   *
   * @param pluginId - Plugin manifest id.
   * @param txnId - Transaction id.
   */
  #requireTransaction(pluginId: string, txnId: string): ActiveTransaction {
    const txn = this.#transactions.get(txnId);
    if (!txn || txn.pluginId !== pluginId) {
      throw new Error(`Unknown plugin database transaction: ${txnId}`);
    }
    return txn;
  }

  /**
   * Closes one connection and rolls back any open transactions for that plugin.
   *
   * @param pluginId - Plugin manifest id.
   */
  #closeConnection(pluginId: string): void {
    for (const [txnId, txn] of [...this.#transactions.entries()]) {
      if (txn.pluginId !== pluginId) {
        continue;
      }
      clearTimeout(txn.timeout);
      this.#transactions.delete(txnId);
    }

    const db = this.#connections.get(pluginId);
    if (!db) {
      return;
    }

    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore when no transaction is active.
    }
    db.close();
    this.#connections.delete(pluginId);
  }
}

/**
 * Validates a plugin manifest id before using it in filesystem paths.
 *
 * @param pluginId - Plugin manifest id.
 */
export function assertValidPluginId(pluginId: string): void {
  if (!PLUGIN_ID_PATTERN.test(pluginId)) {
    throw new Error(`Invalid plugin id: ${pluginId}`);
  }
}

/**
 * Rejects dangerous statements in multi-statement exec scripts.
 *
 * @param sql - Raw SQL script.
 */
export function assertSafeExecSql(sql: string): void {
  const stripped = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (FORBIDDEN_EXEC_PATTERN.test(stripped)) {
    throw new Error('Plugin database exec rejects ATTACH, DETACH, and load_extension.');
  }
}

/**
 * Converts a SQLite row into structured-clone-safe values for IPC.
 *
 * @param row - Raw row object from better-sqlite3.
 */
function cloneRow(row: Record<string, unknown>): Record<string, unknown> {
  const cloned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    cloned[key] = cloneValue(value);
  }
  return cloned;
}

/**
 * Converts one SQLite cell value into a structured-clone-safe representation.
 *
 * @param value - Raw cell value.
 */
function cloneValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Buffer.isBuffer(value)) {
    return new Uint8Array(value);
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const cloned: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(record)) {
      cloned[key] = cloneValue(nested);
    }
    return cloned;
  }
  return value;
}

/**
 * Normalizes SQLite last insert row ids for IPC serialization.
 *
 * @param value - Raw last insert row id from better-sqlite3.
 */
function normalizeLastInsertRowid(value: number | bigint): number | string {
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  return Number.isSafeInteger(value) ? value : String(value);
}
