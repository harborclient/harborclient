import Database from 'better-sqlite3';
import { app } from 'electron';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  maskVariablesForExport,
  normalizeVariable,
  validateCollectionExport
} from '#/main/db/collectionData';
import {
  rowToCollection,
  rowToEnvironment,
  rowToFolder,
  rowToRequest
} from '#/main/db/entityMappers';
import type { IDatabase } from '#/main/db/IDatabase';
import type {
  Collection,
  CollectionExport,
  Environment,
  Folder,
  KeyValue,
  SaveRequestInput,
  SavedRequest,
  SqliteSettings,
  Variable
} from '#/shared/types';
import { parseJson } from '#/shared/parseJson';

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
      comment TEXT NOT NULL DEFAULT '',
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

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
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
    const hasRequestComment = requestColumns.some((col) => col.name === 'comment');
    if (!hasRequestComment) {
      this.#db.exec("ALTER TABLE requests ADD COLUMN comment TEXT NOT NULL DEFAULT ''");
    }
    const hasFolderId = requestColumns.some((col) => col.name === 'folder_id');
    if (!hasFolderId) {
      this.#db.exec('ALTER TABLE requests ADD COLUMN folder_id INTEGER');
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
    const comment = input.comment ?? '';
    const folderId = input.folder_id ?? null;
    const now = new Date().toISOString();

    if (input.id) {
      const result = this.getDb()
        .prepare(
          `UPDATE requests SET
          collection_id = ?, folder_id = ?, name = ?, method = ?, url = ?,
          headers = ?, params = ?, body = ?, body_type = ?,
          pre_request_script = ?, post_request_script = ?, comment = ?,
          updated_at = ?
        WHERE id = ?`
        )
        .run(
          input.collection_id,
          folderId,
          input.name.trim(),
          input.method,
          input.url,
          headers,
          params,
          input.body,
          input.body_type,
          preRequestScript,
          postRequestScript,
          comment,
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
        `SELECT COALESCE(MAX(sort_order), -1) as max_order FROM requests
         WHERE collection_id = ? AND ((? IS NULL AND folder_id IS NULL) OR folder_id = ?)`
      )
      .get(input.collection_id, folderId, folderId) as { max_order: number };

    const result = this.getDb()
      .prepare(
        `INSERT INTO requests (
        collection_id, folder_id, name, method, url, headers, params, body, body_type,
        pre_request_script, post_request_script, comment, sort_order, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.collection_id,
        folderId,
        input.name.trim(),
        input.method,
        input.url,
        headers,
        params,
        input.body,
        input.body_type,
        preRequestScript,
        postRequestScript,
        comment,
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

  async listFolders(collectionId: number): Promise<Folder[]> {
    const rows = this.getDb()
      .prepare('SELECT * FROM folders WHERE collection_id = ? ORDER BY sort_order ASC, name ASC')
      .all(collectionId) as Record<string, unknown>[];

    return rows.map(rowToFolder);
  }

  async createFolder(collectionId: number, name: string): Promise<Folder> {
    const maxOrder = this.getDb()
      .prepare(
        'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM folders WHERE collection_id = ?'
      )
      .get(collectionId) as { max_order: number };

    const result = this.getDb()
      .prepare('INSERT INTO folders (collection_id, name, sort_order) VALUES (?, ?, ?)')
      .run(collectionId, name.trim(), maxOrder.max_order + 1);

    const row = this.getDb()
      .prepare('SELECT * FROM folders WHERE id = ?')
      .get(result.lastInsertRowid) as Record<string, unknown>;

    return rowToFolder(row);
  }

  async renameFolder(id: number, name: string): Promise<Folder> {
    const result = this.getDb()
      .prepare('UPDATE folders SET name = ? WHERE id = ?')
      .run(name.trim(), id);

    if (result.changes === 0) throw new Error('Folder not found');

    const row = this.getDb().prepare('SELECT * FROM folders WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!row) throw new Error('Folder not found');
    return rowToFolder(row);
  }

  async deleteFolder(id: number): Promise<void> {
    const database = this.getDb();
    const deleteRequests = database.transaction((folderId: number) => {
      database.prepare('DELETE FROM requests WHERE folder_id = ?').run(folderId);
      database.prepare('DELETE FROM folders WHERE id = ?').run(folderId);
    });
    deleteRequests(id);
  }

  async reorderFolders(collectionId: number, orderedFolderIds: number[]): Promise<void> {
    const reorder = this.getDb().transaction((ids: number[]) => {
      const stmt = this.getDb().prepare(
        'UPDATE folders SET sort_order = ? WHERE id = ? AND collection_id = ?'
      );
      ids.forEach((folderId, index) => {
        stmt.run(index, folderId, collectionId);
      });
    });
    reorder(orderedFolderIds);
  }

  async reorderRequests(
    collectionId: number,
    folderId: number | null,
    orderedRequestIds: number[]
  ): Promise<void> {
    const reorder = this.getDb().transaction((ids: number[]) => {
      const stmt = this.getDb().prepare(
        'UPDATE requests SET sort_order = ?, folder_id = ? WHERE id = ? AND collection_id = ?'
      );
      ids.forEach((requestId, index) => {
        stmt.run(index, folderId, requestId, collectionId);
      });
    });
    reorder(orderedRequestIds);
  }

  async moveRequest(requestId: number, folderId: number | null, index: number): Promise<void> {
    const database = this.getDb();
    const row = database.prepare('SELECT * FROM requests WHERE id = ?').get(requestId) as
      | Record<string, unknown>
      | undefined;

    if (!row) throw new Error('Request not found');

    const request = rowToRequest(row);
    const collectionId = request.collection_id;
    const oldFolderId = request.folder_id;

    if (folderId != null) {
      const folderRow = database
        .prepare('SELECT collection_id FROM folders WHERE id = ?')
        .get(folderId) as { collection_id: number } | undefined;
      if (!folderRow || folderRow.collection_id !== collectionId) {
        throw new Error('Folder not found');
      }
    }

    const listInContainer = (targetFolderId: number | null): SavedRequest[] => {
      const rows = database
        .prepare(
          `SELECT * FROM requests WHERE collection_id = ?
           AND ((? IS NULL AND folder_id IS NULL) OR folder_id = ?)
           ORDER BY sort_order ASC, name ASC`
        )
        .all(collectionId, targetFolderId, targetFolderId) as Record<string, unknown>[];
      return rows.map(rowToRequest);
    };

    const reindexContainer = (targetFolderId: number | null, orderedIds: number[]): void => {
      const updateSort = database.prepare('UPDATE requests SET sort_order = ? WHERE id = ?');
      const updateFolder =
        targetFolderId == null
          ? database.prepare('UPDATE requests SET folder_id = NULL WHERE id = ?')
          : database.prepare('UPDATE requests SET folder_id = ? WHERE id = ?');

      orderedIds.forEach((id, sortIndex) => {
        if (targetFolderId == null) {
          updateFolder.run(id);
        } else {
          updateFolder.run(targetFolderId, id);
        }
        updateSort.run(sortIndex, id);
      });
    };

    if (oldFolderId === folderId) {
      const siblings = listInContainer(folderId)
        .map((item) => item.id)
        .filter((id) => id !== requestId);
      siblings.splice(index, 0, requestId);
      reindexContainer(folderId, siblings);
      return;
    }

    const oldIds = listInContainer(oldFolderId)
      .map((item) => item.id)
      .filter((id) => id !== requestId);
    reindexContainer(oldFolderId, oldIds);

    const newIds = listInContainer(folderId)
      .map((item) => item.id)
      .filter((id) => id !== requestId);
    newIds.splice(index, 0, requestId);
    reindexContainer(folderId, newIds);
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

    const folders = (await this.listFolders(id)).map(({ name, sort_order }) => ({
      name,
      sort_order
    }));
    const folderNameById = new Map(
      (await this.listFolders(id)).map((folder) => [folder.id, folder.name])
    );

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
        comment,
        sort_order,
        folder_id
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
        comment,
        sort_order,
        folder_name: folder_id != null ? (folderNameById.get(folder_id) ?? null) : null
      })
    );

    const variables = parseJson<Partial<Variable>[]>(row.variables, []).map(normalizeVariable);
    const headers = parseJson<KeyValue[]>(row.headers, []);

    return {
      formatVersion: 2,
      name: row.name,
      variables: maskVariablesForExport(variables),
      headers,
      pre_request_script: row.pre_request_script ?? '',
      post_request_script: row.post_request_script ?? '',
      folders,
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
      const folderIdByName = new Map<string, number>();

      for (const folder of payload.folders ?? []) {
        const folderResult = database
          .prepare('INSERT INTO folders (collection_id, name, sort_order) VALUES (?, ?, ?)')
          .run(collectionId, folder.name, folder.sort_order);
        folderIdByName.set(folder.name, Number(folderResult.lastInsertRowid));
      }

      const insertRequest = database.prepare(
        `INSERT INTO requests (
        collection_id, folder_id, name, method, url, headers, params, body, body_type,
        pre_request_script, post_request_script, comment, sort_order, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const request of payload.requests) {
        const folderName = request.folder_name ?? null;
        const folderId =
          folderName != null && folderName.trim() ? (folderIdByName.get(folderName) ?? null) : null;

        insertRequest.run(
          collectionId,
          folderId,
          request.name,
          request.method,
          request.url,
          JSON.stringify(request.headers),
          JSON.stringify(request.params),
          request.body,
          request.body_type,
          request.pre_request_script,
          request.post_request_script,
          request.comment,
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
