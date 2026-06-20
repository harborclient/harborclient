import Database from 'better-sqlite3';
import { app } from 'electron';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  maskVariablesForExport,
  normalizeVariable,
  validateCollectionExport
} from '#/main/db/collectionData';
import type { IDatabase } from '#/main/db/IDatabase';
import type {
  BodyType,
  Collection,
  CollectionExport,
  Environment,
  HttpMethod,
  KeyValue,
  SaveRequestInput,
  SavedRequest,
  SqliteSettings,
  Variable
} from '#/shared/types';

/**
 * Resolves the SQLite database path, copying from legacy locations when needed.
 *
 * @param userDataPath - Electron app userData path where the database file is stored.
 * @param settings - SQLite filename and legacy migration settings.
 * @returns Path to the database file to open.
 */
function resolveDbPath(userDataPath: string, settings: SqliteSettings): string {
  const dbPath = join(userDataPath, settings.dbFilename);
  if (existsSync(dbPath)) return dbPath;

  const legacyCandidates = [
    join(app.getPath('appData'), settings.legacyUserDataDir, settings.legacyDbFilename),
    join(userDataPath, settings.legacyDbFilename)
  ];

  for (const legacyPath of legacyCandidates) {
    if (existsSync(legacyPath)) {
      mkdirSync(userDataPath, { recursive: true });
      copyFileSync(legacyPath, dbPath);
      return dbPath;
    }
  }

  return dbPath;
}

/**
 * Parses a JSON string, returning a fallback value on failure.
 *
 * @param value - JSON string to parse.
 * @param fallback - Value returned when parsing fails.
 * @returns Parsed value or fallback.
 */
function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Maps a raw SQLite row to a Collection object.
 *
 * @param row - Database row from the collections table.
 * @returns Normalized collection.
 */
function rowToCollection(row: Record<string, unknown>): Collection {
  return {
    id: row.id as number,
    name: row.name as string,
    variables: parseJson<Partial<Variable>[]>(row.variables as string, []).map(normalizeVariable),
    headers: parseJson<KeyValue[]>(row.headers as string, []),
    pre_request_script: (row.pre_request_script as string) ?? '',
    post_request_script: (row.post_request_script as string) ?? '',
    created_at: row.created_at as string
  };
}

/**
 * Maps a raw SQLite row to an Environment object.
 *
 * @param row - Database row from the environments table.
 * @returns Normalized environment.
 */
function rowToEnvironment(row: Record<string, unknown>): Environment {
  return {
    id: row.id as number,
    name: row.name as string,
    variables: parseJson<Partial<Variable>[]>(row.variables as string, []).map(normalizeVariable),
    created_at: row.created_at as string
  };
}

/**
 * Maps a raw SQLite row to a SavedRequest object.
 *
 * @param row - Database row from the requests table.
 * @returns Normalized saved request.
 */
function rowToRequest(row: Record<string, unknown>): SavedRequest {
  return {
    id: row.id as number,
    collection_id: row.collection_id as number,
    name: row.name as string,
    method: row.method as HttpMethod,
    url: row.url as string,
    headers: parseJson<KeyValue[]>(row.headers as string, []),
    params: parseJson<KeyValue[]>(row.params as string, []),
    body: (row.body as string) ?? '',
    body_type: row.body_type as BodyType,
    pre_request_script: (row.pre_request_script as string) ?? '',
    post_request_script: (row.post_request_script as string) ?? '',
    sort_order: row.sort_order as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  };
}

export class SqliteDatabase implements IDatabase {
  #db: Database.Database | null = null;
  readonly #userDataPath: string;
  readonly #settings: SqliteSettings;

  /**
   * @param userDataPath - Electron app userData path where the database file is stored.
   * @param settings - SQLite filename and legacy migration settings.
   */
  constructor(userDataPath: string, settings: SqliteSettings) {
    this.#userDataPath = userDataPath;
    this.#settings = settings;
  }

