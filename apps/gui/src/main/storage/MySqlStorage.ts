import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import {
  buildDocumentUuidIndex,
  buildFolderImportMaps,
  buildRequestFingerprintIndexes,
  buildRequestUuidIndex,
  createEmptyFolderImportMaps,
  planImportedFolderUpsert,
  registerImportedFolderInMaps,
  resolveImportFolderId,
  resolveImportRequestId,
  resolveImportedCollectionUuid,
  resolveImportedFolderUuid,
  resolveUpsertRequestFolderId,
  savedDocumentToExportedDocument,
  savedRequestToExportedRequest,
  serializeImportedCollectionScriptFields,
  serializeImportedDocumentFields,
  serializeImportedFolderFields,
  serializeImportedRequestFields
} from './collectionImport';
import {
  assertFolderSiblingReorder,
  assertValidFolderParent,
  exportFoldersWithParents,
  folderSubtreeIdsForDeletion,
  maxSiblingFolderSortOrder,
  resolveImportParentFolderId,
  sortExportedFoldersParentFirst,
  wouldCreateFolderCycle
} from './folderStorage';
import {
  maskVariablesForExport,
  normalizeVariable,
  validateCollectionExport
} from './collectionData';
import {
  rowToCollection,
  rowToDocument,
  rowToEnvironment,
  rowToFolder,
  rowToProviderLivePage,
  rowToProviderLiveServer,
  rowToProviderSnippet,
  rowToRequest
} from './entityMappers';
import { assertContainerItemOrder, planContainerItemMove } from './containerReorder';
import type { ContainerItemRef } from '@harborclient/core/collectionContainerOrder';
import {
  CREATE_PROVIDER_SNIPPETS_TABLE_MYSQL,
  PROVIDER_SNIPPET_COLUMNS
} from './providerSnippetSql';
import {
  CREATE_PROVIDER_LIVE_SERVERS_TABLE_MYSQL,
  PROVIDER_LIVE_SERVER_COLUMNS
} from '@harborclient/storage-sqlite/providerLiveServerSql';
import {
  CREATE_PROVIDER_LIVE_PAGES_TABLE_MYSQL,
  PROVIDER_LIVE_PAGE_COLUMNS
} from '@harborclient/storage-sqlite/providerLivePageSql';
import { serializeLiveServerPayload } from '@harborclient/storage-sqlite/liveServerPayload';
import { serializeLivePagePayload } from '@harborclient/storage-sqlite/livePagePayload';
import { bundleScriptFieldsWithLegacy } from './scriptFields';
import { serializeSidebarMarker } from './sidebarMarkerMigration';
import { trimRequiredName } from './trimRequiredName';
import { DEFAULT_AUTH_JSON, defaultAuth, normalizeAuth } from '@harborclient/core/auth';
import type { IStorage } from './IStorage';
import type {
  AuthConfig,
  Collection,
  CollectionDocument,
  CollectionExport,
  CreateLiveServerInput,
  CreateWebsiteInput,
  Environment,
  Folder,
  KeyValue,
  LiveServer,
  MySqlSettings,
  SaveDocumentInput,
  SaveRequestInput,
  SavedRequest,
  ScriptRef,
  Snippet,
  UpdateLiveServerInput,
  UpdateWebsiteInput,
  Variable,
  Website
} from '@harborclient/core/types';
import type {
  ProviderRunResult,
  ProviderRunResultSummary,
  SaveRunResultInput
} from '@harborclient/core/collectionRunner';
import type { SnippetScope } from '@harborclient/core/snippetScope';
import { DEFAULT_SCRIPT_STAGE, normalizeScriptStage } from '@harborclient/core/scriptStage';
import type { ScriptStage } from '@harborclient/sdk';
import { parseJson } from '@harborclient/core/parseJson';
import { generateDocumentUuid } from './uuid';

const COLLECTION_COLUMNS =
  'id, uuid, name, variables, headers, user_agent, auth, pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, created_at, marker';
const ENVIRONMENT_COLUMNS = 'id, uuid, name, variables, created_at, marker, parent_uuid';

export class MySqlStorage implements IStorage {
  #pool: Pool | null = null;
  readonly #settings: MySqlSettings;

  /**
   * @param settings - MySQL connection settings.
   */
  constructor(settings: MySqlSettings) {
    this.#settings = settings;
  }

