import Database from 'better-sqlite3';
import { app } from 'electron';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  buildFolderImportMaps,
  buildRequestUuidIndex,
  planImportedFolderUpsert,
  registerImportedFolderInMaps,
  resolveImportFolderId,
  resolveImportedCollectionUuid,
  resolveImportedFolderUuid,
  serializeImportedRequestFields
} from '#/main/db/collectionImport';
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
import { trimRequiredName } from '#/main/db/trimRequiredName';
import { DEFAULT_AUTH_JSON, defaultAuth, normalizeAuth } from '#/shared/auth';
import type { IDatabase } from '#/main/db/IDatabase';
import type {
  AuthConfig,
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
import { generateDocumentUuid } from '#/main/db/uuid';

const COLLECTION_COLUMNS =
  'id, uuid, name, variables, headers, auth, pre_request_script, post_request_script, created_at';
const ENVIRONMENT_COLUMNS = 'id, uuid, name, variables, created_at';

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
      auth TEXT NOT NULL DEFAULT '${DEFAULT_AUTH_JSON.replace(/'/g, "''")}',
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
      auth TEXT NOT NULL DEFAULT '${DEFAULT_AUTH_JSON.replace(/'/g, "''")}',
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
    const hasCollectionAuth = columns.some((col) => col.name === 'auth');
    if (!hasCollectionAuth) {
      this.#db.exec(
        `ALTER TABLE collections ADD COLUMN auth TEXT NOT NULL DEFAULT '${DEFAULT_AUTH_JSON.replace(/'/g, "''")}'`
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
    const hasRequestAuth = requestColumns.some((col) => col.name === 'auth');
    if (!hasRequestAuth) {
      this.#db.exec(
        `ALTER TABLE requests ADD COLUMN auth TEXT NOT NULL DEFAULT '${DEFAULT_AUTH_JSON.replace(/'/g, "''")}'`
      );
    }

    this.migrateDocumentUuidColumn('collections');
    this.migrateDocumentUuidColumn('requests');
    this.migrateDocumentUuidColumn('environments');
    this.migrateDocumentUuidColumn('folders');
    this.backfillDocumentUuids('collections');
    this.backfillDocumentUuids('requests');
    this.backfillDocumentUuids('environments');
    this.backfillDocumentUuids('folders');
  }

  /**
   * Adds a uuid column to a document table when missing from legacy databases.
   *
   * @param table - Table name (`collections`, `requests`, `environments`, or `folders`).
   */
  private migrateDocumentUuidColumn(
    table: 'collections' | 'requests' | 'environments' | 'folders'
  ): void {
    const columns = this.getDb().prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string;
    }>;
    if (columns.some((col) => col.name === 'uuid')) {
      return;
    }
    this.getDb().exec(`ALTER TABLE ${table} ADD COLUMN uuid TEXT NOT NULL DEFAULT ''`);
  }

  /**
   * Assigns uuids to rows that were created before uuid support existed.
   *
   * @param table - Table name (`collections`, `requests`, `environments`, or `folders`).
   */
  private backfillDocumentUuids(
    table: 'collections' | 'requests' | 'environments' | 'folders'
  ): void {
    const database = this.getDb();
    const rows = database
      .prepare(`SELECT id FROM ${table} WHERE uuid IS NULL OR uuid = ''`)
      .all() as Array<{ id: number }>;
    if (rows.length === 0) {
      return;
    }

    const update = database.prepare(`UPDATE ${table} SET uuid = ? WHERE id = ?`);
    const backfill = database.transaction((items: Array<{ id: number }>) => {
      for (const row of items) {
        update.run(generateDocumentUuid(), row.id);
      }
    });
    backfill(rows);
  }

  /**
   * Lists all collections ordered by name.
   *
   * @returns All collections in the database.
   */
  async listCollections(): Promise<Collection[]> {
    const rows = this.getDb()
      .prepare(`SELECT ${COLLECTION_COLUMNS} FROM collections ORDER BY name ASC`)
      .all() as Record<string, unknown>[];

    return rows.map(rowToCollection);
  }

  /**
   * Creates a new collection with the given name.
   *
   * @param name - Display name for the collection.
   * @returns The newly created collection.
   */
  async createCollection(name: string): Promise<Collection> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const collectionUuid = generateDocumentUuid();
    const result = this.getDb()
      .prepare('INSERT INTO collections (name, uuid) VALUES (?, ?)')
      .run(trimmedName, collectionUuid);

    const row = this.getDb()
      .prepare(`SELECT ${COLLECTION_COLUMNS} FROM collections WHERE id = ?`)
      .get(result.lastInsertRowid) as Record<string, unknown>;

    return rowToCollection(row);
  }

  /**
   * Updates a collection's name, variables, headers, and scripts.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   * @param preRequestScript - Script run before each request in the collection.
   * @param postRequestScript - Script run after each request in the collection.
   * @param auth - Default Authorization settings for requests in the collection.
   * @returns The updated collection.
   */
  /**
   * Updates a collection's name, variables, headers, and scripts.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   * @param preRequestScript - Script run before each request in the collection.
   * @param postRequestScript - Script run after each request in the collection.
   * @param auth - Default Authorization settings for requests in the collection.
   * @returns The updated collection.
   */
  async updateCollection(
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig
  ): Promise<Collection> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    this.getDb()
      .prepare(
        'UPDATE collections SET name = ?, variables = ?, headers = ?, auth = ?, pre_request_script = ?, post_request_script = ? WHERE id = ?'
      )
      .run(
        trimmedName,
        JSON.stringify(variables),
        JSON.stringify(headers),
        JSON.stringify(auth),
        preRequestScript,
        postRequestScript,
        id
      );

    const row = this.getDb()
      .prepare(`SELECT ${COLLECTION_COLUMNS} FROM collections WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;

    if (!row) throw new Error('Collection not found');
    return rowToCollection(row);
  }

  /**
   * Deletes a collection and all of its requests.
   *
   * @param id - Collection ID to delete.
   */
  async deleteCollection(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM collections WHERE id = ?').run(id);
  }

  /**
   * Lists all environments ordered by name.
   *
   * @returns All environments in the database.
   */
  async listEnvironments(): Promise<Environment[]> {
    const rows = this.getDb()
      .prepare(`SELECT ${ENVIRONMENT_COLUMNS} FROM environments ORDER BY name ASC`)
      .all() as Record<string, unknown>[];

    return rows.map(rowToEnvironment);
  }

  /**
   * Creates a new environment with the given name.
   *
   * @param name - Display name for the environment.
   * @returns The newly created environment.
   */
  async createEnvironment(name: string, uuid?: string): Promise<Environment> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const environmentUuid = uuid?.trim() || generateDocumentUuid();
    const result = this.getDb()
      .prepare('INSERT INTO environments (name, uuid) VALUES (?, ?)')
      .run(trimmedName, environmentUuid);

    const row = this.getDb()
      .prepare(`SELECT ${ENVIRONMENT_COLUMNS} FROM environments WHERE id = ?`)
      .get(result.lastInsertRowid) as Record<string, unknown>;

    return rowToEnvironment(row);
  }

  /**
   * Updates an environment's name and variables.
   *
   * @param id - Environment ID to update.
   * @param name - New display name.
   * @param variables - Environment-scoped variables.
   * @returns The updated environment.
   */
  async updateEnvironment(id: number, name: string, variables: Variable[]): Promise<Environment> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    this.getDb()
      .prepare('UPDATE environments SET name = ?, variables = ? WHERE id = ?')
      .run(trimmedName, JSON.stringify(variables), id);

    const row = this.getDb()
      .prepare(`SELECT ${ENVIRONMENT_COLUMNS} FROM environments WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;

    if (!row) throw new Error('Environment not found');
    return rowToEnvironment(row);
  }

  /**
   * Deletes an environment.
   *
   * @param id - Environment ID to delete.
   */
  async deleteEnvironment(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM environments WHERE id = ?').run(id);
  }

  /**
   * Lists all saved requests in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Requests ordered by sort_order then name.
   */
  async listRequests(collectionId: number): Promise<SavedRequest[]> {
    const rows = this.getDb()
      .prepare('SELECT * FROM requests WHERE collection_id = ? ORDER BY sort_order ASC, name ASC')
      .all(collectionId) as Record<string, unknown>[];

    return rows.map(rowToRequest);
  }

  /**
   * Inserts a new request or updates an existing one.
   *
   * @param input - Request fields to persist.
   * @returns The saved request with ID and timestamps.
   */
  async saveRequest(input: SaveRequestInput): Promise<SavedRequest> {
    const trimmedName = trimRequiredName(input.name, 'Request name');
    const headers = JSON.stringify(input.headers);
    const params = JSON.stringify(input.params);
    const auth = JSON.stringify(input.auth);
    const preRequestScript = input.pre_request_script ?? '';
    const postRequestScript = input.post_request_script ?? '';
    const comment = input.comment ?? '';
    const folderId = input.folder_id ?? null;
    const now = new Date().toISOString();

    if (folderId != null) {
      const folderRow = this.getDb()
        .prepare('SELECT collection_id FROM folders WHERE id = ?')
        .get(folderId) as { collection_id: number } | undefined;
      if (!folderRow || folderRow.collection_id !== input.collection_id) {
        throw new Error('Folder not found');
      }
    }

    if (input.id) {
      const result = this.getDb()
        .prepare(
          `UPDATE requests SET
          collection_id = ?, folder_id = ?, name = ?, method = ?, url = ?,
          headers = ?, params = ?, auth = ?, body = ?, body_type = ?,
          pre_request_script = ?, post_request_script = ?, comment = ?,
          updated_at = ?
        WHERE id = ?`
        )
        .run(
          input.collection_id,
          folderId,
          trimmedName,
          input.method,
          input.url,
          headers,
          params,
          auth,
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

    const requestUuid = input.uuid?.trim() || generateDocumentUuid();
    const maxOrder = this.getDb()
      .prepare(
        `SELECT COALESCE(MAX(sort_order), -1) as max_order FROM requests
         WHERE collection_id = ? AND ((? IS NULL AND folder_id IS NULL) OR folder_id = ?)`
      )
      .get(input.collection_id, folderId, folderId) as { max_order: number };

    const result = this.getDb()
      .prepare(
        `INSERT INTO requests (
        collection_id, folder_id, name, method, url, headers, params, auth, body, body_type,
        pre_request_script, post_request_script, comment, sort_order, uuid, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.collection_id,
        folderId,
        trimmedName,
        input.method,
        input.url,
        headers,
        params,
        auth,
        input.body,
        input.body_type,
        preRequestScript,
        postRequestScript,
        comment,
        maxOrder.max_order + 1,
        requestUuid,
        now
      );

    const row = this.getDb()
      .prepare('SELECT * FROM requests WHERE id = ?')
      .get(result.lastInsertRowid);

    if (!row) throw new Error('Request not found after insert');
    return rowToRequest(row as Record<string, unknown>);
  }

  /**
   * Deletes a saved request by ID.
   *
   * @param id - Request ID to delete.
   */
  async deleteRequest(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM requests WHERE id = ?').run(id);
  }

  /**
   * Lists all folders in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Folders ordered by sort_order then name.
   */
  async listFolders(collectionId: number): Promise<Folder[]> {
    const rows = this.getDb()
      .prepare('SELECT * FROM folders WHERE collection_id = ? ORDER BY sort_order ASC, name ASC')
      .all(collectionId) as Record<string, unknown>[];

    return rows.map(rowToFolder);
  }

  /**
   * Creates a new folder in a collection.
   *
   * @param collectionId - Collection to add the folder to.
   * @param name - Display name for the folder.
   * @returns The newly created folder.
   */
  async createFolder(collectionId: number, name: string): Promise<Folder> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    const maxOrder = this.getDb()
      .prepare(
        'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM folders WHERE collection_id = ?'
      )
      .get(collectionId) as { max_order: number };

    const result = this.getDb()
      .prepare('INSERT INTO folders (collection_id, name, sort_order, uuid) VALUES (?, ?, ?, ?)')
      .run(collectionId, trimmedName, maxOrder.max_order + 1, generateDocumentUuid());

    const row = this.getDb()
      .prepare('SELECT * FROM folders WHERE id = ?')
      .get(result.lastInsertRowid) as Record<string, unknown>;

    return rowToFolder(row);
  }

  /**
   * Renames a folder.
   *
   * @param id - Folder ID to rename.
   * @param name - New display name.
   * @returns The updated folder.
   */
  async renameFolder(id: number, name: string): Promise<Folder> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    const result = this.getDb()
      .prepare('UPDATE folders SET name = ? WHERE id = ?')
      .run(trimmedName, id);

    if (result.changes === 0) throw new Error('Folder not found');

    const row = this.getDb().prepare('SELECT * FROM folders WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!row) throw new Error('Folder not found');
    return rowToFolder(row);
  }

  /**
   * Deletes a folder and all requests inside it.
   *
   * @param id - Folder ID to delete.
   */
  async deleteFolder(id: number): Promise<void> {
    const database = this.getDb();
    const deleteRequests = database.transaction((folderId: number) => {
      database.prepare('DELETE FROM requests WHERE folder_id = ?').run(folderId);
      database.prepare('DELETE FROM folders WHERE id = ?').run(folderId);
    });
    deleteRequests(id);
  }

  /**
   * Reorders folders within a collection.
   *
   * @param collectionId - Collection containing the folders.
   * @param orderedFolderIds - Folder IDs in desired order.
   */
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

  /**
   * Reorders requests within a folder or at collection root.
   *
   * @param collectionId - Collection containing the requests.
   * @param folderId - Folder ID, or null for root-level requests.
   * @param orderedRequestIds - Request IDs in desired order.
   */
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

  /**
   * Moves a request to another folder or collection root at a given index.
   *
   * @param requestId - Request ID to move.
   * @param folderId - Destination folder ID, or null for collection root.
   * @param index - Zero-based position within the destination container.
   */
  async moveRequest(requestId: number, folderId: number | null, index: number): Promise<void> {
    const database = this.getDb();

    const listInContainer = (
      collectionId: number,
      targetFolderId: number | null
    ): SavedRequest[] => {
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

    // Wrap the read, validate, and reindex steps in a single transaction so a
    // concurrent move or mid-operation failure cannot leave duplicate or
    // gap-filled sort_order values across the source and destination containers.
    const runMove = database.transaction((): void => {
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

      if (oldFolderId === folderId) {
        const siblings = listInContainer(collectionId, folderId)
          .map((item) => item.id)
          .filter((id) => id !== requestId);
        siblings.splice(index, 0, requestId);
        reindexContainer(folderId, siblings);
        return;
      }

      const oldIds = listInContainer(collectionId, oldFolderId)
        .map((item) => item.id)
        .filter((id) => id !== requestId);
      reindexContainer(oldFolderId, oldIds);

      const newIds = listInContainer(collectionId, folderId)
        .map((item) => item.id)
        .filter((id) => id !== requestId);
      newIds.splice(index, 0, requestId);
      reindexContainer(folderId, newIds);
    });

    runMove();
  }

  /**
   * Builds a portable export payload for a collection and its requests.
   *
   * @param id - Collection ID to export.
   * @returns Collection export data without database IDs.
   */
  async exportCollectionData(id: number): Promise<CollectionExport> {
    const row = this.getDb()
      .prepare(
        'SELECT name, uuid, variables, headers, auth, pre_request_script, post_request_script FROM collections WHERE id = ?'
      )
      .get(id) as
      | {
          name: string;
          uuid: string;
          variables: string;
          headers: string;
          auth: string;
          pre_request_script: string;
          post_request_script: string;
        }
      | undefined;

    if (!row) throw new Error('Collection not found');

    const folderRows = await this.listFolders(id);
    const folders = folderRows.map(({ uuid, name, sort_order }) => ({
      uuid,
      name,
      sort_order
    }));
    const folderNameById = new Map(folderRows.map((folder) => [folder.id, folder.name]));
    const folderUuidById = new Map(folderRows.map((folder) => [folder.id, folder.uuid]));

    const requests = (await this.listRequests(id)).map(
      ({
        uuid,
        name,
        method,
        url,
        headers,
        params,
        auth,
        body,
        body_type,
        pre_request_script,
        post_request_script,
        comment,
        sort_order,
        folder_id
      }) => ({
        uuid,
        name,
        method,
        url,
        headers,
        params,
        auth,
        body,
        body_type,
        pre_request_script,
        post_request_script,
        comment,
        sort_order,
        folder_name: folder_id != null ? (folderNameById.get(folder_id) ?? null) : null,
        folder_uuid: folder_id != null ? (folderUuidById.get(folder_id) ?? null) : null
      })
    );

    const variables = parseJson<Partial<Variable>[]>(row.variables, []).map(normalizeVariable);
    const headers = parseJson<KeyValue[]>(row.headers, []);
    const auth = normalizeAuth(parseJson(row.auth, defaultAuth()));

    return {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid: row.uuid,
      name: row.name,
      variables: maskVariablesForExport(variables),
      headers,
      auth,
      pre_request_script: row.pre_request_script ?? '',
      post_request_script: row.post_request_script ?? '',
      folders,
      requests
    };
  }

  /**
   * Imports a collection and its requests from export data.
   *
   * @param data - Parsed collection export payload.
   * @returns The newly created collection.
   */
  async importCollectionData(data: unknown): Promise<Collection> {
    const exportData = validateCollectionExport(data);
    const database = this.getDb();
    const now = new Date().toISOString();

    const importCollection = database.transaction((payload: CollectionExport) => {
      const collectionUuid = resolveImportedCollectionUuid(payload);
      const collectionResult = database
        .prepare(
          'INSERT INTO collections (name, uuid, variables, headers, auth, pre_request_script, post_request_script) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          payload.name,
          collectionUuid,
          JSON.stringify(payload.variables),
          JSON.stringify(payload.headers),
          JSON.stringify(payload.auth ?? defaultAuth()),
          payload.pre_request_script,
          payload.post_request_script
        );

      const collectionId = Number(collectionResult.lastInsertRowid);
      const folderMaps: ReturnType<typeof buildFolderImportMaps> = {
        folderIdByUuid: new Map(),
        folderIdByName: new Map(),
        folderUuidById: new Map()
      };

      for (const folder of payload.folders ?? []) {
        const folderUuid = resolveImportedFolderUuid(folder);
        const folderResult = database
          .prepare(
            'INSERT INTO folders (collection_id, name, sort_order, uuid) VALUES (?, ?, ?, ?)'
          )
          .run(collectionId, folder.name, folder.sort_order, folderUuid);
        const folderId = Number(folderResult.lastInsertRowid);
        registerImportedFolderInMaps(folderMaps, folderId, folder.name, folderUuid);
      }

      const insertRequest = database.prepare(
        `INSERT INTO requests (
        collection_id, folder_id, name, method, url, headers, params, auth, body, body_type,
        pre_request_script, post_request_script, comment, sort_order, uuid, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const request of payload.requests) {
        const folderId = resolveImportFolderId(
          request.folder_uuid,
          request.folder_name,
          folderMaps.folderIdByUuid,
          folderMaps.folderIdByName
        );
        const fields = serializeImportedRequestFields(request);

        insertRequest.run(
          collectionId,
          folderId,
          fields.name,
          fields.method,
          fields.url,
          fields.headersJson,
          fields.paramsJson,
          fields.authJson,
          fields.body,
          fields.body_type,
          fields.pre_request_script,
          fields.post_request_script,
          fields.comment,
          fields.sort_order,
          fields.uuid,
          now
        );
      }

      const row = database
        .prepare(`SELECT ${COLLECTION_COLUMNS} FROM collections WHERE id = ?`)
        .get(collectionId) as Record<string, unknown>;

      return rowToCollection(row);
    });

    return importCollection(exportData);
  }

  /**
   * Looks up a collection by portable uuid within this SQLite store.
   *
   * @param uuid - Stable collection identifier.
   * @returns The collection when found, otherwise null.
   */
  async findCollectionByUuid(uuid: string): Promise<Collection | null> {
    const trimmed = uuid.trim();
    if (!trimmed) {
      return null;
    }

    const row = this.getDb()
      .prepare(`SELECT ${COLLECTION_COLUMNS} FROM collections WHERE uuid = ?`)
      .get(trimmed) as Record<string, unknown> | undefined;

    return row ? rowToCollection(row) : null;
  }

  /**
   * Looks up a request by uuid within a collection in this SQLite store.
   *
   * @param collectionId - Provider-local collection id.
   * @param uuid - Stable request identifier.
   * @returns The request when found, otherwise null.
   */
  async findRequestByUuid(collectionId: number, uuid: string): Promise<SavedRequest | null> {
    const trimmed = uuid.trim();
    if (!trimmed) {
      return null;
    }

    const row = this.getDb()
      .prepare('SELECT * FROM requests WHERE collection_id = ? AND uuid = ?')
      .get(collectionId, trimmed) as Record<string, unknown> | undefined;

    return row ? rowToRequest(row) : null;
  }

  /**
   * Updates an existing collection and upserts folders and requests from import data.
   *
   * @param id - Provider-local collection id to update.
   * @param data - Validated collection export payload.
   * @returns The updated collection.
   */
  async updateCollectionFromImport(id: number, data: CollectionExport): Promise<Collection> {
    const exportData = validateCollectionExport(data);
    const database = this.getDb();
    const now = new Date().toISOString();

    const runUpdate = database.transaction((payload: CollectionExport) => {
      database
        .prepare(
          'UPDATE collections SET name = ?, variables = ?, headers = ?, auth = ?, pre_request_script = ?, post_request_script = ? WHERE id = ?'
        )
        .run(
          payload.name,
          JSON.stringify(payload.variables),
          JSON.stringify(payload.headers),
          JSON.stringify(payload.auth ?? defaultAuth()),
          payload.pre_request_script,
          payload.post_request_script,
          id
        );

      const existingFolderRows = database
        .prepare('SELECT * FROM folders WHERE collection_id = ?')
        .all(id) as Record<string, unknown>[];
      const folderMaps = buildFolderImportMaps(existingFolderRows.map(rowToFolder));

      for (const folder of payload.folders ?? []) {
        const plan = planImportedFolderUpsert(folder, folderMaps);
        if (plan.action === 'update') {
          database
            .prepare(
              'UPDATE folders SET name = ?, sort_order = ? WHERE id = ? AND collection_id = ?'
            )
            .run(plan.name, plan.sort_order, plan.existingId, id);
          registerImportedFolderInMaps(folderMaps, plan.existingId, plan.name, plan.uuid);
          continue;
        }

        const folderResult = database
          .prepare(
            'INSERT INTO folders (collection_id, name, sort_order, uuid) VALUES (?, ?, ?, ?)'
          )
          .run(id, plan.name, plan.sort_order, plan.uuid);
        registerImportedFolderInMaps(
          folderMaps,
          Number(folderResult.lastInsertRowid),
          plan.name,
          plan.uuid
        );
      }

      const existingRequestRows = database
        .prepare('SELECT * FROM requests WHERE collection_id = ?')
        .all(id) as Record<string, unknown>[];
      const requestUuidIndex = buildRequestUuidIndex(existingRequestRows.map(rowToRequest));

      const insertRequest = database.prepare(
        `INSERT INTO requests (
        collection_id, folder_id, name, method, url, headers, params, auth, body, body_type,
        pre_request_script, post_request_script, comment, sort_order, uuid, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const updateRequest = database.prepare(
        `UPDATE requests SET
          folder_id = ?, name = ?, method = ?, url = ?, headers = ?, params = ?, auth = ?,
          body = ?, body_type = ?, pre_request_script = ?, post_request_script = ?, comment = ?,
          sort_order = ?, updated_at = ?
        WHERE id = ? AND collection_id = ?`
      );

      for (const request of payload.requests) {
        const folderId = resolveImportFolderId(
          request.folder_uuid,
          request.folder_name,
          folderMaps.folderIdByUuid,
          folderMaps.folderIdByName
        );
        const fields = serializeImportedRequestFields(request);
        const existingRequestId = fields.uuid ? requestUuidIndex.get(fields.uuid) : undefined;

        if (existingRequestId != null) {
          updateRequest.run(
            folderId,
            fields.name,
            fields.method,
            fields.url,
            fields.headersJson,
            fields.paramsJson,
            fields.authJson,
            fields.body,
            fields.body_type,
            fields.pre_request_script,
            fields.post_request_script,
            fields.comment,
            fields.sort_order,
            now,
            existingRequestId,
            id
          );
          continue;
        }

        insertRequest.run(
          id,
          folderId,
          fields.name,
          fields.method,
          fields.url,
          fields.headersJson,
          fields.paramsJson,
          fields.authJson,
          fields.body,
          fields.body_type,
          fields.pre_request_script,
          fields.post_request_script,
          fields.comment,
          fields.sort_order,
          fields.uuid,
          now
        );
      }

      const row = database
        .prepare(`SELECT ${COLLECTION_COLUMNS} FROM collections WHERE id = ?`)
        .get(id) as Record<string, unknown>;

      return rowToCollection(row);
    });

    return runUpdate(exportData);
  }

  /**
   * Reads a persisted setting by key.
   *
   * @param key - Setting key to look up.
   * @returns The stored value, or undefined when not set.
   */
  async getSetting(key: string): Promise<string | undefined> {
    const row = this.getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  /**
   * Persists a setting value, replacing any existing entry for the key.
   *
   * @param key - Setting key to store.
   * @param value - Value to persist.
   */
  async setSetting(key: string, value: string): Promise<void> {
    this.getDb()
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
      )
      .run(key, value, value);
  }

  /**
   * Git-backed providers return status; SQLite is not source-controlled.
   */
  async getSourceControlStatus(): Promise<null> {
    return null;
  }

  /**
   * Closes the database connection.
   */
  async close(): Promise<void> {
    if (this.#db) {
      this.#db.close();
      this.#db = null;
    }
  }
}
