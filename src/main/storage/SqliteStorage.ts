import Database from 'better-sqlite3';
import { app } from 'electron';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  buildDocumentUuidIndex,
  buildFolderImportMaps,
  buildRequestUuidIndex,
  planImportedFolderUpsert,
  registerImportedFolderInMaps,
  resolveImportFolderId,
  resolveImportedCollectionUuid,
  resolveImportedFolderUuid,
  savedDocumentToExportedDocument,
  savedRequestToExportedRequest,
  serializeImportedCollectionScriptFields,
  serializeImportedDocumentFields,
  exportedFolderFromFolder,
  serializeImportedFolderFields,
  serializeImportedRequestFields
} from '#/main/storage/collectionImport';
import {
  maskVariablesForExport,
  normalizeVariable,
  validateCollectionExport,
  validateRunResultsExport
} from '#/main/storage/collectionData';
import { saveRunResultInputSchema } from '#/main/storage/collectionSchemas';
import {
  rowToCollection,
  rowToDocument,
  rowToEnvironment,
  rowToFolder,
  rowToProviderRunResult,
  rowToProviderRunResultSummary,
  rowToProviderSnippet,
  rowToRequest
} from '#/main/storage/entityMappers';
import { assertContainerItemOrder, planContainerItemMove } from '#/main/storage/containerReorder';
import type { ContainerItemRef } from '#/shared/collectionContainerOrder';
import {
  CREATE_PROVIDER_RUN_RESULTS_TABLE_SQL,
  PROVIDER_RUN_RESULT_COLUMNS
} from '#/main/storage/providerRunResultSql';
import {
  CREATE_PROVIDER_SNIPPETS_TABLE_SQL,
  migrateSqliteSnippetStageColumn,
  PROVIDER_SNIPPET_COLUMNS
} from '#/main/storage/providerSnippetSql';
import {
  bundleScriptFieldsWithLegacy,
  migrateSqliteScriptArrayColumns
} from '#/main/storage/scriptFields';
import { trimRequiredName } from '#/main/storage/trimRequiredName';
import {
  buildSavedRunLabel,
  extractSavedRunMetadata,
  type ProviderRunResult,
  type ProviderRunResultSummary,
  type SaveRunResultInput
} from '#/shared/collectionRunner';
import { DEFAULT_AUTH_JSON, defaultAuth, normalizeAuth } from '#/shared/auth';
import type { IStorage } from '#/main/storage/IStorage';
import type {
  AuthConfig,
  Collection,
  CollectionDocument,
  CollectionExport,
  Environment,
  Folder,
  KeyValue,
  SaveDocumentInput,
  SaveRequestInput,
  SavedRequest,
  ScriptRef,
  Snippet,
  SqliteSettings,
  Variable
} from '#/shared/types';
import type { SnippetScope } from '#/shared/snippetScope';
import { DEFAULT_SCRIPT_STAGE, normalizeScriptStage } from '#/shared/scriptStage';
import type { ScriptStage } from '@harborclient/sdk';
import { parseJson } from '#/shared/parseJson';
import { generateDocumentUuid } from '#/main/storage/uuid';

const COLLECTION_COLUMNS =
  'id, uuid, name, variables, headers, auth, pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, created_at';
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