  /**
   * Returns the active connection pool.
   *
   * @returns The initialized pool.
   * @throws When init has not been called yet.
   */
  private getPool(): Pool {
    if (!this.#pool) throw new Error('Database not initialized');
    return this.#pool;
  }

  /**
   * Opens the MySQL connection pool and ensures schema exists.
   */
  async init(): Promise<void> {
    if (this.#pool) return;

    const { host, port, user, password, database } = this.#settings;
    if (!host || !user || !database) {
      throw new Error('MySQL settings are incomplete');
    }

    this.#pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10
    });

    await this.#pool.execute(`
      CREATE TABLE IF NOT EXISTS collections (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        variables LONGTEXT NOT NULL,
        headers LONGTEXT NOT NULL,
        user_agent LONGTEXT NOT NULL DEFAULT (''),
        pre_request_script LONGTEXT NOT NULL,
        post_request_script LONGTEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL
      )
    `);

    await this.#pool.execute(`
      CREATE TABLE IF NOT EXISTS requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        collection_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        method VARCHAR(16) NOT NULL DEFAULT 'GET',
        url LONGTEXT NOT NULL,
        headers LONGTEXT NOT NULL,
        user_agent LONGTEXT NOT NULL DEFAULT (''),
        params LONGTEXT NOT NULL,
        body LONGTEXT NOT NULL,
        body_type VARCHAR(32) NOT NULL DEFAULT 'none',
        body_raw LONGTEXT NULL,
        body_raw_open TINYINT(1) NOT NULL DEFAULT 0,
        pre_request_script LONGTEXT NOT NULL,
        post_request_script LONGTEXT NOT NULL,
        comment LONGTEXT NOT NULL DEFAULT (''),
        tags LONGTEXT NOT NULL DEFAULT (''),
        sort_order INT NOT NULL DEFAULT 0,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      )
    `);

    await this.#pool.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(191) PRIMARY KEY,
        value LONGTEXT NOT NULL
      )
    `);

    await this.#pool.execute(`
      CREATE TABLE IF NOT EXISTS environments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        variables LONGTEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL,
        parent_uuid VARCHAR(36) NULL
      )
    `);

    await this.#pool.execute(`
      CREATE TABLE IF NOT EXISTS folders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        collection_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at VARCHAR(64) NOT NULL,
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      )
    `);

    await this.#pool.execute(`
      CREATE TABLE IF NOT EXISTS documents (
        id INT PRIMARY KEY AUTO_INCREMENT,
        collection_id INT NOT NULL,
        folder_id INT NULL,
        uuid VARCHAR(36) NOT NULL DEFAULT '',
        name VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL DEFAULT (''),
        sort_order INT NOT NULL DEFAULT 0,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
      )
    `);

    await this.#pool.execute(CREATE_PROVIDER_SNIPPETS_TABLE_MYSQL);
    await this.#pool.execute(CREATE_PROVIDER_LIVE_SERVERS_TABLE_MYSQL);
    await this.#pool.execute(CREATE_PROVIDER_LIVE_PAGES_TABLE_MYSQL);

    // MySQL has no `ADD COLUMN IF NOT EXISTS` (a MariaDB-only extension), so the
    // schema is migrated by checking information_schema before each ALTER.
    await this.addColumnIfMissing('requests', 'comment', "LONGTEXT NOT NULL DEFAULT ('')");
    await this.addColumnIfMissing('requests', 'tags', "LONGTEXT NOT NULL DEFAULT ('')");
    await this.addColumnIfMissing('requests', 'body_raw', 'LONGTEXT NULL');
    await this.addColumnIfMissing('requests', 'body_raw_open', 'TINYINT(1) NOT NULL DEFAULT 0');
    await this.addColumnIfMissing('requests', 'folder_id', 'INT NULL');
    await this.addColumnIfMissing(
      'collections',
      'auth',
      `LONGTEXT NOT NULL DEFAULT ('${DEFAULT_AUTH_JSON.replace(/'/g, "''")}')`
    );
    await this.addColumnIfMissing(
      'requests',
      'auth',
      `LONGTEXT NOT NULL DEFAULT ('${DEFAULT_AUTH_JSON.replace(/'/g, "''")}')`
    );
    await this.addColumnIfMissing('collections', 'user_agent', "LONGTEXT NOT NULL DEFAULT ('')");
    await this.addColumnIfMissing('requests', 'user_agent', "LONGTEXT NOT NULL DEFAULT ('')");
    await this.addColumnIfMissing('collections', 'uuid', "VARCHAR(36) NOT NULL DEFAULT ''");
    await this.addColumnIfMissing('requests', 'uuid', "VARCHAR(36) NOT NULL DEFAULT ''");
    await this.addColumnIfMissing('environments', 'uuid', "VARCHAR(36) NOT NULL DEFAULT ''");
    await this.addColumnIfMissing('environments', 'parent_uuid', 'VARCHAR(36) NULL');
    await this.addColumnIfMissing('folders', 'uuid', "VARCHAR(36) NOT NULL DEFAULT ''");
    for (const table of ['collections', 'folders', 'requests', 'documents', 'environments']) {
      await this.renameColumnIfPresent(table, 'color', 'marker', 'TEXT NULL');
      await this.addColumnIfMissing(table, 'marker', 'TEXT NULL');
    }
    await this.addColumnIfMissing(
      'collections',
      'pre_request_scripts',
      "LONGTEXT NOT NULL DEFAULT ('[]')"
    );
    await this.addColumnIfMissing(
      'collections',
      'post_request_scripts',
      "LONGTEXT NOT NULL DEFAULT ('[]')"
    );
    await this.addColumnIfMissing(
      'requests',
      'pre_request_scripts',
      "LONGTEXT NOT NULL DEFAULT ('[]')"
    );
    await this.addColumnIfMissing(
      'requests',
      'post_request_scripts',
      "LONGTEXT NOT NULL DEFAULT ('[]')"
    );
    await this.addColumnIfMissing('folders', 'variables', "LONGTEXT NOT NULL DEFAULT ('[]')");
    await this.addColumnIfMissing('folders', 'headers', "LONGTEXT NOT NULL DEFAULT ('[]')");
    await this.addColumnIfMissing(
      'folders',
      'pre_request_script',
      "LONGTEXT NOT NULL DEFAULT ('')"
    );
    await this.addColumnIfMissing(
      'folders',
      'post_request_script',
      "LONGTEXT NOT NULL DEFAULT ('')"
    );
    await this.addColumnIfMissing(
      'folders',
      'auth',
      `LONGTEXT NOT NULL DEFAULT ('${DEFAULT_AUTH_JSON.replace(/'/g, "''")}')`
    );
    await this.addColumnIfMissing('folders', 'user_agent', "LONGTEXT NOT NULL DEFAULT ('')");
    await this.addColumnIfMissing(
      'folders',
      'pre_request_scripts',
      "LONGTEXT NOT NULL DEFAULT ('[]')"
    );
    await this.addColumnIfMissing(
      'folders',
      'post_request_scripts',
      "LONGTEXT NOT NULL DEFAULT ('[]')"
    );
    await this.addColumnIfMissing('snippets', 'stage', "VARCHAR(32) NOT NULL DEFAULT 'main'");
    await this.getPool().execute("UPDATE snippets SET stage = 'main' WHERE stage = 'run'");
    await this.addColumnIfMissing('folders', 'parent_folder_id', 'INT NULL');
    await this.addParentFolderForeignKeyIfMissing();
    await this.backfillDocumentUuids('collections');
    await this.backfillDocumentUuids('requests');
    await this.backfillDocumentUuids('environments');
    await this.backfillDocumentUuids('folders');
    await this.backfillDocumentUuids('documents');
  }

  /**
   * Assigns uuids to rows that were created before uuid support existed.
   *
   * @param table - Table name (`collections`, `requests`, `environments`, `folders`, or `documents`).
   */
  private async backfillDocumentUuids(
    table: 'collections' | 'requests' | 'environments' | 'folders' | 'documents'
  ): Promise<void> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT id FROM ${table} WHERE uuid IS NULL OR uuid = ''`
    );
    if (rows.length === 0) {
      return;
    }

    for (const row of rows) {
      await this.getPool().execute(`UPDATE ${table} SET uuid = ? WHERE id = ?`, [
        generateDocumentUuid(),
        row.id
      ]);
    }
  }

  /**
   * Renames an existing column, preserving its stored values.
   *
   * Used to carry pre-rename sidebar `color` values over to `marker`. Does
   * nothing when the old column is absent or the new one already exists, so it
   * stays safe to run on every connect. Uses `CHANGE COLUMN` rather than
   * `RENAME COLUMN` for MySQL 5.7 compatibility. The table and column names are
   * internal constants, never user input.
   *
   * @param table - Table to alter.
   * @param from - Legacy column name.
   * @param to - Replacement column name.
   * @param definition - SQL column definition for the renamed column.
   */
  private async renameColumnIfPresent(
    table: string,
    from: string,
    to: string,
    definition: string
  ): Promise<void> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME IN (?, ?)`,
      [this.#settings.database, table, from, to]
    );

    const present = new Set(rows.map((row) => String(row.COLUMN_NAME)));
    if (!present.has(from) || present.has(to)) return;

    await this.getPool().execute(`ALTER TABLE ${table} CHANGE COLUMN ${from} ${to} ${definition}`);
  }

  /**
   * Adds a column to a table only when it is not already present.
   *
   * MySQL rejects the MariaDB `ADD COLUMN IF NOT EXISTS` syntax, so existing
   * databases are migrated by consulting `information_schema.COLUMNS` first. The
   * table and column names are internal constants, never user input.
   *
   * @param table - Table to alter.
   * @param column - Column to add when missing.
   * @param definition - SQL column definition appended after the column name.
   */
  private async addColumnIfMissing(
    table: string,
    column: string,
    definition: string
  ): Promise<void> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [this.#settings.database, table, column]
    );

    if (Number(rows[0]?.count ?? 0) > 0) return;

    await this.getPool().execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  /**
   * Adds the nested-folder parent foreign key when it is not already present.
   */
  private async addParentFolderForeignKeyIfMissing(): Promise<void> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'folders' AND CONSTRAINT_NAME = 'folders_parent_folder_id_fkey'`,
      [this.#settings.database]
    );
    if (Number(rows[0]?.count ?? 0) > 0) {
      return;
    }
    await this.getPool().execute(
      `ALTER TABLE folders ADD CONSTRAINT folders_parent_folder_id_fkey
       FOREIGN KEY (parent_folder_id) REFERENCES folders(id) ON DELETE CASCADE`
    );
  }

  /**
   * Lists all collections ordered by name.
   *
   * @returns All collections in the database.
   */
  async listCollections(): Promise<Collection[]> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT ' + COLLECTION_COLUMNS + ' FROM collections ORDER BY name ASC'
    );
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
    const createdAt = new Date().toISOString();
    const collectionUuid = generateDocumentUuid();
    const [result] = await this.getPool().execute<ResultSetHeader>(
      `INSERT INTO collections (name, uuid, variables, headers, pre_request_script, post_request_script, created_at)
       VALUES (?, ?, '[]', '[]', '', '', ?)`,
      [trimmedName, collectionUuid, createdAt]
    );

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT ' + COLLECTION_COLUMNS + ' FROM collections WHERE id = ?',
      [result.insertId]
    );

    const row = rows[0];
    if (!row) throw new Error('Collection not found after insert');
    return rowToCollection(row);
  }

  /**
   * Updates a collection's name, variables, headers, user agent, and scripts.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   * @param preRequestScript - Script run before each request in the collection.
   * @param postRequestScript - Script run after each request in the collection.
   * @param auth - Default Authorization settings for requests in the collection.
   * @param userAgent - User-Agent override; empty inherits the global default.
   * @param preRequestScripts - Ordered collection pre-request script references.
   * @param postRequestScripts - Ordered collection post-request script references.
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
    userAgent: string,
    preRequestScripts: ScriptRef[] = [],
    postRequestScripts: ScriptRef[] = []
  ): Promise<Collection> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const preScripts = bundleScriptFieldsWithLegacy(preRequestScripts, preRequestScript);
    const postScripts = bundleScriptFieldsWithLegacy(postRequestScripts, postRequestScript);
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'UPDATE collections SET name = ?, variables = ?, headers = ?, user_agent = ?, auth = ?, pre_request_script = ?, post_request_script = ?, pre_request_scripts = ?, post_request_scripts = ? WHERE id = ?',
      [
        trimmedName,
        JSON.stringify(variables),
        JSON.stringify(headers),
        userAgent,
        JSON.stringify(auth),
        preScripts.legacy,
        postScripts.legacy,
        preScripts.json,
        postScripts.json,
        id
      ]
    );

    if (result.affectedRows === 0) throw new Error('Collection not found');

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT ' + COLLECTION_COLUMNS + ' FROM collections WHERE id = ?',
      [id]
    );

    const row = rows[0];
    if (!row) throw new Error('Collection not found');
    return rowToCollection(row);
  }

  /**
   * Updates a collection's sidebar marker.
   *
   * @param id - Collection ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated collection.
   */
  async setCollectionMarker(id: number, marker: string | null): Promise<Collection> {
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'UPDATE collections SET marker = ? WHERE id = ?',
      [serializeSidebarMarker(marker), id]
    );
    if (result.affectedRows === 0) throw new Error('Collection not found');

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT ' + COLLECTION_COLUMNS + ' FROM collections WHERE id = ?',
      [id]
    );

    const row = rows[0];
    if (!row) throw new Error('Collection not found');
    return rowToCollection(row);
  }

  /**
   * Deletes a collection and all of its requests.
   *
   * @param id - Collection ID to delete.
   */
  async deleteCollection(id: number): Promise<void> {
    await this.getPool().execute('DELETE FROM collections WHERE id = ?', [id]);
  }

  /**
   * Lists all environments ordered by name.
   *
   * @returns All environments in the database.
   */
  async listEnvironments(): Promise<Environment[]> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT ' + ENVIRONMENT_COLUMNS + ' FROM environments ORDER BY name ASC'
    );
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
    const createdAt = new Date().toISOString();
    const environmentUuid = uuid?.trim() || generateDocumentUuid();
    const [result] = await this.getPool().execute<ResultSetHeader>(
      `INSERT INTO environments (name, uuid, variables, created_at) VALUES (?, ?, '[]', ?)`,
      [trimmedName, environmentUuid, createdAt]
    );

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT ' + ENVIRONMENT_COLUMNS + ' FROM environments WHERE id = ?',
      [result.insertId]
    );

    const row = rows[0];
    if (!row) throw new Error('Environment not found after insert');
    return rowToEnvironment(row);
  }

  /**
   * Updates an environment's name, variables, and optional parent link.
   *
   * @param id - Environment ID to update.
   * @param name - New display name.
   * @param variables - Environment-scoped variables.
   * @param parentUuid - Parent environment uuid; `null` clears; omit to leave unchanged.
   * @returns The updated environment.
   */
  async updateEnvironment(
    id: number,
    name: string,
    variables: Variable[],
    parentUuid?: string | null
  ): Promise<Environment> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const [result] =
      parentUuid === undefined
        ? await this.getPool().execute<ResultSetHeader>(
            'UPDATE environments SET name = ?, variables = ? WHERE id = ?',
            [trimmedName, JSON.stringify(variables), id]
          )
        : await this.getPool().execute<ResultSetHeader>(
            'UPDATE environments SET name = ?, variables = ?, parent_uuid = ? WHERE id = ?',
            [trimmedName, JSON.stringify(variables), parentUuid?.trim() || null, id]
          );

    if (result.affectedRows === 0) throw new Error('Environment not found');

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT ' + ENVIRONMENT_COLUMNS + ' FROM environments WHERE id = ?',
      [id]
    );

    const row = rows[0];
    if (!row) throw new Error('Environment not found');
    return rowToEnvironment(row);
  }

  /**
   * Updates an environment's sidebar marker.
   *
   * @param id - Environment ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated environment.
   */
  async setEnvironmentMarker(id: number, marker: string | null): Promise<Environment> {
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'UPDATE environments SET marker = ? WHERE id = ?',
      [serializeSidebarMarker(marker), id]
    );
    if (result.affectedRows === 0) throw new Error('Environment not found');

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT ' + ENVIRONMENT_COLUMNS + ' FROM environments WHERE id = ?',
      [id]
    );

    const row = rows[0];
    if (!row) throw new Error('Environment not found');
    return rowToEnvironment(row);
  }

  /**
   * Deletes an environment and orphans any direct children (clears their parent_uuid).
   *
   * @param id - Environment ID to delete.
   */
  async deleteEnvironment(id: number): Promise<void> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT uuid FROM environments WHERE id = ?',
      [id]
    );
    const uuid = rows[0]?.uuid as string | undefined;
    if (uuid) {
      await this.getPool().execute(
        'UPDATE environments SET parent_uuid = NULL WHERE parent_uuid = ?',
        [uuid]
      );
    }
    await this.getPool().execute('DELETE FROM environments WHERE id = ?', [id]);
  }

  /**
   * Lists all saved requests in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Requests ordered by sort_order then name.
   */
  async listRequests(collectionId: number): Promise<SavedRequest[]> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM requests WHERE collection_id = ? ORDER BY sort_order ASC, name ASC',
      [collectionId]
    );
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
    const userAgent = typeof input.userAgent === 'string' ? input.userAgent : '';
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
    const bodyRaw = input.body_raw ?? null;
    const bodyRawOpen = input.body_raw_open === true ? 1 : 0;
    const folderId = input.folder_id ?? null;
    const serializedMarker =
      input.marker !== undefined ? serializeSidebarMarker(input.marker) : undefined;
    const now = new Date().toISOString();

    if (folderId != null) {
      const [folderRows] = await this.getPool().execute<RowDataPacket[]>(
        'SELECT collection_id FROM folders WHERE id = ?',
        [folderId]
      );
      const folderRow = folderRows[0];
      if (!folderRow || folderRow.collection_id !== input.collection_id) {
        throw new Error('Folder not found');
      }
    }

    if (input.id) {
      const [result] =
        serializedMarker === undefined
          ? await this.getPool().execute<ResultSetHeader>(
              `UPDATE requests SET
          collection_id = ?, folder_id = ?, name = ?, method = ?, url = ?,
          headers = ?, user_agent = ?, params = ?, auth = ?, body = ?, body_type = ?, body_raw = ?, body_raw_open = ?,
          pre_request_script = ?, post_request_script = ?, pre_request_scripts = ?, post_request_scripts = ?, comment = ?, tags = ?,
          updated_at = ?
        WHERE id = ?`,
              [
                input.collection_id,
                folderId,
                trimmedName,
                input.method,
                input.url,
                headers,
                userAgent,
                params,
                auth,
                input.body,
                input.body_type,
                bodyRaw,
                bodyRawOpen,
                preRequestScript,
                postRequestScript,
                preScripts.json,
                postScripts.json,
                comment,
                tags,
                now,
                input.id
              ]
            )
          : await this.getPool().execute<ResultSetHeader>(
              `UPDATE requests SET
          collection_id = ?, folder_id = ?, name = ?, method = ?, url = ?,
          headers = ?, user_agent = ?, params = ?, auth = ?, body = ?, body_type = ?, body_raw = ?, body_raw_open = ?,
          pre_request_script = ?, post_request_script = ?, pre_request_scripts = ?, post_request_scripts = ?, comment = ?, tags = ?,
          updated_at = ?, marker = ?
        WHERE id = ?`,
              [
                input.collection_id,
                folderId,
                trimmedName,
                input.method,
                input.url,
                headers,
                userAgent,
                params,
                auth,
                input.body,
                input.body_type,
                bodyRaw,
                bodyRawOpen,
                preRequestScript,
                postRequestScript,
                preScripts.json,
                postScripts.json,
                comment,
                tags,
                now,
                serializedMarker,
                input.id
              ]
            );

      if (result.affectedRows > 0) {
        const [rows] = await this.getPool().execute<RowDataPacket[]>(
          'SELECT * FROM requests WHERE id = ?',
          [input.id]
        );
        const row = rows[0];
        if (row) return rowToRequest(row);
      }
    }

    const requestUuid = input.uuid?.trim() || generateDocumentUuid();
    const [maxRows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM requests
       WHERE collection_id = ? AND ((? IS NULL AND folder_id IS NULL) OR folder_id = ?)`,
      [input.collection_id, folderId, folderId]
    );
    const maxOrder = (maxRows[0]?.max_order as number) ?? -1;

    const [result] = await this.getPool().execute<ResultSetHeader>(
      `INSERT INTO requests (
        collection_id, folder_id, name, method, url, headers, user_agent, params, auth, body, body_type, body_raw, body_raw_open,
        pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, comment, tags, sort_order, uuid, created_at, updated_at, marker
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.collection_id,
        folderId,
        trimmedName,
        input.method,
        input.url,
        headers,
        userAgent,
        params,
        auth,
        input.body,
        input.body_type,
        bodyRaw,
        bodyRawOpen,
        preRequestScript,
        postRequestScript,
        preScripts.json,
        postScripts.json,
        comment,
        tags,
        maxOrder + 1,
        requestUuid,
        now,
        now,
        serializedMarker ?? null
      ]
    );

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM requests WHERE id = ?',
      [result.insertId]
    );

    const row = rows[0];
    if (!row) throw new Error('Request not found after insert');
    return rowToRequest(row);
  }

  /**
   * Deletes a saved request by ID.
   *
   * @param id - Request ID to delete.
   */
  async deleteRequest(id: number): Promise<void> {
    await this.getPool().execute('DELETE FROM requests WHERE id = ?', [id]);
  }

  /**
   * Updates a saved request's sidebar marker.
   *
   * @param id - Request ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated request.
   */
  async setRequestMarker(id: number, marker: string | null): Promise<SavedRequest> {
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'UPDATE requests SET marker = ? WHERE id = ?',
      [serializeSidebarMarker(marker), id]
    );
    if (result.affectedRows === 0) throw new Error('Request not found');

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM requests WHERE id = ?',
      [id]
    );
    const row = rows[0];
    if (!row) throw new Error('Request not found');
    return rowToRequest(row);
  }

  /**
   * Lists all folders in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Folders ordered by sort_order then name.
   */
  async listFolders(collectionId: number): Promise<Folder[]> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM folders WHERE collection_id = ? ORDER BY sort_order ASC, name ASC',
      [collectionId]
    );
    return rows.map(rowToFolder);
  }

  /**
   * Creates a new folder in a collection.
   *
   * @param collectionId - Collection to add the folder to.
   * @param name - Display name for the folder.
   * @param parentFolderId - Parent folder id, or null/omitted for collection root.
   * @returns The newly created folder.
   */
  async createFolder(
    collectionId: number,
    name: string,
    parentFolderId?: number | null
  ): Promise<Folder> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    const parentId = parentFolderId ?? null;
    const existingFolders = await this.listFolders(collectionId);
    assertValidFolderParent(existingFolders, collectionId, parentId);
    const createdAt = new Date().toISOString();
    const maxOrder = maxSiblingFolderSortOrder(existingFolders, parentId);

    const [result] = await this.getPool().execute<ResultSetHeader>(
      'INSERT INTO folders (collection_id, parent_folder_id, name, sort_order, uuid, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [collectionId, parentId, trimmedName, maxOrder + 1, generateDocumentUuid(), createdAt]
    );

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM folders WHERE id = ?',
      [result.insertId]
    );
    const row = rows[0];
    if (!row) throw new Error('Folder not found after insert');
    return rowToFolder(row);
  }

  /**
   * Moves a folder to a new parent and optional sibling index.
   *
   * @param folderId - Folder to move.
   * @param parentFolderId - New parent folder id, or null for collection root.
   * @param sortOrder - Optional zero-based index among new siblings.
   * @returns The updated folder.
   */
  async moveFolder(
    folderId: number,
    parentFolderId: number | null,
    sortOrder?: number
  ): Promise<Folder> {
    const [folderRows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM folders WHERE id = ?',
      [folderId]
    );
    const folderRow = folderRows[0];
    if (!folderRow) throw new Error('Folder not found');

    const collectionId = folderRow.collection_id as number;
    const folders = await this.listFolders(collectionId);
    assertValidFolderParent(folders, collectionId, parentFolderId);
    if (wouldCreateFolderCycle(folderId, parentFolderId, folders)) {
      throw new Error('Cannot move a folder under itself or a descendant');
    }

    const destSiblings = folders
      .filter(
        (folder) => folder.id !== folderId && (folder.parent_folder_id ?? null) === parentFolderId
      )
      .sort(
        (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name)
      );

    const targetIndex =
      sortOrder != null
        ? Math.max(0, Math.min(sortOrder, destSiblings.length))
        : destSiblings.length;
    const orderedIds = [
      ...destSiblings.slice(0, targetIndex).map((folder) => folder.id),
      folderId,
      ...destSiblings.slice(targetIndex).map((folder) => folder.id)
    ];

    await this.getPool().execute('UPDATE folders SET parent_folder_id = ? WHERE id = ?', [
      parentFolderId,
      folderId
    ]);
    await this.reorderFolders(collectionId, parentFolderId, orderedIds);

    const [updatedRows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM folders WHERE id = ?',
      [folderId]
    );
    const updatedRow = updatedRows[0];
    if (!updatedRow) throw new Error('Folder not found');
    return rowToFolder(updatedRow);
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
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'UPDATE folders SET name = ? WHERE id = ?',
      [trimmedName, id]
    );
    if (result.affectedRows === 0) throw new Error('Folder not found');

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM folders WHERE id = ?',
      [id]
    );
    const row = rows[0];
    if (!row) throw new Error('Folder not found');
    return rowToFolder(row);
  }

  /**
   * Updates a folder's name, variables, headers, auth, user agent, and scripts.
   *
   * @param id - Folder ID to update.
   * @param name - New display name.
   * @param variables - Folder-scoped variables.
   * @param headers - Headers sent with every request in the folder.
   * @param preRequestScript - Script run before each request in the folder.
   * @param postRequestScript - Script run after each request in the folder.
   * @param auth - Default Authorization settings for requests in the folder.
   * @param userAgent - User-Agent override; empty inherits collection → global.
   * @param preRequestScripts - Ordered folder pre-request script references.
   * @param postRequestScripts - Ordered folder post-request script references.
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
    userAgent: string,
    preRequestScripts: ScriptRef[] = [],
    postRequestScripts: ScriptRef[] = []
  ): Promise<Folder> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    const preScripts = bundleScriptFieldsWithLegacy(preRequestScripts, preRequestScript);
    const postScripts = bundleScriptFieldsWithLegacy(postRequestScripts, postRequestScript);
    const [result] = await this.getPool().execute<ResultSetHeader>(
      `UPDATE folders SET name = ?, variables = ?, headers = ?, user_agent = ?, auth = ?,
        pre_request_script = ?, post_request_script = ?, pre_request_scripts = ?, post_request_scripts = ?
       WHERE id = ?`,
      [
        trimmedName,
        JSON.stringify(variables),
        JSON.stringify(headers),
        userAgent,
        JSON.stringify(auth),
        preScripts.legacy,
        postScripts.legacy,
        preScripts.json,
        postScripts.json,
        id
      ]
    );
    if (result.affectedRows === 0) throw new Error('Folder not found');

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM folders WHERE id = ?',
      [id]
    );
    const row = rows[0];
    if (!row) throw new Error('Folder not found');
    return rowToFolder(row);
  }

  /**
   * Updates a folder's sidebar marker.
   *
   * @param id - Folder ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated folder.
   */
  async setFolderMarker(id: number, marker: string | null): Promise<Folder> {
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'UPDATE folders SET marker = ? WHERE id = ?',
      [serializeSidebarMarker(marker), id]
    );
    if (result.affectedRows === 0) throw new Error('Folder not found');

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM folders WHERE id = ?',
      [id]
    );
    const row = rows[0];
    if (!row) throw new Error('Folder not found');
    return rowToFolder(row);
  }

  /**
   * Deletes a folder, its descendant folders, and all requests and documents inside the subtree.
   *
   * @param id - Folder ID to delete.
   */
  async deleteFolder(id: number): Promise<void> {
    const [folderRows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT collection_id FROM folders WHERE id = ?',
      [id]
    );
    const collectionId = folderRows[0]?.collection_id as number | undefined;
    if (collectionId == null) throw new Error('Folder not found');

    const folders = await this.listFolders(collectionId);
    const folderIds = folderSubtreeIdsForDeletion(id, folders);

    const connection = await this.getPool().getConnection();
    try {
      await connection.beginTransaction();
      for (const folderId of folderIds) {
        await connection.execute('DELETE FROM requests WHERE folder_id = ?', [folderId]);
        await connection.execute('DELETE FROM documents WHERE folder_id = ?', [folderId]);
        await connection.execute('DELETE FROM folders WHERE id = ?', [folderId]);
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Reorders sibling folders that share the same parent within a collection.
   *
   * @param collectionId - Collection containing the folders.
   * @param parentFolderId - Parent folder id, or null for collection-root siblings.
   * @param orderedFolderIds - Sibling folder IDs in desired order.
   */
  async reorderFolders(
    collectionId: number,
    parentFolderId: number | null,
    orderedFolderIds: number[]
  ): Promise<void> {
    const folders = await this.listFolders(collectionId);
    assertFolderSiblingReorder(folders, collectionId, parentFolderId, orderedFolderIds);

    const connection = await this.getPool().getConnection();
    try {
      await connection.beginTransaction();
      for (let index = 0; index < orderedFolderIds.length; index++) {
        await connection.execute(
          'UPDATE folders SET sort_order = ? WHERE id = ? AND collection_id = ?',
          [index, orderedFolderIds[index], collectionId]
        );
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
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
      const [folderRows] = await this.getPool().execute<RowDataPacket[]>(
        'SELECT collection_id FROM folders WHERE id = ?',
        [folderId]
      );
      const folderRow = folderRows[0];
      if (!folderRow || folderRow.collection_id !== collectionId) {
        throw new Error('Folder not found');
      }
    }

    const connection = await this.getPool().getConnection();
    try {
      await connection.beginTransaction();
      for (let unifiedIndex = 0; unifiedIndex < items.length; unifiedIndex++) {
        const item = items[unifiedIndex];
        if (item.kind === 'request') {
          await connection.execute(
            'UPDATE requests SET sort_order = ?, folder_id = ? WHERE id = ? AND collection_id = ?',
            [unifiedIndex, folderId, item.id, collectionId]
          );
          continue;
        }

        await connection.execute(
          'UPDATE documents SET sort_order = ?, folder_id = ? WHERE id = ? AND collection_id = ?',
          [unifiedIndex, folderId, item.id, collectionId]
        );
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
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
    const connection = await this.getPool().getConnection();
    try {
      await connection.beginTransaction();
      for (let index = 0; index < orderedRequestIds.length; index++) {
        await connection.execute(
          'UPDATE requests SET sort_order = ?, folder_id = ? WHERE id = ? AND collection_id = ?',
          [index, folderId, orderedRequestIds[index], collectionId]
        );
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Moves a request to another folder or collection root at a given index.
   *
   * @param requestId - Request ID to move.
   * @param folderId - Destination folder ID, or null for collection root.
   * @param index - Zero-based position within the destination container.
   */
  async moveRequest(requestId: number, folderId: number | null, index: number): Promise<void> {
    const [requestRows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM requests WHERE id = ?',
      [requestId]
    );
    const requestRow = requestRows[0];
    if (!requestRow) throw new Error('Request not found');

    const request = rowToRequest(requestRow);
    const collectionId = request.collection_id;
    const sourceFolderId = request.folder_id ?? null;

    if (folderId != null) {
      const [folderRows] = await this.getPool().execute<RowDataPacket[]>(
        'SELECT collection_id FROM folders WHERE id = ?',
        [folderId]
      );
      const folderRow = folderRows[0];
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
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM documents WHERE collection_id = ? ORDER BY sort_order ASC, name ASC',
      [collectionId]
    );
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
    const serializedMarker =
      input.marker !== undefined ? serializeSidebarMarker(input.marker) : undefined;
    const now = new Date().toISOString();

    if (folderId != null) {
      const [folderRows] = await this.getPool().execute<RowDataPacket[]>(
        'SELECT collection_id FROM folders WHERE id = ?',
        [folderId]
      );
      const folderRow = folderRows[0];
      if (!folderRow || folderRow.collection_id !== input.collection_id) {
        throw new Error('Folder not found');
      }
    }

    if (input.id) {
      const [result] =
        serializedMarker === undefined
          ? await this.getPool().execute<ResultSetHeader>(
              `UPDATE documents SET
          collection_id = ?, folder_id = ?, name = ?, content = ?, updated_at = ?
        WHERE id = ?`,
              [input.collection_id, folderId, trimmedName, content, now, input.id]
            )
          : await this.getPool().execute<ResultSetHeader>(
              `UPDATE documents SET
          collection_id = ?, folder_id = ?, name = ?, content = ?, updated_at = ?, marker = ?
        WHERE id = ?`,
              [input.collection_id, folderId, trimmedName, content, now, serializedMarker, input.id]
            );

      if (result.affectedRows > 0) {
        const [rows] = await this.getPool().execute<RowDataPacket[]>(
          'SELECT * FROM documents WHERE id = ?',
          [input.id]
        );
        const row = rows[0];
        if (row) return rowToDocument(row);
      }
    }

    const documentUuid = input.uuid?.trim() || generateDocumentUuid();
    const [maxRows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM documents
       WHERE collection_id = ? AND ((? IS NULL AND folder_id IS NULL) OR folder_id = ?)`,
      [input.collection_id, folderId, folderId]
    );
    const sortOrder = Number(maxRows[0]?.max_order ?? -1) + 1;

    const [insertResult] = await this.getPool().execute<ResultSetHeader>(
      `INSERT INTO documents (
        collection_id, folder_id, name, content, sort_order, uuid, created_at, updated_at, marker
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.collection_id,
        folderId,
        trimmedName,
        content,
        sortOrder,
        documentUuid,
        now,
        now,
        serializedMarker ?? null
      ]
    );

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM documents WHERE id = ?',
      [insertResult.insertId]
    );
    const row = rows[0];
    if (!row) throw new Error('Document not found after insert');
    return rowToDocument(row);
  }

  /**
   * Deletes a markdown document by ID.
   *
   * @param id - Document ID to delete.
   */
  async deleteDocument(id: number): Promise<void> {
    await this.getPool().execute('DELETE FROM documents WHERE id = ?', [id]);
  }

  /**
   * Updates a markdown document's sidebar marker.
   *
   * @param id - Document ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated document.
   */
  async setDocumentMarker(id: number, marker: string | null): Promise<CollectionDocument> {
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'UPDATE documents SET marker = ? WHERE id = ?',
      [serializeSidebarMarker(marker), id]
    );
    if (result.affectedRows === 0) throw new Error('Document not found');

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM documents WHERE id = ?',
      [id]
    );
    const row = rows[0];
    if (!row) throw new Error('Document not found');
    return rowToDocument(row);
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
    const connection = await this.getPool().getConnection();
    try {
      await connection.beginTransaction();
      for (let index = 0; index < orderedDocumentIds.length; index++) {
        await connection.execute(
          'UPDATE documents SET sort_order = ?, folder_id = ? WHERE id = ? AND collection_id = ?',
          [index, folderId, orderedDocumentIds[index], collectionId]
        );
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Moves a document to another folder or collection root at a given index.
   *
   * @param documentId - Document ID to move.
   * @param folderId - Destination folder ID, or null for collection root.
   * @param index - Zero-based position within the destination container.
   */
  async moveDocument(documentId: number, folderId: number | null, index: number): Promise<void> {
    const [documentRows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM documents WHERE id = ?',
      [documentId]
    );
    const documentRow = documentRows[0];
    if (!documentRow) throw new Error('Document not found');

    const document = rowToDocument(documentRow);
    const collectionId = document.collection_id;
    const sourceFolderId = document.folder_id ?? null;

    if (folderId != null) {
      const [folderRows] = await this.getPool().execute<RowDataPacket[]>(
        'SELECT collection_id FROM folders WHERE id = ?',
        [folderId]
      );
      const folderRow = folderRows[0];
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
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT ${COLLECTION_COLUMNS} FROM collections WHERE id = ?`,
      [id]
    );

    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error('Collection not found');

    const collection = rowToCollection(row);
    const folderRecords = await this.listFolders(id);
    const folders = exportFoldersWithParents(folderRecords);
    const folderNameById = new Map(folderRecords.map((folder) => [folder.id, folder.name]));
    const folderUuidById = new Map(folderRecords.map((folder) => [folder.id, folder.uuid]));

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
    const userAgent = typeof row.user_agent === 'string' ? row.user_agent : '';
    const auth = normalizeAuth(parseJson(row.auth as string, defaultAuth()));

    return {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid: collection.uuid,
      name: collection.name,
      variables: maskVariablesForExport(variables),
      headers,
      userAgent,
      auth,
      pre_request_script: collection.pre_request_script,
      post_request_script: collection.post_request_script,
      pre_request_scripts: collection.pre_request_scripts,
      post_request_scripts: collection.post_request_scripts,
      marker: collection.marker ?? null,
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
    const now = new Date().toISOString();
    const connection = await this.getPool().getConnection();

    try {
      await connection.beginTransaction();

      const collectionUuid = resolveImportedCollectionUuid(exportData);
      const collectionScripts = serializeImportedCollectionScriptFields(exportData);
      const [collectionResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO collections (name, uuid, variables, headers, user_agent, auth, pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, created_at, marker)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exportData.name,
          collectionUuid,
          JSON.stringify(exportData.variables),
          JSON.stringify(exportData.headers),
          typeof exportData.userAgent === 'string' ? exportData.userAgent : '',
          JSON.stringify(exportData.auth ?? defaultAuth()),
          collectionScripts.pre_request_script,
          collectionScripts.post_request_script,
          collectionScripts.pre_request_scripts_json,
          collectionScripts.post_request_scripts_json,
          now,
          serializeSidebarMarker(exportData.marker)
        ]
      );

      const collectionId = collectionResult.insertId;
      const folderMaps = createEmptyFolderImportMaps();

      for (const folder of sortExportedFoldersParentFirst(exportData.folders ?? [])) {
        const folderUuid = resolveImportedFolderUuid(folder);
        const folderFields = serializeImportedFolderFields(folder);
        const parentFolderId = resolveImportParentFolderId(
          folder.parent_folder_uuid,
          folderMaps.folderIdByUuid
        );
        const [folderResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO folders (
            collection_id, parent_folder_id, name, sort_order, uuid, variables, headers, user_agent, auth,
            pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, created_at, marker
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            collectionId,
            parentFolderId,
            folder.name,
            folder.sort_order,
            folderUuid,
            folderFields.variablesJson,
            folderFields.headersJson,
            folderFields.userAgent,
            folderFields.authJson,
            folderFields.pre_request_script,
            folderFields.post_request_script,
            folderFields.pre_request_scripts_json,
            folderFields.post_request_scripts_json,
            now,
            folderFields.marker
          ]
        );
        registerImportedFolderInMaps(
          folderMaps,
          folderResult.insertId,
          folder.name,
          folderUuid,
          parentFolderId
        );
      }

      for (const request of exportData.requests) {
        const folderId = resolveImportFolderId(
          request.folder_uuid,
          request.folder_name,
          folderMaps.folderIdByUuid,
          folderMaps.folderIdByName
        );
        const fields = serializeImportedRequestFields(request);

        await connection.execute(
          `INSERT INTO requests (
            collection_id, folder_id, name, method, url, headers, user_agent, params, auth, body, body_type, body_raw, body_raw_open,
            pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, comment, tags, sort_order, uuid, created_at, updated_at, marker
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            collectionId,
            folderId,
            fields.name,
            fields.method,
            fields.url,
            fields.headersJson,
            fields.userAgent,
            fields.paramsJson,
            fields.authJson,
            fields.body,
            fields.body_type,
            fields.body_raw,
            fields.body_raw_open ? 1 : 0,
            fields.pre_request_script,
            fields.post_request_script,
            fields.pre_request_scripts_json,
            fields.post_request_scripts_json,
            fields.comment,
            fields.tags,
            fields.sort_order,
            fields.uuid,
            now,
            now,
            fields.marker
          ]
        );
      }

      for (const document of exportData.documents ?? []) {
        const folderId = resolveImportFolderId(
          document.folder_uuid,
          document.folder_name,
          folderMaps.folderIdByUuid,
          folderMaps.folderIdByName
        );
        const fields = serializeImportedDocumentFields(document);

        await connection.execute(
          `INSERT INTO documents (
            collection_id, folder_id, name, content, sort_order, uuid, created_at, updated_at, marker
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            collectionId,
            folderId,
            fields.name,
            fields.content,
            fields.sort_order,
            fields.uuid,
            now,
            now,
            fields.marker
          ]
        );
      }

      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT ' + COLLECTION_COLUMNS + ' FROM collections WHERE id = ?',
        [collectionId]
      );

      await connection.commit();

      const row = rows[0];
      if (!row) throw new Error('Collection not found after import');
      return rowToCollection(row);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Looks up a collection by portable uuid within this MySQL store.
   *
   * @param uuid - Stable collection identifier.
   * @returns The collection when found, otherwise null.
   */
  async findCollectionByUuid(uuid: string): Promise<Collection | null> {
    const trimmed = uuid.trim();
    if (!trimmed) {
      return null;
    }

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT ' + COLLECTION_COLUMNS + ' FROM collections WHERE uuid = ?',
      [trimmed]
    );

    const row = rows[0];
    return row ? rowToCollection(row) : null;
  }

  /**
   * Looks up a request by uuid within a collection in this MySQL store.
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

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM requests WHERE collection_id = ? AND uuid = ?',
      [collectionId, trimmed]
    );

    const row = rows[0];
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
    const now = new Date().toISOString();
    const connection = await this.getPool().getConnection();

    try {
      await connection.beginTransaction();

      const collectionScripts = serializeImportedCollectionScriptFields(exportData);
      await connection.execute(
        'UPDATE collections SET name = ?, variables = ?, headers = ?, user_agent = ?, auth = ?, pre_request_script = ?, post_request_script = ?, pre_request_scripts = ?, post_request_scripts = ?, marker = ? WHERE id = ?',
        [
          exportData.name,
          JSON.stringify(exportData.variables),
          JSON.stringify(exportData.headers),
          typeof exportData.userAgent === 'string' ? exportData.userAgent : '',
          JSON.stringify(exportData.auth ?? defaultAuth()),
          collectionScripts.pre_request_script,
          collectionScripts.post_request_script,
          collectionScripts.pre_request_scripts_json,
          collectionScripts.post_request_scripts_json,
          serializeSidebarMarker(exportData.marker),
          id
        ]
      );

      const [existingFolderRows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM folders WHERE collection_id = ?',
        [id]
      );
      const folderMaps = buildFolderImportMaps(existingFolderRows.map(rowToFolder));

      for (const folder of sortExportedFoldersParentFirst(exportData.folders ?? [])) {
        const parentFolderId = resolveImportParentFolderId(
          folder.parent_folder_uuid,
          folderMaps.folderIdByUuid
        );
        const plan = planImportedFolderUpsert(folder, folderMaps, parentFolderId);
        if (plan.action === 'update') {
          const folderFields = serializeImportedFolderFields(folder);
          await connection.execute(
            `UPDATE folders SET name = ?, parent_folder_id = ?, sort_order = ?, variables = ?, headers = ?, user_agent = ?, auth = ?,
              pre_request_script = ?, post_request_script = ?, pre_request_scripts = ?, post_request_scripts = ?, marker = ?
             WHERE id = ? AND collection_id = ?`,
            [
              plan.name,
              parentFolderId,
              plan.sort_order,
              folderFields.variablesJson,
              folderFields.headersJson,
              folderFields.userAgent,
              folderFields.authJson,
              folderFields.pre_request_script,
              folderFields.post_request_script,
              folderFields.pre_request_scripts_json,
              folderFields.post_request_scripts_json,
              folderFields.marker,
              plan.existingId,
              id
            ]
          );
          registerImportedFolderInMaps(
            folderMaps,
            plan.existingId,
            plan.name,
            plan.uuid,
            parentFolderId
          );
          continue;
        }

        const folderFields = serializeImportedFolderFields(folder);
        const [folderResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO folders (
            collection_id, parent_folder_id, name, sort_order, uuid, variables, headers, user_agent, auth,
            pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, created_at, marker
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            parentFolderId,
            plan.name,
            plan.sort_order,
            plan.uuid,
            folderFields.variablesJson,
            folderFields.headersJson,
            folderFields.userAgent,
            folderFields.authJson,
            folderFields.pre_request_script,
            folderFields.post_request_script,
            folderFields.pre_request_scripts_json,
            folderFields.post_request_scripts_json,
            now,
            folderFields.marker
          ]
        );
        registerImportedFolderInMaps(
          folderMaps,
          folderResult.insertId,
          plan.name,
          plan.uuid,
          parentFolderId
        );
      }

      const [existingRequestRows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM requests WHERE collection_id = ?',
        [id]
      );
      const existingRequests = existingRequestRows.map(rowToRequest);
      const requestUuidIndex = buildRequestUuidIndex(existingRequests);
      const requestFingerprints = buildRequestFingerprintIndexes(existingRequests);

      const [existingDocumentRows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM documents WHERE collection_id = ?',
        [id]
      );
      const documentUuidIndex = buildDocumentUuidIndex(existingDocumentRows.map(rowToDocument));

      for (const request of exportData.requests) {
        const importedFolderId = resolveImportFolderId(
          request.folder_uuid,
          request.folder_name,
          folderMaps.folderIdByUuid,
          folderMaps.folderIdByName
        );
        const fields = serializeImportedRequestFields(request);
        const existingRequestId = resolveImportRequestId(
          fields.uuid,
          importedFolderId,
          fields.method,
          fields.name,
          fields.url,
          requestUuidIndex,
          requestFingerprints
        );
        const folderId = resolveUpsertRequestFolderId(
          importedFolderId,
          existingRequestId != null
            ? requestFingerprints.folderIdByRequestId.get(existingRequestId)
            : undefined
        );

        if (existingRequestId != null) {
          await connection.execute(
            `UPDATE requests SET
              folder_id = ?, name = ?, method = ?, url = ?, headers = ?, user_agent = ?, params = ?, auth = ?,
              body = ?, body_type = ?, body_raw = ?, body_raw_open = ?, pre_request_script = ?, post_request_script = ?, pre_request_scripts = ?, post_request_scripts = ?, comment = ?, tags = ?,
              sort_order = ?, updated_at = ?, marker = ?
            WHERE id = ? AND collection_id = ?`,
            [
              folderId,
              fields.name,
              fields.method,
              fields.url,
              fields.headersJson,
              fields.userAgent,
              fields.paramsJson,
              fields.authJson,
              fields.body,
              fields.body_type,
              fields.body_raw,
              fields.body_raw_open ? 1 : 0,
              fields.pre_request_script,
              fields.post_request_script,
              fields.pre_request_scripts_json,
              fields.post_request_scripts_json,
              fields.comment,
              fields.tags,
              fields.sort_order,
              now,
              fields.marker,
              existingRequestId,
              id
            ]
          );
          continue;
        }

        await connection.execute(
          `INSERT INTO requests (
            collection_id, folder_id, name, method, url, headers, user_agent, params, auth, body, body_type, body_raw, body_raw_open,
            pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, comment, tags, sort_order, uuid, created_at, updated_at, marker
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            folderId,
            fields.name,
            fields.method,
            fields.url,
            fields.headersJson,
            fields.userAgent,
            fields.paramsJson,
            fields.authJson,
            fields.body,
            fields.body_type,
            fields.body_raw,
            fields.body_raw_open ? 1 : 0,
            fields.pre_request_script,
            fields.post_request_script,
            fields.pre_request_scripts_json,
            fields.post_request_scripts_json,
            fields.comment,
            fields.tags,
            fields.sort_order,
            fields.uuid,
            now,
            now,
            fields.marker
          ]
        );
      }

      for (const document of exportData.documents ?? []) {
        const folderId = resolveImportFolderId(
          document.folder_uuid,
          document.folder_name,
          folderMaps.folderIdByUuid,
          folderMaps.folderIdByName
        );
        const fields = serializeImportedDocumentFields(document);
        const existingDocumentId = fields.uuid ? documentUuidIndex.get(fields.uuid) : undefined;

        if (existingDocumentId != null) {
          await connection.execute(
            `UPDATE documents SET
              folder_id = ?, name = ?, content = ?, sort_order = ?, updated_at = ?, marker = ?
            WHERE id = ? AND collection_id = ?`,
            [
              folderId,
              fields.name,
              fields.content,
              fields.sort_order,
              now,
              fields.marker,
              existingDocumentId,
              id
            ]
          );
          continue;
        }

        await connection.execute(
          `INSERT INTO documents (
            collection_id, folder_id, name, content, sort_order, uuid, created_at, updated_at, marker
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            folderId,
            fields.name,
            fields.content,
            fields.sort_order,
            fields.uuid,
            now,
            now,
            fields.marker
          ]
        );
      }

      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT ' + COLLECTION_COLUMNS + ' FROM collections WHERE id = ?',
        [id]
      );

      await connection.commit();

      const row = rows[0];
      if (!row) throw new Error('Collection not found');
      return rowToCollection(row);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Reads a persisted setting by key.
   *
   * @param key - Setting key to look up.
   * @returns The stored value, or undefined when not set.
   */
  async getSetting(key: string): Promise<string | undefined> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT value FROM settings WHERE `key` = ?',
      [key]
    );
    const row = rows[0];
    return row ? (row.value as string) : undefined;
  }

  /**
   * Persists a setting value, replacing any existing entry for the key.
   *
   * @param key - Setting key to store.
   * @param value - Value to persist.
   */
  async setSetting(key: string, value: string): Promise<void> {
    await this.getPool().execute(
      'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
      [key, value]
    );
  }

  /**
   * Git-backed providers return status; MySQL is not source-controlled.
   */
  async getSourceControlStatus(): Promise<null> {
    return null;
  }

  /**
   * Lists all snippets stored in this provider ordered for display.
   */
  async listSnippets(): Promise<Snippet[]> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT ${PROVIDER_SNIPPET_COLUMNS} FROM snippets ORDER BY sort_order ASC, name ASC`
    );
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
    const now = new Date().toISOString();
    const normalizedRole = normalizeScriptStage(stage);
    const [maxRows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM snippets'
    );
    const sortOrder = Number(maxRows[0]?.max_order ?? -1) + 1;
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'INSERT INTO snippets (name, uuid, code, scope, stage, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [trimmedName, snippetUuid, code ?? '', scope, normalizedRole, sortOrder, now, now]
    );

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT ${PROVIDER_SNIPPET_COLUMNS} FROM snippets WHERE id = ?`,
      [result.insertId]
    );
    const row = rows[0];
    if (!row) throw new Error('Snippet not found after insert');
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
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'UPDATE snippets SET name = ?, code = ?, scope = ?, stage = ?, updated_at = ? WHERE id = ?',
      [trimmedName, code ?? '', scope, normalizedRole, now, id]
    );
    if (result.affectedRows === 0) throw new Error('Snippet not found');

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT ${PROVIDER_SNIPPET_COLUMNS} FROM snippets WHERE id = ?`,
      [id]
    );
    const row = rows[0];
    if (!row) throw new Error('Snippet not found');
    return rowToProviderSnippet(row);
  }

  /**
   * Deletes a snippet from this provider.
   */
  async deleteSnippet(id: number): Promise<void> {
    await this.getPool().execute('DELETE FROM snippets WHERE id = ?', [id]);
  }

  /**
   * Lists live servers ordered by their provider sort position.
   */
  async listLiveServers(): Promise<LiveServer[]> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT ${PROVIDER_LIVE_SERVER_COLUMNS} FROM live_servers ORDER BY sort_order ASC, name ASC`
    );
    return rows.map(rowToProviderLiveServer);
  }

  /**
   * Creates a live server with normalized payload fields.
   *
   * @param input - Live server fields to persist.
   */
  async createLiveServer(input: CreateLiveServerInput): Promise<LiveServer> {
    const name = trimRequiredName(input.name, 'Live server name');
    if (!input.root.trim()) throw new Error('Root directory is required');
    const [maxRows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM live_servers'
    );
    const now = Date.now();
    const [result] = await this.getPool().execute<ResultSetHeader>(
      `INSERT INTO live_servers (uuid, name, payload, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.uuid?.trim() || generateDocumentUuid(),
        name,
        serializeLiveServerPayload(input),
        Number(maxRows[0]?.max_order ?? -1) + 1,
        now,
        now
      ]
    );
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT ${PROVIDER_LIVE_SERVER_COLUMNS} FROM live_servers WHERE id = ?`,
      [result.insertId]
    );
    return rowToProviderLiveServer(rows[0]);
  }

  /**
   * Replaces a live server's mutable fields.
   *
   * @param input - Complete live server update.
   */
  async updateLiveServer(input: UpdateLiveServerInput): Promise<LiveServer> {
    const name = trimRequiredName(input.name, 'Live server name');
    if (!input.root.trim()) throw new Error('Root directory is required');
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'UPDATE live_servers SET name = ?, payload = ?, updated_at = ? WHERE id = ?',
      [name, serializeLiveServerPayload(input), Date.now(), input.id]
    );
    if (result.affectedRows === 0) throw new Error(`Live server not found: ${input.id}`);
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT ${PROVIDER_LIVE_SERVER_COLUMNS} FROM live_servers WHERE id = ?`,
      [input.id]
    );
    return rowToProviderLiveServer(rows[0]);
  }

  /**
   * Deletes a live server by provider-local id.
   *
   * @param id - Live server id.
   */
  async deleteLiveServer(id: number): Promise<void> {
    await this.getPool().execute('DELETE FROM live_servers WHERE id = ?', [id]);
  }

  /**
   * Lists live pages ordered by their provider sort position.
   */
  async listLivePages(): Promise<Website[]> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT ${PROVIDER_LIVE_PAGE_COLUMNS} FROM live_pages ORDER BY sort_order ASC, name ASC`
    );
    return rows.map(rowToProviderLivePage);
  }

  /**
   * Creates a live page with a serialized website payload.
   *
   * @param input - Website fields to persist.
   */
  async createLivePage(input: CreateWebsiteInput): Promise<Website> {
    const [maxRows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM live_pages'
    );
    const now = Date.now();
    const [result] = await this.getPool().execute<ResultSetHeader>(
      `INSERT INTO live_pages (uuid, name, payload, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.uuid?.trim() || generateDocumentUuid(),
        trimRequiredName(input.name, 'Live page name'),
        serializeLivePagePayload(input),
        Number(maxRows[0]?.max_order ?? -1) + 1,
        now,
        now
      ]
    );
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT ${PROVIDER_LIVE_PAGE_COLUMNS} FROM live_pages WHERE id = ?`,
      [result.insertId]
    );
    return rowToProviderLivePage(rows[0]);
  }

  /**
   * Replaces a live page's mutable fields.
   *
   * @param input - Complete live page update.
   */
  async updateLivePage(input: UpdateWebsiteInput): Promise<Website> {
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'UPDATE live_pages SET name = ?, payload = ?, updated_at = ? WHERE id = ?',
      [
        trimRequiredName(input.name, 'Live page name'),
        serializeLivePagePayload(input),
        Date.now(),
        input.id
      ]
    );
    if (result.affectedRows === 0) throw new Error(`Live page not found: ${input.id}`);
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT ${PROVIDER_LIVE_PAGE_COLUMNS} FROM live_pages WHERE id = ?`,
      [input.id]
    );
    return rowToProviderLivePage(rows[0]);
  }

  /**
   * Deletes a live page by provider-local id.
   *
   * @param id - Live page id.
   */
  async deleteLivePage(id: number): Promise<void> {
    await this.getPool().execute('DELETE FROM live_pages WHERE id = ?', [id]);
  }

  /**
   * MySQL-backed storage does not persist run result snapshots.
   */
  async listRunResults(): Promise<ProviderRunResultSummary[]> {
    return [];
  }

  /**
   * MySQL-backed storage does not persist run result snapshots.
   */
  async saveRunResult(input: SaveRunResultInput): Promise<ProviderRunResult> {
    void input;
    throw new Error('Run results are not supported for this storage provider');
  }

  /**
   * MySQL-backed storage does not persist run result snapshots.
   */
  async getRunResult(id: number): Promise<ProviderRunResult | null> {
    void id;
    throw new Error('Run results are not supported for this storage provider');
  }

  /**
   * MySQL-backed storage does not persist run result snapshots.
   */
  async deleteRunResult(id: number): Promise<void> {
    void id;
    throw new Error('Run results are not supported for this storage provider');
  }

  /**
   * Closes the database connection.
   */
  async close(): Promise<void> {
    if (this.#pool) {
      await this.#pool.end();
      this.#pool = null;
    }
  }
}