  /**
   * Returns the active database handle.
   *
   * @returns The initialized database handle.
   * @throws When init has not been called yet.
   */
  private getDb(): Database.Database {
    if (!this.#db) throw new Error('Database not initialized');
    return this.#db;
  }

  /**
   * Opens the SQLite database for the configured user-data directory.
   */
  async init(): Promise<void> {
    if (this.#db) return;

    const dbPath = resolveDbPath(this.#userDataPath, this.#settings);
    this.#db = new Database(dbPath);
    this.#db.pragma('journal_mode = WAL');
    this.#db.pragma('foreign_keys = ON');

    this.#db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      variables TEXT NOT NULL DEFAULT '[]',
      headers TEXT NOT NULL DEFAULT '[]',
      pre_request_script TEXT NOT NULL DEFAULT '',
      post_request_script TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'GET',
      url TEXT NOT NULL DEFAULT '',
      headers TEXT NOT NULL DEFAULT '[]',
      params TEXT NOT NULL DEFAULT '[]',
      body TEXT NOT NULL DEFAULT '',
      body_type TEXT NOT NULL DEFAULT 'none',
      pre_request_script TEXT NOT NULL DEFAULT '',
      post_request_script TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS environments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      variables TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

    const columns = this.#db.prepare('PRAGMA table_info(collections)').all() as Array<{
      name: string;
    }>;
    const hasVariables = columns.some((col) => col.name === 'variables');
    if (!hasVariables) {
      this.#db.exec("ALTER TABLE collections ADD COLUMN variables TEXT NOT NULL DEFAULT '[]'");
    }
    const hasHeaders = columns.some((col) => col.name === 'headers');
    if (!hasHeaders) {
      this.#db.exec("ALTER TABLE collections ADD COLUMN headers TEXT NOT NULL DEFAULT '[]'");
    }
    const hasCollectionPreScript = columns.some((col) => col.name === 'pre_request_script');
    if (!hasCollectionPreScript) {
      this.#db.exec(
        "ALTER TABLE collections ADD COLUMN pre_request_script TEXT NOT NULL DEFAULT ''"
      );
    }
    const hasCollectionPostScript = columns.some((col) => col.name === 'post_request_script');
    if (!hasCollectionPostScript) {
      this.#db.exec(
        "ALTER TABLE collections ADD COLUMN post_request_script TEXT NOT NULL DEFAULT ''"
      );
    }

    const requestColumns = this.#db.prepare('PRAGMA table_info(requests)').all() as Array<{
      name: string;
    }>;
    const hasRequestPreScript = requestColumns.some((col) => col.name === 'pre_request_script');
    if (!hasRequestPreScript) {
      this.#db.exec("ALTER TABLE requests ADD COLUMN pre_request_script TEXT NOT NULL DEFAULT ''");
    }
    const hasRequestPostScript = requestColumns.some((col) => col.name === 'post_request_script');
    if (!hasRequestPostScript) {
      this.#db.exec("ALTER TABLE requests ADD COLUMN post_request_script TEXT NOT NULL DEFAULT ''");
    }
  }

  async listCollections(): Promise<Collection[]> {
    const rows = this.getDb()
      .prepare(
        'SELECT id, name, variables, headers, pre_request_script, post_request_script, created_at FROM collections ORDER BY name ASC'
      )
      .all() as Record<string, unknown>[];

    return rows.map(rowToCollection);
  }

  async createCollection(name: string): Promise<Collection> {
    const result = this.getDb()
      .prepare('INSERT INTO collections (name) VALUES (?)')
      .run(name.trim());

    const row = this.getDb()
      .prepare(
        'SELECT id, name, variables, headers, pre_request_script, post_request_script, created_at FROM collections WHERE id = ?'
      )
      .get(result.lastInsertRowid) as Record<string, unknown>;

    return rowToCollection(row);
  }

  async updateCollection(
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string
  ): Promise<Collection> {
    this.getDb()
      .prepare(
        'UPDATE collections SET name = ?, variables = ?, headers = ?, pre_request_script = ?, post_request_script = ? WHERE id = ?'
      )
      .run(
        name.trim(),
        JSON.stringify(variables),
        JSON.stringify(headers),
        preRequestScript,
        postRequestScript,
        id
      );

    const row = this.getDb()
      .prepare(
        'SELECT id, name, variables, headers, pre_request_script, post_request_script, created_at FROM collections WHERE id = ?'
      )
      .get(id) as Record<string, unknown> | undefined;

    if (!row) throw new Error('Collection not found');
    return rowToCollection(row);
  }

  async deleteCollection(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM collections WHERE id = ?').run(id);
  }

  async listEnvironments(): Promise<Environment[]> {
    const rows = this.getDb()
      .prepare('SELECT id, name, variables, created_at FROM environments ORDER BY name ASC')
      .all() as Record<string, unknown>[];

    return rows.map(rowToEnvironment);
  }

  async createEnvironment(name: string): Promise<Environment> {
    const result = this.getDb()
      .prepare('INSERT INTO environments (name) VALUES (?)')
      .run(name.trim());

    const row = this.getDb()
      .prepare('SELECT id, name, variables, created_at FROM environments WHERE id = ?')
      .get(result.lastInsertRowid) as Record<string, unknown>;

    return rowToEnvironment(row);
  }

  async updateEnvironment(id: number, name: string, variables: Variable[]): Promise<Environment> {
    this.getDb()
      .prepare('UPDATE environments SET name = ?, variables = ? WHERE id = ?')
      .run(name.trim(), JSON.stringify(variables), id);

    const row = this.getDb()
      .prepare('SELECT id, name, variables, created_at FROM environments WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!row) throw new Error('Environment not found');
    return rowToEnvironment(row);
  }

  async deleteEnvironment(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM environments WHERE id = ?').run(id);
  }

  async listRequests(collectionId: number): Promise<SavedRequest[]> {
    const rows = this.getDb()
      .prepare('SELECT * FROM requests WHERE collection_id = ? ORDER BY sort_order ASC, name ASC')
      .all(collectionId) as Record<string, unknown>[];

    return rows.map(rowToRequest);
  }

  async saveRequest(input: SaveRequestInput): Promise<SavedRequest> {
    const headers = JSON.stringify(input.headers);
    const params = JSON.stringify(input.params);
    const preRequestScript = input.pre_request_script ?? '';
    const postRequestScript = input.post_request_script ?? '';
    const now = new Date().toISOString();

    if (input.id) {
      const result = this.getDb()
        .prepare(
          `UPDATE requests SET
          collection_id = ?, name = ?, method = ?, url = ?,
          headers = ?, params = ?, body = ?, body_type = ?,
          pre_request_script = ?, post_request_script = ?,
          updated_at = ?
        WHERE id = ?`
        )
        .run(
          input.collection_id,
          input.name.trim(),
          input.method,
          input.url,
          headers,
          params,
          input.body,
          input.body_type,
          preRequestScript,
          postRequestScript,
          now,
          input.id
        );

      if (result.changes > 0) {
        const row = this.getDb().prepare('SELECT * FROM requests WHERE id = ?').get(input.id);
        if (row) return rowToRequest(row as Record<string, unknown>);
      }
    }

    const maxOrder = this.getDb()
      .prepare(
        'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM requests WHERE collection_id = ?'
      )
      .get(input.collection_id) as { max_order: number };

    const result = this.getDb()
      .prepare(
        `INSERT INTO requests (
        collection_id, name, method, url, headers, params, body, body_type,
        pre_request_script, post_request_script, sort_order, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.collection_id,
        input.name.trim(),
        input.method,
        input.url,
        headers,
        params,
        input.body,
        input.body_type,
        preRequestScript,
        postRequestScript,
        maxOrder.max_order + 1,
        now
      );

    const row = this.getDb()
      .prepare('SELECT * FROM requests WHERE id = ?')
      .get(result.lastInsertRowid);

    if (!row) throw new Error('Request not found after insert');
    return rowToRequest(row as Record<string, unknown>);
  }

  async deleteRequest(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM requests WHERE id = ?').run(id);
  }

  async exportCollectionData(id: number): Promise<CollectionExport> {
    const row = this.getDb()
      .prepare(
        'SELECT name, variables, headers, pre_request_script, post_request_script FROM collections WHERE id = ?'
      )
      .get(id) as
      | {
          name: string;
          variables: string;
          headers: string;
          pre_request_script: string;
          post_request_script: string;
        }
      | undefined;

    if (!row) throw new Error('Collection not found');

    const requests = (await this.listRequests(id)).map(
      ({
        name,
        method,
        url,
        headers,
        params,
        body,
        body_type,
        pre_request_script,
        post_request_script,
        sort_order
      }) => ({
        name,
        method,
        url,
        headers,
        params,
        body,
        body_type,
        pre_request_script,
        post_request_script,
        sort_order
      })
    );

    const variables = parseJson<Partial<Variable>[]>(row.variables, []).map(normalizeVariable);
    const headers = parseJson<KeyValue[]>(row.headers, []);

    return {
      formatVersion: 1,
      name: row.name,
      variables: maskVariablesForExport(variables),
      headers,
      pre_request_script: row.pre_request_script ?? '',
      post_request_script: row.post_request_script ?? '',
      requests
    };
  }

  async importCollectionData(data: unknown): Promise<Collection> {
    const exportData = validateCollectionExport(data);
    const database = this.getDb();
    const now = new Date().toISOString();

    const importCollection = database.transaction((payload: CollectionExport) => {
      const collectionResult = database
        .prepare(
          'INSERT INTO collections (name, variables, headers, pre_request_script, post_request_script) VALUES (?, ?, ?, ?, ?)'
        )
        .run(
          payload.name,
          JSON.stringify(payload.variables),
          JSON.stringify(payload.headers),
          payload.pre_request_script,
          payload.post_request_script
        );

      const collectionId = Number(collectionResult.lastInsertRowid);
      const insertRequest = database.prepare(
        `INSERT INTO requests (
        collection_id, name, method, url, headers, params, body, body_type,
        pre_request_script, post_request_script, sort_order, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const request of payload.requests) {
        insertRequest.run(
          collectionId,
          request.name,
          request.method,
          request.url,
          JSON.stringify(request.headers),
          JSON.stringify(request.params),
          request.body,
          request.body_type,
          request.pre_request_script,
          request.post_request_script,
          request.sort_order,
          now
        );
      }

      const row = database
        .prepare(
          'SELECT id, name, variables, headers, pre_request_script, post_request_script, created_at FROM collections WHERE id = ?'
        )
        .get(collectionId) as Record<string, unknown>;

      return rowToCollection(row);
    });

    return importCollection(exportData);
  }

  async getSetting(key: string): Promise<string | undefined> {
    const row = this.getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.getDb()
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
      )
      .run(key, value, value);
  }

  async close(): Promise<void> {
    if (this.#db) {
      this.#db.close();
      this.#db = null;
    }
  }
}