export class SqliteStorage implements IStorage {
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
      pre_request_scripts TEXT NOT NULL DEFAULT '[]',
      post_request_scripts TEXT NOT NULL DEFAULT '[]',
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
      pre_request_scripts TEXT NOT NULL DEFAULT '[]',
      post_request_scripts TEXT NOT NULL DEFAULT '[]',
      comment TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
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

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      folder_id INTEGER,
      uuid TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );

    ${CREATE_PROVIDER_SNIPPETS_TABLE_SQL}

    ${CREATE_PROVIDER_RUN_RESULTS_TABLE_SQL}
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
    const hasRequestTags = requestColumns.some((col) => col.name === 'tags');
    if (!hasRequestTags) {
      this.#db.exec("ALTER TABLE requests ADD COLUMN tags TEXT NOT NULL DEFAULT ''");
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
    this.migrateDocumentUuidColumn('documents');
    this.migrateDocumentUuidColumn('run_results');
    this.backfillDocumentUuids('collections');
    this.backfillDocumentUuids('requests');
    this.backfillDocumentUuids('environments');
    this.backfillDocumentUuids('folders');
    this.backfillDocumentUuids('documents');
    this.backfillDocumentUuids('run_results');
    migrateSqliteScriptArrayColumns(this.getDb(), 'collections');
    migrateSqliteScriptArrayColumns(this.getDb(), 'requests');
    migrateSqliteScriptArrayColumns(this.getDb(), 'folders');
    migrateSqliteSnippetStageColumn(this.getDb());

    const folderColumns = this.getDb().prepare('PRAGMA table_info(folders)').all() as Array<{
      name: string;
    }>;
    if (!folderColumns.some((col) => col.name === 'variables')) {
      this.#db.exec("ALTER TABLE folders ADD COLUMN variables TEXT NOT NULL DEFAULT '[]'");
    }
    if (!folderColumns.some((col) => col.name === 'headers')) {
      this.#db.exec("ALTER TABLE folders ADD COLUMN headers TEXT NOT NULL DEFAULT '[]'");
    }
    if (!folderColumns.some((col) => col.name === 'pre_request_script')) {
      this.#db.exec("ALTER TABLE folders ADD COLUMN pre_request_script TEXT NOT NULL DEFAULT ''");
    }
    if (!folderColumns.some((col) => col.name === 'post_request_script')) {
      this.#db.exec("ALTER TABLE folders ADD COLUMN post_request_script TEXT NOT NULL DEFAULT ''");
    }
    if (!folderColumns.some((col) => col.name === 'auth')) {
      this.#db.exec(
        `ALTER TABLE folders ADD COLUMN auth TEXT NOT NULL DEFAULT '${DEFAULT_AUTH_JSON.replace(/'/g, "''")}'`
      );
    }
  }

  /**
   * Adds a uuid column to a document table when missing from legacy databases.
   *
   * @param table - Table name (`collections`, `requests`, `environments`, `folders`, or `run_results`).
   */
  private migrateDocumentUuidColumn(
    table: 'collections' | 'requests' | 'environments' | 'folders' | 'documents' | 'run_results'
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
   * @param table - Table name (`collections`, `requests`, `environments`, `folders`, or `run_results`).
   */
  private backfillDocumentUuids(
    table: 'collections' | 'requests' | 'environments' | 'folders' | 'documents' | 'run_results'
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
    auth: AuthConfig,
    preRequestScripts: ScriptRef[] = [],
    postRequestScripts: ScriptRef[] = []
  ): Promise<Collection> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const preScripts = bundleScriptFieldsWithLegacy(preRequestScripts, preRequestScript);
    const postScripts = bundleScriptFieldsWithLegacy(postRequestScripts, postRequestScript);
    this.getDb()
      .prepare(
        'UPDATE collections SET name = ?, variables = ?, headers = ?, auth = ?, pre_request_script = ?, post_request_script = ?, pre_request_scripts = ?, post_request_scripts = ? WHERE id = ?'
      )
      .run(
        trimmedName,
        JSON.stringify(variables),
        JSON.stringify(headers),
        JSON.stringify(auth),
        preScripts.legacy,
        postScripts.legacy,
        preScripts.json,
        postScripts.json,
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
    const preScripts = bundleScriptFieldsWithLegacy(
      input.pre_request_scripts,
      input.pre_request_script ?? ''
    );
    const postScripts = bundleScriptFieldsWithLegacy(
      input.post_request_scripts,
      input.post_request_script ?? ''
    );
    const preRequestScript = preScripts.legacy;
    const postRequestScript = postScripts.legacy;
    const comment = input.comment ?? '';
    const tags = input.tags ?? '';
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
          pre_request_script = ?, post_request_script = ?, pre_request_scripts = ?, post_request_scripts = ?, comment = ?, tags = ?,
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
          preScripts.json,
          postScripts.json,
          comment,
          tags,
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
        pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, comment, tags, sort_order, uuid, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        preScripts.json,
        postScripts.json,
        comment,
        tags,
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
   * Updates a folder's name, variables, headers, auth, and scripts.
   *
   * @param id - Folder ID to update.
   * @param name - New display name.
   * @param variables - Folder-scoped variables.
   * @param headers - Headers sent with every request in the folder.
   * @param preRequestScript - Script run before each request in the folder.
   * @param postRequestScript - Script run after each request in the folder.
   * @param auth - Default Authorization settings for requests in the folder.
   * @returns The updated folder.
   */
  async updateFolder(
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig,
    preRequestScripts: ScriptRef[] = [],
    postRequestScripts: ScriptRef[] = []
  ): Promise<Folder> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    const preScripts = bundleScriptFieldsWithLegacy(preRequestScripts, preRequestScript);
    const postScripts = bundleScriptFieldsWithLegacy(postRequestScripts, postRequestScript);
    this.getDb()
      .prepare(
        'UPDATE folders SET name = ?, variables = ?, headers = ?, auth = ?, pre_request_script = ?, post_request_script = ?, pre_request_scripts = ?, post_request_scripts = ? WHERE id = ?'
      )
      .run(
        trimmedName,
        JSON.stringify(variables),
        JSON.stringify(headers),
        JSON.stringify(auth),
        preScripts.legacy,
        postScripts.legacy,
        preScripts.json,
        postScripts.json,
        id
      );

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
    const deleteFolderContents = database.transaction((folderId: number) => {
      database.prepare('DELETE FROM requests WHERE folder_id = ?').run(folderId);
      database.prepare('DELETE FROM documents WHERE folder_id = ?').run(folderId);
      database.prepare('DELETE FROM folders WHERE id = ?').run(folderId);
    });
    deleteFolderContents(id);
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
   * Reorders requests and markdown documents together within a folder or collection root.
   *
   * @param collectionId - Collection containing the items.
   * @param folderId - Folder ID, or null for root-level items.
   * @param items - Request and document refs in desired unified sidebar order.
   */
  async reorderContainerItems(
    collectionId: number,
    folderId: number | null,
    items: ContainerItemRef[]
  ): Promise<void> {
    const requests = await this.listRequests(collectionId);
    const documents = await this.listDocuments(collectionId);
    assertContainerItemOrder(collectionId, folderId, items, requests, documents);

    if (folderId != null) {
      const folderRow = this.getDb()
        .prepare('SELECT collection_id FROM folders WHERE id = ?')
        .get(folderId) as { collection_id: number } | undefined;
      if (!folderRow || folderRow.collection_id !== collectionId) {
        throw new Error('Folder not found');
      }
    }

    const reorder = this.getDb().transaction((ordered: ContainerItemRef[]) => {
      const updateRequestWithFolder = this.getDb().prepare(
        'UPDATE requests SET sort_order = ?, folder_id = ? WHERE id = ? AND collection_id = ?'
      );
      const updateRequestRoot = this.getDb().prepare(
        'UPDATE requests SET sort_order = ?, folder_id = NULL WHERE id = ? AND collection_id = ?'
      );
      const updateDocumentWithFolder = this.getDb().prepare(
        'UPDATE documents SET sort_order = ?, folder_id = ? WHERE id = ? AND collection_id = ?'
      );
      const updateDocumentRoot = this.getDb().prepare(
        'UPDATE documents SET sort_order = ?, folder_id = NULL WHERE id = ? AND collection_id = ?'
      );

      ordered.forEach((item, unifiedIndex) => {
        if (item.kind === 'request') {
          if (folderId == null) {
            updateRequestRoot.run(unifiedIndex, item.id, collectionId);
          } else {
            updateRequestWithFolder.run(unifiedIndex, folderId, item.id, collectionId);
          }
          return;
        }

        if (folderId == null) {
          updateDocumentRoot.run(unifiedIndex, item.id, collectionId);
        } else {
          updateDocumentWithFolder.run(unifiedIndex, folderId, item.id, collectionId);
        }
      });
    });

    reorder(items);
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
    const row = this.getDb().prepare('SELECT * FROM requests WHERE id = ?').get(requestId) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new Error('Request not found');

    const request = rowToRequest(row);
    const collectionId = request.collection_id;
    const sourceFolderId = request.folder_id ?? null;

    if (folderId != null) {
      const folderRow = this.getDb()
        .prepare('SELECT collection_id FROM folders WHERE id = ?')
        .get(folderId) as { collection_id: number } | undefined;
      if (!folderRow || folderRow.collection_id !== collectionId) {
        throw new Error('Folder not found');
      }
    }

    const requests = await this.listRequests(collectionId);
    const documents = await this.listDocuments(collectionId);
    const plan = planContainerItemMove(
      requests,
      documents,
      { kind: 'request', id: requestId },
      sourceFolderId,
      folderId,
      index
    );

    if (plan.sourceOrder) {
      await this.reorderContainerItems(collectionId, sourceFolderId, plan.sourceOrder);
    }
    await this.reorderContainerItems(collectionId, folderId, plan.destinationOrder);
  }

  /**
   * Lists all markdown documents in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Documents ordered by sort_order then name.
   */
  async listDocuments(collectionId: number): Promise<CollectionDocument[]> {
    const rows = this.getDb()
      .prepare('SELECT * FROM documents WHERE collection_id = ? ORDER BY sort_order ASC, name ASC')
      .all(collectionId) as Record<string, unknown>[];

    return rows.map(rowToDocument);
  }

  /**
   * Inserts a new document or updates an existing one.
   *
   * @param input - Document fields to persist.
   * @returns The saved document with ID and timestamps.
   */
  async saveDocument(input: SaveDocumentInput): Promise<CollectionDocument> {
    const trimmedName = trimRequiredName(input.name, 'Document name');
    const content = input.content ?? '';
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
          `UPDATE documents SET
          collection_id = ?, folder_id = ?, name = ?, content = ?, updated_at = ?
        WHERE id = ?`
        )
        .run(input.collection_id, folderId, trimmedName, content, now, input.id);

      if (result.changes > 0) {
        const row = this.getDb().prepare('SELECT * FROM documents WHERE id = ?').get(input.id);
        if (row) return rowToDocument(row as Record<string, unknown>);
      }
    }

    const documentUuid = input.uuid?.trim() || generateDocumentUuid();
    const maxOrder = this.getDb()
      .prepare(
        `SELECT COALESCE(MAX(sort_order), -1) as max_order FROM documents
         WHERE collection_id = ? AND ((? IS NULL AND folder_id IS NULL) OR folder_id = ?)`
      )
      .get(input.collection_id, folderId, folderId) as { max_order: number };

    const result = this.getDb()
      .prepare(
        `INSERT INTO documents (
        collection_id, folder_id, name, content, sort_order, uuid, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.collection_id,
        folderId,
        trimmedName,
        content,
        maxOrder.max_order + 1,
        documentUuid,
        now
      );

    const row = this.getDb()
      .prepare('SELECT * FROM documents WHERE id = ?')
      .get(result.lastInsertRowid);

    if (!row) throw new Error('Document not found after insert');
    return rowToDocument(row as Record<string, unknown>);
  }

  /**
   * Deletes a markdown document by ID.
   *
   * @param id - Document ID to delete.
   */
  async deleteDocument(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM documents WHERE id = ?').run(id);
  }

  /**
   * Reorders documents within a folder or at collection root.
   *
   * @param collectionId - Collection containing the documents.
   * @param folderId - Folder ID, or null for root-level documents.
   * @param orderedDocumentIds - Document IDs in desired order.
   */
  async reorderDocuments(
    collectionId: number,
    folderId: number | null,
    orderedDocumentIds: number[]
  ): Promise<void> {
    const reorder = this.getDb().transaction((ids: number[]) => {
      const stmt = this.getDb().prepare(
        'UPDATE documents SET sort_order = ?, folder_id = ? WHERE id = ? AND collection_id = ?'
      );
      ids.forEach((documentId, index) => {
        stmt.run(index, folderId, documentId, collectionId);
      });
    });
    reorder(orderedDocumentIds);
  }

  /**
   * Moves a document to another folder or collection root at a given index.
   *
   * @param documentId - Document ID to move.
   * @param folderId - Destination folder ID, or null for collection root.
   * @param index - Zero-based position within the destination container.
   */
  async moveDocument(documentId: number, folderId: number | null, index: number): Promise<void> {
    const row = this.getDb().prepare('SELECT * FROM documents WHERE id = ?').get(documentId) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new Error('Document not found');

    const document = rowToDocument(row);
    const collectionId = document.collection_id;
    const sourceFolderId = document.folder_id ?? null;

    if (folderId != null) {
      const folderRow = this.getDb()
        .prepare('SELECT collection_id FROM folders WHERE id = ?')
        .get(folderId) as { collection_id: number } | undefined;
      if (!folderRow || folderRow.collection_id !== collectionId) {
        throw new Error('Folder not found');
      }
    }

    const requests = await this.listRequests(collectionId);
    const documents = await this.listDocuments(collectionId);
    const plan = planContainerItemMove(
      requests,
      documents,
      { kind: 'document', id: documentId },
      sourceFolderId,
      folderId,
      index
    );

    if (plan.sourceOrder) {
      await this.reorderContainerItems(collectionId, sourceFolderId, plan.sourceOrder);
    }
    await this.reorderContainerItems(collectionId, folderId, plan.destinationOrder);
  }

  /**
   * Builds a portable export payload for a collection and its requests.
   *
   * @param id - Collection ID to export.
   * @returns Collection export data without database IDs.
   */
  async exportCollectionData(id: number): Promise<CollectionExport> {
    const row = this.getDb()
      .prepare(`SELECT ${COLLECTION_COLUMNS} FROM collections WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;

    if (!row) throw new Error('Collection not found');

    const collection = rowToCollection(row);
    const folderRows = await this.listFolders(id);
    const folders = folderRows.map(exportedFolderFromFolder);
    const folderNameById = new Map(folderRows.map((folder) => [folder.id, folder.name]));
    const folderUuidById = new Map(folderRows.map((folder) => [folder.id, folder.uuid]));

    const requests = (await this.listRequests(id)).map((request) =>
      savedRequestToExportedRequest(
        request,
        request.folder_id != null ? (folderNameById.get(request.folder_id) ?? null) : null,
        request.folder_id != null ? (folderUuidById.get(request.folder_id) ?? null) : null
      )
    );

    const documents = (await this.listDocuments(id)).map((document) =>
      savedDocumentToExportedDocument(
        document,
        document.folder_id != null ? (folderNameById.get(document.folder_id) ?? null) : null,
        document.folder_id != null ? (folderUuidById.get(document.folder_id) ?? null) : null
      )
    );

    const variables = parseJson<Partial<Variable>[]>(row.variables as string, []).map(
      normalizeVariable
    );
    const headers = parseJson<KeyValue[]>(row.headers as string, []);
    const auth = normalizeAuth(parseJson(row.auth as string, defaultAuth()));

    return {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid: collection.uuid,
      name: collection.name,
      variables: maskVariablesForExport(variables),
      headers,
      auth,
      pre_request_script: collection.pre_request_script,
      post_request_script: collection.post_request_script,
      pre_request_scripts: collection.pre_request_scripts,
      post_request_scripts: collection.post_request_scripts,
      folders,
      requests,
      documents
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
      const collectionScripts = serializeImportedCollectionScriptFields(payload);
      const collectionResult = database
        .prepare(
          'INSERT INTO collections (name, uuid, variables, headers, auth, pre_request_script, post_request_script, pre_request_scripts, post_request_scripts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          payload.name,
          collectionUuid,
          JSON.stringify(payload.variables),
          JSON.stringify(payload.headers),
          JSON.stringify(payload.auth ?? defaultAuth()),
          collectionScripts.pre_request_script,
          collectionScripts.post_request_script,
          collectionScripts.pre_request_scripts_json,
          collectionScripts.post_request_scripts_json
        );

      const collectionId = Number(collectionResult.lastInsertRowid);
      const folderMaps: ReturnType<typeof buildFolderImportMaps> = {
        folderIdByUuid: new Map(),
        folderIdByName: new Map(),
        folderUuidById: new Map()
      };

      for (const folder of payload.folders ?? []) {
        const folderUuid = resolveImportedFolderUuid(folder);
        const folderFields = serializeImportedFolderFields(folder);
        const folderResult = database
          .prepare(
            `INSERT INTO folders (
              collection_id, name, sort_order, uuid, variables, headers, auth,
              pre_request_script, post_request_script, pre_request_scripts, post_request_scripts
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            collectionId,
            folder.name,
            folder.sort_order,
            folderUuid,
            folderFields.variablesJson,
            folderFields.headersJson,
            folderFields.authJson,
            folderFields.pre_request_script,
            folderFields.post_request_script,
            folderFields.pre_request_scripts_json,
            folderFields.post_request_scripts_json
          );
        const folderId = Number(folderResult.lastInsertRowid);
        registerImportedFolderInMaps(folderMaps, folderId, folder.name, folderUuid);
      }

      const insertRequest = database.prepare(
        `INSERT INTO requests (
        collection_id, folder_id, name, method, url, headers, params, auth, body, body_type,
        pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, comment, tags, sort_order, uuid, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const insertDocument = database.prepare(
        `INSERT INTO documents (
        collection_id, folder_id, name, content, sort_order, uuid, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
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
          fields.pre_request_scripts_json,
          fields.post_request_scripts_json,
          fields.comment,
          fields.tags,
          fields.sort_order,
          fields.uuid,
          now
        );
      }

      for (const document of payload.documents ?? []) {
        const folderId = resolveImportFolderId(
          document.folder_uuid,
          document.folder_name,
          folderMaps.folderIdByUuid,
          folderMaps.folderIdByName
        );
        const fields = serializeImportedDocumentFields(document);

        insertDocument.run(
          collectionId,
          folderId,
          fields.name,
          fields.content,
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
      const collectionScripts = serializeImportedCollectionScriptFields(payload);
      database
        .prepare(
          'UPDATE collections SET name = ?, variables = ?, headers = ?, auth = ?, pre_request_script = ?, post_request_script = ?, pre_request_scripts = ?, post_request_scripts = ? WHERE id = ?'
        )
        .run(
          payload.name,
          JSON.stringify(payload.variables),
          JSON.stringify(payload.headers),
          JSON.stringify(payload.auth ?? defaultAuth()),
          collectionScripts.pre_request_script,
          collectionScripts.post_request_script,
          collectionScripts.pre_request_scripts_json,
          collectionScripts.post_request_scripts_json,
          id
        );

      const existingFolderRows = database
        .prepare('SELECT * FROM folders WHERE collection_id = ?')
        .all(id) as Record<string, unknown>[];
      const folderMaps = buildFolderImportMaps(existingFolderRows.map(rowToFolder));

      for (const folder of payload.folders ?? []) {
        const plan = planImportedFolderUpsert(folder, folderMaps);
        if (plan.action === 'update') {
          const folderFields = serializeImportedFolderFields(folder);
          database
            .prepare(
              `UPDATE folders SET name = ?, sort_order = ?, variables = ?, headers = ?, auth = ?,
                pre_request_script = ?, post_request_script = ?, pre_request_scripts = ?, post_request_scripts = ?
               WHERE id = ? AND collection_id = ?`
            )
            .run(
              plan.name,
              plan.sort_order,
              folderFields.variablesJson,
              folderFields.headersJson,
              folderFields.authJson,
              folderFields.pre_request_script,
              folderFields.post_request_script,
              folderFields.pre_request_scripts_json,
              folderFields.post_request_scripts_json,
              plan.existingId,
              id
            );
          registerImportedFolderInMaps(folderMaps, plan.existingId, plan.name, plan.uuid);
          continue;
        }

        const folderFields = serializeImportedFolderFields(folder);
        const folderResult = database
          .prepare(
            `INSERT INTO folders (
              collection_id, name, sort_order, uuid, variables, headers, auth,
              pre_request_script, post_request_script, pre_request_scripts, post_request_scripts
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            id,
            plan.name,
            plan.sort_order,
            plan.uuid,
            folderFields.variablesJson,
            folderFields.headersJson,
            folderFields.authJson,
            folderFields.pre_request_script,
            folderFields.post_request_script,
            folderFields.pre_request_scripts_json,
            folderFields.post_request_scripts_json
          );
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

      const existingDocumentRows = database
        .prepare('SELECT * FROM documents WHERE collection_id = ?')
        .all(id) as Record<string, unknown>[];
      const documentUuidIndex = buildDocumentUuidIndex(existingDocumentRows.map(rowToDocument));

      const insertRequest = database.prepare(
        `INSERT INTO requests (
        collection_id, folder_id, name, method, url, headers, params, auth, body, body_type,
        pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, comment, tags, sort_order, uuid, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const updateRequest = database.prepare(
        `UPDATE requests SET
          folder_id = ?, name = ?, method = ?, url = ?, headers = ?, params = ?, auth = ?,
          body = ?, body_type = ?, pre_request_script = ?, post_request_script = ?, pre_request_scripts = ?, post_request_scripts = ?, comment = ?, tags = ?,
          sort_order = ?, updated_at = ?
        WHERE id = ? AND collection_id = ?`
      );
      const insertDocument = database.prepare(
        `INSERT INTO documents (
        collection_id, folder_id, name, content, sort_order, uuid, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      const updateDocument = database.prepare(
        `UPDATE documents SET
          folder_id = ?, name = ?, content = ?, sort_order = ?, updated_at = ?
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
            fields.pre_request_scripts_json,
            fields.post_request_scripts_json,
            fields.comment,
            fields.tags,
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
          fields.pre_request_scripts_json,
          fields.post_request_scripts_json,
          fields.comment,
          fields.tags,
          fields.sort_order,
          fields.uuid,
          now
        );
      }

      for (const document of payload.documents ?? []) {
        const folderId = resolveImportFolderId(
          document.folder_uuid,
          document.folder_name,
          folderMaps.folderIdByUuid,
          folderMaps.folderIdByName
        );
        const fields = serializeImportedDocumentFields(document);
        const existingDocumentId = fields.uuid ? documentUuidIndex.get(fields.uuid) : undefined;

        if (existingDocumentId != null) {
          updateDocument.run(
            folderId,
            fields.name,
            fields.content,
            fields.sort_order,
            now,
            existingDocumentId,
            id
          );
          continue;
        }

        insertDocument.run(
          id,
          folderId,
          fields.name,
          fields.content,
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
   * Lists all snippets stored in this provider ordered for display.
   */
  async listSnippets(): Promise<Snippet[]> {
    const rows = this.getDb()
      .prepare(`SELECT ${PROVIDER_SNIPPET_COLUMNS} FROM snippets ORDER BY sort_order ASC, name ASC`)
      .all() as Record<string, unknown>[];

    return rows.map(rowToProviderSnippet);
  }

  /**
   * Creates a new snippet in this provider.
   */
  async createSnippet(
    name: string,
    code: string,
    scope: SnippetScope = 'any',
    stage: ScriptStage = DEFAULT_SCRIPT_STAGE,
    uuid?: string
  ): Promise<Snippet> {
    const trimmedName = trimRequiredName(name, 'Snippet name');
    const snippetUuid = uuid?.trim() || generateDocumentUuid();
    const sortOrder = this.nextSnippetSortOrder();
    const now = new Date().toISOString();
    const normalizedRole = normalizeScriptStage(stage);
    const result = this.getDb()
      .prepare(
        'INSERT INTO snippets (name, uuid, code, scope, stage, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(trimmedName, snippetUuid, code ?? '', scope, normalizedRole, sortOrder, now, now);

    const row = this.getDb()
      .prepare(`SELECT ${PROVIDER_SNIPPET_COLUMNS} FROM snippets WHERE id = ?`)
      .get(result.lastInsertRowid) as Record<string, unknown>;

    return rowToProviderSnippet(row);
  }

  /**
   * Updates a snippet's name, code, and scope in this provider.
   */
  async updateSnippet(
    id: number,
    name: string,
    code: string,
    scope: SnippetScope = 'any',
    stage: ScriptStage = DEFAULT_SCRIPT_STAGE
  ): Promise<Snippet> {
    const trimmedName = trimRequiredName(name, 'Snippet name');
    const now = new Date().toISOString();
    const normalizedRole = normalizeScriptStage(stage);
    this.getDb()
      .prepare(
        'UPDATE snippets SET name = ?, code = ?, scope = ?, stage = ?, updated_at = ? WHERE id = ?'
      )
      .run(trimmedName, code ?? '', scope, normalizedRole, now, id);

    const row = this.getDb()
      .prepare(`SELECT ${PROVIDER_SNIPPET_COLUMNS} FROM snippets WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;

    if (!row) throw new Error('Snippet not found');
    return rowToProviderSnippet(row);
  }

  /**
   * Deletes a snippet from this provider.
   */
  async deleteSnippet(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM snippets WHERE id = ?').run(id);
  }

  /**
   * Lists persisted run result snapshots ordered by newest first.
   */
  async listRunResults(): Promise<ProviderRunResultSummary[]> {
    const rows = this.getDb()
      .prepare(
        `SELECT ${PROVIDER_RUN_RESULT_COLUMNS} FROM run_results ORDER BY created_at DESC, id DESC`
      )
      .all() as Record<string, unknown>[];

    return rows.map(rowToProviderRunResultSummary);
  }

  /**
   * Saves a run result snapshot with derived list metadata.
   */
  async saveRunResult(input: SaveRunResultInput): Promise<ProviderRunResult> {
    const parsed = saveRunResultInputSchema.parse(input);
    const payload = validateRunResultsExport(parsed.payload);
    const metadata = extractSavedRunMetadata(payload);
    const label = parsed.label?.trim() || buildSavedRunLabel(payload);
    const uuid = generateDocumentUuid();
    const now = new Date().toISOString();
    const result = this.getDb()
      .prepare(
        `INSERT INTO run_results (
          uuid, label, kind, collection_name, request_name,
          summary_passed, summary_failed, summary_skipped, payload, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        uuid,
        label,
        metadata.kind,
        metadata.collectionName,
        metadata.requestName,
        metadata.summary.passed,
        metadata.summary.failed,
        metadata.summary.skipped,
        JSON.stringify(payload),
        now
      );

    const row = this.getDb()
      .prepare(`SELECT ${PROVIDER_RUN_RESULT_COLUMNS} FROM run_results WHERE id = ?`)
      .get(result.lastInsertRowid) as Record<string, unknown>;

    return rowToProviderRunResult(row);
  }

  /**
   * Loads a run result snapshot by provider-local id.
   */
  async getRunResult(id: number): Promise<ProviderRunResult | null> {
    const row = this.getDb()
      .prepare(`SELECT ${PROVIDER_RUN_RESULT_COLUMNS} FROM run_results WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;

    return row ? rowToProviderRunResult(row) : null;
  }

  /**
   * Deletes a run result snapshot from this provider.
   */
  async deleteRunResult(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM run_results WHERE id = ?').run(id);
  }

  /**
   * Returns the next sort order value for a new snippet row.
   */
  private nextSnippetSortOrder(): number {
    const row = this.getDb()
      .prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM snippets')
      .get() as { max_order: number };
    return row.max_order + 1;
  }

  /**
   * Closes the database connection.
   */
  /**
   * Flushes WAL pages into the main database file for consistent backup snapshots.
   */
  checkpointWal(): void {
    if (this.#db) {
      this.#db.pragma('wal_checkpoint(TRUNCATE)');
    }
  }

  async close(): Promise<void> {
    if (this.#db) {
      this.#db.close();
      this.#db = null;
    }
  }
}
