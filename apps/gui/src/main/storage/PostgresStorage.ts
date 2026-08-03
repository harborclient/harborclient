import { Pool } from 'pg';
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
  CREATE_PROVIDER_SNIPPETS_TABLE_POSTGRES,
  PROVIDER_SNIPPET_COLUMNS
} from './providerSnippetSql';
import {
  CREATE_PROVIDER_LIVE_SERVERS_TABLE_POSTGRES,
  PROVIDER_LIVE_SERVER_COLUMNS
} from '@harborclient/storage-sqlite/providerLiveServerSql';
import {
  CREATE_PROVIDER_LIVE_PAGES_TABLE_POSTGRES,
  PROVIDER_LIVE_PAGE_COLUMNS
} from '@harborclient/storage-sqlite/providerLivePageSql';
import { serializeLiveServerPayload } from '@harborclient/storage-sqlite/liveServerPayload';
import { serializeLivePagePayload } from '@harborclient/storage-sqlite/livePagePayload';
import { bundleScriptFieldsWithLegacy, migratePostgresScriptArrayColumns } from './scriptFields';
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
  PostgresSettings,
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

export class PostgresStorage implements IStorage {
  #pool: Pool | null = null;
  readonly #settings: PostgresSettings;

  /**
   * @param settings - PostgreSQL connection settings.
   */
  constructor(settings: PostgresSettings) {
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
   * Opens the PostgreSQL connection pool and ensures schema exists.
   */
  async init(): Promise<void> {
    if (this.#pool) return;

    const { host, port, user, password, database } = this.#settings;
    if (!host || !user || !database) {
      throw new Error('PostgreSQL settings are incomplete');
    }

    this.#pool = new Pool({
      host,
      port,
      user,
      password,
      database,
      max: 10
    });

    await this.#pool.query(`
      CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        variables TEXT NOT NULL,
        headers TEXT NOT NULL,
        user_agent TEXT NOT NULL DEFAULT '',
        pre_request_script TEXT NOT NULL,
        post_request_script TEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL
      )
    `);

    await this.#pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        collection_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        method VARCHAR(16) NOT NULL DEFAULT 'GET',
        protocol VARCHAR(16) NOT NULL DEFAULT 'http',
        url TEXT NOT NULL,
        headers TEXT NOT NULL,
        user_agent TEXT NOT NULL DEFAULT '',
        params TEXT NOT NULL,
        body TEXT NOT NULL,
        body_type VARCHAR(32) NOT NULL DEFAULT 'none',
        body_raw TEXT,
        body_raw_open BOOLEAN NOT NULL DEFAULT FALSE,
        pre_request_script TEXT NOT NULL,
        post_request_script TEXT NOT NULL,
        comment TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '',
        sort_order INT NOT NULL DEFAULT 0,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      )
    `);

    await this.#pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        "key" VARCHAR(191) PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    await this.#pool.query(`
      CREATE TABLE IF NOT EXISTS environments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        variables TEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL,
        parent_uuid TEXT
      )
    `);

    await this.#pool.query(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS comment TEXT NOT NULL DEFAULT ''
    `);

    await this.#pool.query(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT ''
    `);

    await this.#pool.query(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS body_raw TEXT
    `);

    await this.#pool.query(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS body_raw_open BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await this.#pool.query(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS folder_id INT NULL
    `);

    await this.#pool.query(`
      ALTER TABLE collections ADD COLUMN IF NOT EXISTS auth TEXT NOT NULL DEFAULT '${DEFAULT_AUTH_JSON.replace(/'/g, "''")}'
    `);

    await this.#pool.query(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS auth TEXT NOT NULL DEFAULT '${DEFAULT_AUTH_JSON.replace(/'/g, "''")}'
    `);

    await this.#pool.query(`
      ALTER TABLE collections ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT ''
    `);

    await this.#pool.query(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT ''
    `);

    await this.#pool.query(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS protocol VARCHAR(16) NOT NULL DEFAULT 'http'
    `);

    await this.#pool.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id SERIAL PRIMARY KEY,
        collection_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at VARCHAR(64) NOT NULL,
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      )
    `);

    await this.#pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        collection_id INT NOT NULL,
        folder_id INT NULL,
        uuid TEXT NOT NULL DEFAULT '',
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        sort_order INT NOT NULL DEFAULT 0,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
      )
    `);

    await this.#pool.query(CREATE_PROVIDER_SNIPPETS_TABLE_POSTGRES);
    await this.#pool.query(CREATE_PROVIDER_LIVE_SERVERS_TABLE_POSTGRES);
    await this.#pool.query(CREATE_PROVIDER_LIVE_PAGES_TABLE_POSTGRES);

    await this.#pool.query(`
      ALTER TABLE collections ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT ''
    `);

    await this.#pool.query(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT ''
    `);

    await this.#pool.query(`
      ALTER TABLE environments ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT ''
    `);

    await this.#pool.query(`
      ALTER TABLE environments ADD COLUMN IF NOT EXISTS parent_uuid TEXT
    `);

    await this.#pool.query(`
      ALTER TABLE folders ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT ''
    `);
    for (const table of ['collections', 'folders', 'requests', 'documents', 'environments']) {
      await this.renameLegacyColorColumn(table);
      await this.#pool.query(`
        ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS marker TEXT
      `);
    }

    await this.backfillDocumentUuids('collections');
    await this.backfillDocumentUuids('requests');
    await this.backfillDocumentUuids('environments');
    await this.backfillDocumentUuids('folders');
    await this.backfillDocumentUuids('documents');
    await migratePostgresScriptArrayColumns(this.getPool(), 'collections');
    await migratePostgresScriptArrayColumns(this.getPool(), 'requests');
    await migratePostgresScriptArrayColumns(this.getPool(), 'folders');
    await this.getPool().query(
      "ALTER TABLE snippets ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'main'"
    );
    await this.getPool().query("UPDATE snippets SET stage = 'main' WHERE stage = 'run'");

    await this.getPool().query(
      "ALTER TABLE folders ADD COLUMN IF NOT EXISTS variables TEXT NOT NULL DEFAULT '[]'"
    );
    await this.getPool().query(
      "ALTER TABLE folders ADD COLUMN IF NOT EXISTS headers TEXT NOT NULL DEFAULT '[]'"
    );
    await this.getPool().query(
      "ALTER TABLE folders ADD COLUMN IF NOT EXISTS pre_request_script TEXT NOT NULL DEFAULT ''"
    );
    await this.getPool().query(
      "ALTER TABLE folders ADD COLUMN IF NOT EXISTS post_request_script TEXT NOT NULL DEFAULT ''"
    );
    await this.getPool().query(
      `ALTER TABLE folders ADD COLUMN IF NOT EXISTS auth TEXT NOT NULL DEFAULT '${DEFAULT_AUTH_JSON.replace(/'/g, "''")}'`
    );
    await this.getPool().query(
      "ALTER TABLE folders ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT ''"
    );
    await this.getPool().query(`
      ALTER TABLE folders ADD COLUMN IF NOT EXISTS parent_folder_id INT NULL
    `);
    await this.getPool().query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = current_schema()
            AND table_name = 'folders'
            AND constraint_name = 'folders_parent_folder_id_fkey'
        ) THEN
          ALTER TABLE folders ADD CONSTRAINT folders_parent_folder_id_fkey
            FOREIGN KEY (parent_folder_id) REFERENCES folders(id) ON DELETE CASCADE;
        END IF;
      END $$
    `);
  }

  /**
   * Renames a pre-rename `color` column to `marker`, preserving assignments.
   *
   * Skips the rename when the table already carries `marker`, so the migration
   * stays safe to run on every connect.
   *
   * @param table - Table that may still hold the legacy column.
   */
  private async renameLegacyColorColumn(table: string): Promise<void> {
    await this.getPool().query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = '${table}'
            AND column_name = 'color'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = '${table}'
            AND column_name = 'marker'
        ) THEN
          ALTER TABLE ${table} RENAME COLUMN color TO marker;
        END IF;
      END $$;
    `);
  }

  /**
   * Assigns uuids to rows that were created before uuid support existed.
   *
   * @param table - Table name (`collections`, `requests`, `environments`, `folders`, or `documents`).
   */
  private async backfillDocumentUuids(
    table: 'collections' | 'requests' | 'environments' | 'folders' | 'documents'
  ): Promise<void> {
    const result = await this.getPool().query(
      `SELECT id FROM ${table} WHERE uuid IS NULL OR uuid = ''`
    );
    if (result.rows.length === 0) {
      return;
    }

    for (const row of result.rows) {
      await this.getPool().query(`UPDATE ${table} SET uuid = $1 WHERE id = $2`, [
        generateDocumentUuid(),
        row.id
      ]);
    }
  }

  /**
   * Lists all collections ordered by name.
   *
   * @returns All collections in the database.
   */
  async listCollections(): Promise<Collection[]> {
    const result = await this.getPool().query(
      'SELECT ' + COLLECTION_COLUMNS + ' FROM collections ORDER BY name ASC'
    );
    return result.rows.map(rowToCollection);
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
    const result = await this.getPool().query(
      `INSERT INTO collections (name, uuid, variables, headers, pre_request_script, post_request_script, created_at)
       VALUES ($1, $2, '[]', '[]', '', '', $3)
       RETURNING ${COLLECTION_COLUMNS}`,
      [trimmedName, collectionUuid, createdAt]
    );

    const row = result.rows[0];
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
    const result = await this.getPool().query(
      'UPDATE collections SET name = $1, variables = $2, headers = $3, user_agent = $4, auth = $5, pre_request_script = $6, post_request_script = $7, pre_request_scripts = $8, post_request_scripts = $9 WHERE id = $10',
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

    if (result.rowCount === 0) throw new Error('Collection not found');

    const selectResult = await this.getPool().query(
      'SELECT ' + COLLECTION_COLUMNS + ' FROM collections WHERE id = $1',
      [id]
    );

    const row = selectResult.rows[0];
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
    const result = await this.getPool().query('UPDATE collections SET marker = $1 WHERE id = $2', [
      serializeSidebarMarker(marker),
      id
    ]);
    if (result.rowCount === 0) throw new Error('Collection not found');

    const selectResult = await this.getPool().query(
      'SELECT ' + COLLECTION_COLUMNS + ' FROM collections WHERE id = $1',
      [id]
    );
    const row = selectResult.rows[0];
    if (!row) throw new Error('Collection not found');
    return rowToCollection(row);
  }

  /**
   * Deletes a collection and all of its requests.
   *
   * @param id - Collection ID to delete.
   */
  async deleteCollection(id: number): Promise<void> {
    await this.getPool().query('DELETE FROM collections WHERE id = $1', [id]);
  }

  /**
   * Lists all environments ordered by name.
   *
   * @returns All environments in the database.
   */
  async listEnvironments(): Promise<Environment[]> {
    const result = await this.getPool().query(
      'SELECT ' + ENVIRONMENT_COLUMNS + ' FROM environments ORDER BY name ASC'
    );
    return result.rows.map(rowToEnvironment);
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
    const result = await this.getPool().query(
      `INSERT INTO environments (name, uuid, variables, created_at) VALUES ($1, $2, '[]', $3)
       RETURNING ${ENVIRONMENT_COLUMNS}`,
      [trimmedName, environmentUuid, createdAt]
    );

    const row = result.rows[0];
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
    const result =
      parentUuid === undefined
        ? await this.getPool().query(
            'UPDATE environments SET name = $1, variables = $2 WHERE id = $3',
            [trimmedName, JSON.stringify(variables), id]
          )
        : await this.getPool().query(
            'UPDATE environments SET name = $1, variables = $2, parent_uuid = $3 WHERE id = $4',
            [trimmedName, JSON.stringify(variables), parentUuid?.trim() || null, id]
          );

    if (result.rowCount === 0) throw new Error('Environment not found');

    const selectResult = await this.getPool().query(
      'SELECT ' + ENVIRONMENT_COLUMNS + ' FROM environments WHERE id = $1',
      [id]
    );

    const row = selectResult.rows[0];
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
    const result = await this.getPool().query('UPDATE environments SET marker = $1 WHERE id = $2', [
      serializeSidebarMarker(marker),
      id
    ]);
    if (result.rowCount === 0) throw new Error('Environment not found');

    const selectResult = await this.getPool().query(
      'SELECT ' + ENVIRONMENT_COLUMNS + ' FROM environments WHERE id = $1',
      [id]
    );

    const row = selectResult.rows[0];
    if (!row) throw new Error('Environment not found');
    return rowToEnvironment(row);
  }

  /**
   * Deletes an environment and orphans any direct children (clears their parent_uuid).
   *
   * @param id - Environment ID to delete.
   */
  async deleteEnvironment(id: number): Promise<void> {
    const selectResult = await this.getPool().query('SELECT uuid FROM environments WHERE id = $1', [
      id
    ]);
    const uuid = selectResult.rows[0]?.uuid as string | undefined;
    if (uuid) {
      await this.getPool().query(
        'UPDATE environments SET parent_uuid = NULL WHERE parent_uuid = $1',
        [uuid]
      );
    }
    await this.getPool().query('DELETE FROM environments WHERE id = $1', [id]);
  }

  /**
   * Lists all saved requests in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Requests ordered by sort_order then name.
   */
  async listRequests(collectionId: number): Promise<SavedRequest[]> {
    const result = await this.getPool().query(
      'SELECT * FROM requests WHERE collection_id = $1 ORDER BY sort_order ASC, name ASC',
      [collectionId]
    );
    return result.rows.map(rowToRequest);
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
    const protocol = input.protocol === 'sse' ? 'sse' : 'http';
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
    const bodyRawOpen = input.body_raw_open === true;
    const folderId = input.folder_id ?? null;
    const serializedMarker =
      input.marker !== undefined ? serializeSidebarMarker(input.marker) : undefined;
    const now = new Date().toISOString();

    if (folderId != null) {
      const folderResult = await this.getPool().query(
        'SELECT collection_id FROM folders WHERE id = $1',
        [folderId]
      );
      const folderRow = folderResult.rows[0];
      if (!folderRow || folderRow.collection_id !== input.collection_id) {
        throw new Error('Folder not found');
      }
    }

    if (input.id) {
      const result =
        serializedMarker === undefined
          ? await this.getPool().query(
              `UPDATE requests SET
          collection_id = $1, folder_id = $2, name = $3, method = $4, protocol = $5, url = $6,
          headers = $7, user_agent = $8, params = $9, auth = $10, body = $11, body_type = $12, body_raw = $13, body_raw_open = $14,
          pre_request_script = $15, post_request_script = $16, pre_request_scripts = $17, post_request_scripts = $18, comment = $19, tags = $20,
          updated_at = $21
        WHERE id = $22`,
              [
                input.collection_id,
                folderId,
                trimmedName,
                input.method,
                protocol,
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
          : await this.getPool().query(
              `UPDATE requests SET
          collection_id = $1, folder_id = $2, name = $3, method = $4, protocol = $5, url = $6,
          headers = $7, user_agent = $8, params = $9, auth = $10, body = $11, body_type = $12, body_raw = $13, body_raw_open = $14,
          pre_request_script = $15, post_request_script = $16, pre_request_scripts = $17, post_request_scripts = $18, comment = $19, tags = $20,
          updated_at = $21, marker = $22
        WHERE id = $23`,
              [
                input.collection_id,
                folderId,
                trimmedName,
                input.method,
                protocol,
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

      if ((result.rowCount ?? 0) > 0) {
        const selectResult = await this.getPool().query('SELECT * FROM requests WHERE id = $1', [
          input.id
        ]);
        const row = selectResult.rows[0];
        if (row) return rowToRequest(row);
      }
    }

    const requestUuid = input.uuid?.trim() || generateDocumentUuid();
    const maxResult = await this.getPool().query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM requests
       WHERE collection_id = $1 AND (($2::int IS NULL AND folder_id IS NULL) OR folder_id = $2)`,
      [input.collection_id, folderId]
    );
    const maxOrder = (maxResult.rows[0]?.max_order as number) ?? -1;

    const result = await this.getPool().query(
      `INSERT INTO requests (
        collection_id, folder_id, name, method, protocol, url, headers, user_agent, params, auth, body, body_type, body_raw, body_raw_open,
        pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, comment, tags, sort_order, uuid, created_at, updated_at, marker
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *`,
      [
        input.collection_id,
        folderId,
        trimmedName,
        input.method,
        protocol,
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

    const row = result.rows[0];
    if (!row) throw new Error('Request not found after insert');
    return rowToRequest(row);
  }

  /**
   * Deletes a saved request by ID.
   *
   * @param id - Request ID to delete.
   */
  async deleteRequest(id: number): Promise<void> {
    await this.getPool().query('DELETE FROM requests WHERE id = $1', [id]);
  }

  /**
   * Updates a saved request's sidebar marker.
   *
   * @param id - Request ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated request.
   */
  async setRequestMarker(id: number, marker: string | null): Promise<SavedRequest> {
    const result = await this.getPool().query('UPDATE requests SET marker = $1 WHERE id = $2', [
      serializeSidebarMarker(marker),
      id
    ]);
    if (result.rowCount === 0) throw new Error('Request not found');

    const selectResult = await this.getPool().query('SELECT * FROM requests WHERE id = $1', [id]);
    const row = selectResult.rows[0];
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
    const result = await this.getPool().query(
      'SELECT * FROM folders WHERE collection_id = $1 ORDER BY sort_order ASC, name ASC',
      [collectionId]
    );
    return result.rows.map(rowToFolder);
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

    const result = await this.getPool().query(
      `INSERT INTO folders (collection_id, parent_folder_id, name, sort_order, uuid, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [collectionId, parentId, trimmedName, maxOrder + 1, generateDocumentUuid(), createdAt]
    );

    const row = result.rows[0];
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
    const folderResult = await this.getPool().query('SELECT * FROM folders WHERE id = $1', [
      folderId
    ]);
    const folderRow = folderResult.rows[0];
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

    await this.getPool().query('UPDATE folders SET parent_folder_id = $1 WHERE id = $2', [
      parentFolderId,
      folderId
    ]);
    await this.reorderFolders(collectionId, parentFolderId, orderedIds);

    const updatedResult = await this.getPool().query('SELECT * FROM folders WHERE id = $1', [
      folderId
    ]);
    const updatedRow = updatedResult.rows[0];
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
    const result = await this.getPool().query(
      'UPDATE folders SET name = $1 WHERE id = $2 RETURNING *',
      [trimmedName, id]
    );
    const row = result.rows[0];
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
    const result = await this.getPool().query(
      `UPDATE folders SET name = $1, variables = $2, headers = $3, user_agent = $4, auth = $5,
        pre_request_script = $6, post_request_script = $7, pre_request_scripts = $8, post_request_scripts = $9
       WHERE id = $10 RETURNING *`,
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
    const row = result.rows[0];
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
    const result = await this.getPool().query('UPDATE folders SET marker = $1 WHERE id = $2', [
      serializeSidebarMarker(marker),
      id
    ]);
    if (result.rowCount === 0) throw new Error('Folder not found');

    const selectResult = await this.getPool().query('SELECT * FROM folders WHERE id = $1', [id]);
    const row = selectResult.rows[0];
    if (!row) throw new Error('Folder not found');
    return rowToFolder(row);
  }

  /**
   * Deletes a folder, its descendant folders, and all requests and documents inside the subtree.
   *
   * @param id - Folder ID to delete.
   */
  async deleteFolder(id: number): Promise<void> {
    const folderResult = await this.getPool().query(
      'SELECT collection_id FROM folders WHERE id = $1',
      [id]
    );
    const collectionId = folderResult.rows[0]?.collection_id as number | undefined;
    if (collectionId == null) throw new Error('Folder not found');

    const folders = await this.listFolders(collectionId);
    const folderIds = folderSubtreeIdsForDeletion(id, folders);

    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      for (const folderId of folderIds) {
        await client.query('DELETE FROM requests WHERE folder_id = $1', [folderId]);
        await client.query('DELETE FROM documents WHERE folder_id = $1', [folderId]);
        await client.query('DELETE FROM folders WHERE id = $1', [folderId]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
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

    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      for (let index = 0; index < orderedFolderIds.length; index++) {
        await client.query(
          'UPDATE folders SET sort_order = $1 WHERE id = $2 AND collection_id = $3',
          [index, orderedFolderIds[index], collectionId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
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
      const folderResult = await this.getPool().query(
        'SELECT collection_id FROM folders WHERE id = $1',
        [folderId]
      );
      const folderRow = folderResult.rows[0];
      if (!folderRow || folderRow.collection_id !== collectionId) {
        throw new Error('Folder not found');
      }
    }

    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      for (let unifiedIndex = 0; unifiedIndex < items.length; unifiedIndex++) {
        const item = items[unifiedIndex];
        if (item.kind === 'request') {
          if (folderId == null) {
            await client.query(
              'UPDATE requests SET sort_order = $1, folder_id = NULL WHERE id = $2 AND collection_id = $3',
              [unifiedIndex, item.id, collectionId]
            );
          } else {
            await client.query(
              'UPDATE requests SET sort_order = $1, folder_id = $2 WHERE id = $3 AND collection_id = $4',
              [unifiedIndex, folderId, item.id, collectionId]
            );
          }
          continue;
        }

        if (folderId == null) {
          await client.query(
            'UPDATE documents SET sort_order = $1, folder_id = NULL WHERE id = $2 AND collection_id = $3',
            [unifiedIndex, item.id, collectionId]
          );
        } else {
          await client.query(
            'UPDATE documents SET sort_order = $1, folder_id = $2 WHERE id = $3 AND collection_id = $4',
            [unifiedIndex, folderId, item.id, collectionId]
          );
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
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
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      for (let index = 0; index < orderedRequestIds.length; index++) {
        await client.query(
          'UPDATE requests SET sort_order = $1, folder_id = $2 WHERE id = $3 AND collection_id = $4',
          [index, folderId, orderedRequestIds[index], collectionId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
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
    const requestResult = await this.getPool().query('SELECT * FROM requests WHERE id = $1', [
      requestId
    ]);
    const requestRow = requestResult.rows[0];
    if (!requestRow) throw new Error('Request not found');

    const request = rowToRequest(requestRow);
    const collectionId = request.collection_id;
    const sourceFolderId = request.folder_id ?? null;

    if (folderId != null) {
      const folderResult = await this.getPool().query(
        'SELECT collection_id FROM folders WHERE id = $1',
        [folderId]
      );
      const folderRow = folderResult.rows[0];
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
    const result = await this.getPool().query(
      'SELECT * FROM documents WHERE collection_id = $1 ORDER BY sort_order ASC, name ASC',
      [collectionId]
    );
    return result.rows.map((row) => rowToDocument(row as Record<string, unknown>));
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
      const folderResult = await this.getPool().query(
        'SELECT collection_id FROM folders WHERE id = $1',
        [folderId]
      );
      const folderRow = folderResult.rows[0];
      if (!folderRow || folderRow.collection_id !== input.collection_id) {
        throw new Error('Folder not found');
      }
    }

    if (input.id) {
      const updateResult =
        serializedMarker === undefined
          ? await this.getPool().query(
              `UPDATE documents SET
          collection_id = $1, folder_id = $2, name = $3, content = $4, updated_at = $5
        WHERE id = $6`,
              [input.collection_id, folderId, trimmedName, content, now, input.id]
            )
          : await this.getPool().query(
              `UPDATE documents SET
          collection_id = $1, folder_id = $2, name = $3, content = $4, updated_at = $5, marker = $6
        WHERE id = $7`,
              [input.collection_id, folderId, trimmedName, content, now, serializedMarker, input.id]
            );

      if (updateResult.rowCount && updateResult.rowCount > 0) {
        const selectResult = await this.getPool().query('SELECT * FROM documents WHERE id = $1', [
          input.id
        ]);
        const row = selectResult.rows[0];
        if (row) return rowToDocument(row as Record<string, unknown>);
      }
    }

    const documentUuid = input.uuid?.trim() || generateDocumentUuid();
    const maxResult = await this.getPool().query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM documents
       WHERE collection_id = $1 AND (($2::int IS NULL AND folder_id IS NULL) OR folder_id = $2)`,
      [input.collection_id, folderId]
    );
    const sortOrder = Number(maxResult.rows[0]?.max_order ?? -1) + 1;

    const insertResult = await this.getPool().query(
      `INSERT INTO documents (
        collection_id, folder_id, name, content, sort_order, uuid, created_at, updated_at, marker
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
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

    const row = insertResult.rows[0];
    if (!row) throw new Error('Document not found after insert');
    return rowToDocument(row as Record<string, unknown>);
  }

  /**
   * Deletes a markdown document by ID.
   *
   * @param id - Document ID to delete.
   */
  async deleteDocument(id: number): Promise<void> {
    await this.getPool().query('DELETE FROM documents WHERE id = $1', [id]);
  }

  /**
   * Updates a markdown document's sidebar marker.
   *
   * @param id - Document ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated document.
   */
  async setDocumentMarker(id: number, marker: string | null): Promise<CollectionDocument> {
    const result = await this.getPool().query('UPDATE documents SET marker = $1 WHERE id = $2', [
      serializeSidebarMarker(marker),
      id
    ]);
    if (result.rowCount === 0) throw new Error('Document not found');

    const selectResult = await this.getPool().query('SELECT * FROM documents WHERE id = $1', [id]);
    const row = selectResult.rows[0];
    if (!row) throw new Error('Document not found');
    return rowToDocument(row as Record<string, unknown>);
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
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      for (let index = 0; index < orderedDocumentIds.length; index++) {
        await client.query(
          'UPDATE documents SET sort_order = $1, folder_id = $2 WHERE id = $3 AND collection_id = $4',
          [index, folderId, orderedDocumentIds[index], collectionId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
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
    const documentResult = await this.getPool().query('SELECT * FROM documents WHERE id = $1', [
      documentId
    ]);
    const documentRow = documentResult.rows[0];
    if (!documentRow) throw new Error('Document not found');

    const document = rowToDocument(documentRow as Record<string, unknown>);
    const collectionId = document.collection_id;
    const sourceFolderId = document.folder_id ?? null;

    if (folderId != null) {
      const folderResult = await this.getPool().query(
        'SELECT collection_id FROM folders WHERE id = $1',
        [folderId]
      );
      const folderRow = folderResult.rows[0];
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
    const result = await this.getPool().query(
      `SELECT ${COLLECTION_COLUMNS} FROM collections WHERE id = $1`,
      [id]
    );

    const row = result.rows[0] as Record<string, unknown> | undefined;
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
    const client = await this.getPool().connect();

    try {
      await client.query('BEGIN');

      const collectionUuid = resolveImportedCollectionUuid(exportData);
      const collectionScripts = serializeImportedCollectionScriptFields(exportData);
      const collectionResult = await client.query(
        `INSERT INTO collections (name, uuid, variables, headers, user_agent, auth, pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, created_at, marker)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING ${COLLECTION_COLUMNS}`,
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

      const collectionId = collectionResult.rows[0]?.id as number;
      const folderMaps = createEmptyFolderImportMaps();

      for (const folder of sortExportedFoldersParentFirst(exportData.folders ?? [])) {
        const folderUuid = resolveImportedFolderUuid(folder);
        const folderFields = serializeImportedFolderFields(folder);
        const parentFolderId = resolveImportParentFolderId(
          folder.parent_folder_uuid,
          folderMaps.folderIdByUuid
        );
        const folderResult = await client.query(
          `INSERT INTO folders (
            collection_id, parent_folder_id, name, sort_order, uuid, variables, headers, user_agent, auth,
            pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, created_at, marker
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING id`,
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
          folderResult.rows[0]?.id as number,
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

        await client.query(
          `INSERT INTO requests (
            collection_id, folder_id, name, method, protocol, url, headers, user_agent, params, auth, body, body_type, body_raw, body_raw_open,
            pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, comment, tags, sort_order, uuid, created_at, updated_at, marker
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
          [
            collectionId,
            folderId,
            fields.name,
            fields.method,
            fields.protocol,
            fields.url,
            fields.headersJson,
            fields.userAgent,
            fields.paramsJson,
            fields.authJson,
            fields.body,
            fields.body_type,
            fields.body_raw,
            fields.body_raw_open,
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

        await client.query(
          `INSERT INTO documents (
            collection_id, folder_id, name, content, sort_order, uuid, created_at, updated_at, marker
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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

      await client.query('COMMIT');

      const row = collectionResult.rows[0];
      if (!row) throw new Error('Collection not found after import');
      return rowToCollection(row);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Looks up a collection by portable uuid within this PostgreSQL store.
   *
   * @param uuid - Stable collection identifier.
   * @returns The collection when found, otherwise null.
   */
  async findCollectionByUuid(uuid: string): Promise<Collection | null> {
    const trimmed = uuid.trim();
    if (!trimmed) {
      return null;
    }

    const result = await this.getPool().query(
      'SELECT ' + COLLECTION_COLUMNS + ' FROM collections WHERE uuid = $1',
      [trimmed]
    );

    const row = result.rows[0];
    return row ? rowToCollection(row) : null;
  }

  /**
   * Looks up a request by uuid within a collection in this PostgreSQL store.
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

    const result = await this.getPool().query(
      'SELECT * FROM requests WHERE collection_id = $1 AND uuid = $2',
      [collectionId, trimmed]
    );

    const row = result.rows[0];
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
    const client = await this.getPool().connect();

    try {
      await client.query('BEGIN');

      const collectionScripts = serializeImportedCollectionScriptFields(exportData);
      await client.query(
        'UPDATE collections SET name = $1, variables = $2, headers = $3, user_agent = $4, auth = $5, pre_request_script = $6, post_request_script = $7, pre_request_scripts = $8, post_request_scripts = $9, marker = $10 WHERE id = $11',
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

      const existingFolderResult = await client.query(
        'SELECT * FROM folders WHERE collection_id = $1',
        [id]
      );
      const folderMaps = buildFolderImportMaps(existingFolderResult.rows.map(rowToFolder));

      for (const folder of sortExportedFoldersParentFirst(exportData.folders ?? [])) {
        const parentFolderId = resolveImportParentFolderId(
          folder.parent_folder_uuid,
          folderMaps.folderIdByUuid
        );
        const plan = planImportedFolderUpsert(folder, folderMaps, parentFolderId);
        if (plan.action === 'update') {
          const folderFields = serializeImportedFolderFields(folder);
          await client.query(
            `UPDATE folders SET name = $1, parent_folder_id = $2, sort_order = $3, variables = $4, headers = $5, user_agent = $6, auth = $7,
              pre_request_script = $8, post_request_script = $9, pre_request_scripts = $10, post_request_scripts = $11, marker = $12
             WHERE id = $13 AND collection_id = $14`,
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
        const folderResult = await client.query(
          `INSERT INTO folders (
            collection_id, parent_folder_id, name, sort_order, uuid, variables, headers, user_agent, auth,
            pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, created_at, marker
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING id`,
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
          folderResult.rows[0]?.id as number,
          plan.name,
          plan.uuid,
          parentFolderId
        );
      }

      const existingRequestResult = await client.query(
        'SELECT * FROM requests WHERE collection_id = $1',
        [id]
      );
      const existingRequests = existingRequestResult.rows.map(rowToRequest);
      const requestUuidIndex = buildRequestUuidIndex(existingRequests);
      const requestFingerprints = buildRequestFingerprintIndexes(existingRequests);

      const existingDocumentResult = await client.query(
        'SELECT * FROM documents WHERE collection_id = $1',
        [id]
      );
      const documentUuidIndex = buildDocumentUuidIndex(
        existingDocumentResult.rows.map((row) => rowToDocument(row as Record<string, unknown>))
      );

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
          await client.query(
            `UPDATE requests SET
              folder_id = $1, name = $2, method = $3, protocol = $4, url = $5, headers = $6, user_agent = $7, params = $8, auth = $9,
              body = $10, body_type = $11, body_raw = $12, body_raw_open = $13, pre_request_script = $14, post_request_script = $15, pre_request_scripts = $16, post_request_scripts = $17, comment = $18, tags = $19,
              sort_order = $20, updated_at = $21, marker = $22
            WHERE id = $23 AND collection_id = $24`,
            [
              folderId,
              fields.name,
              fields.method,
              fields.protocol,
              fields.url,
              fields.headersJson,
              fields.userAgent,
              fields.paramsJson,
              fields.authJson,
              fields.body,
              fields.body_type,
              fields.body_raw,
              fields.body_raw_open,
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

        await client.query(
          `INSERT INTO requests (
            collection_id, folder_id, name, method, protocol, url, headers, user_agent, params, auth, body, body_type, body_raw, body_raw_open,
            pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, comment, tags, sort_order, uuid, created_at, updated_at, marker
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
          [
            id,
            folderId,
            fields.name,
            fields.method,
            fields.protocol,
            fields.url,
            fields.headersJson,
            fields.userAgent,
            fields.paramsJson,
            fields.authJson,
            fields.body,
            fields.body_type,
            fields.body_raw,
            fields.body_raw_open,
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
          await client.query(
            `UPDATE documents SET
              folder_id = $1, name = $2, content = $3, sort_order = $4, updated_at = $5, marker = $6
            WHERE id = $7 AND collection_id = $8`,
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

        await client.query(
          `INSERT INTO documents (
            collection_id, folder_id, name, content, sort_order, uuid, created_at, updated_at, marker
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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

      const selectResult = await client.query(
        'SELECT ' + COLLECTION_COLUMNS + ' FROM collections WHERE id = $1',
        [id]
      );

      await client.query('COMMIT');

      const row = selectResult.rows[0];
      if (!row) throw new Error('Collection not found');
      return rowToCollection(row);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Reads a persisted setting by key.
   *
   * @param key - Setting key to look up.
   * @returns The stored value, or undefined when not set.
   */
  async getSetting(key: string): Promise<string | undefined> {
    const result = await this.getPool().query('SELECT value FROM settings WHERE "key" = $1', [key]);
    const row = result.rows[0];
    return row ? (row.value as string) : undefined;
  }

  /**
   * Persists a setting value, replacing any existing entry for the key.
   *
   * @param key - Setting key to store.
   * @param value - Value to persist.
   */
  async setSetting(key: string, value: string): Promise<void> {
    await this.getPool().query(
      'INSERT INTO settings ("key", value) VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET value = EXCLUDED.value',
      [key, value]
    );
  }

  /**
   * Git-backed providers return status; PostgreSQL is not source-controlled.
   */
  async getSourceControlStatus(): Promise<null> {
    return null;
  }

  /**
   * Lists all snippets stored in this provider ordered for display.
   */
  async listSnippets(): Promise<Snippet[]> {
    const result = await this.getPool().query(
      `SELECT ${PROVIDER_SNIPPET_COLUMNS} FROM snippets ORDER BY sort_order ASC, name ASC`
    );
    return result.rows.map((row) => rowToProviderSnippet(row as Record<string, unknown>));
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
    const maxResult = await this.getPool().query(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM snippets'
    );
    const sortOrder = Number(maxResult.rows[0]?.max_order ?? -1) + 1;
    const insertResult = await this.getPool().query(
      'INSERT INTO snippets (name, uuid, code, scope, stage, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ' +
        PROVIDER_SNIPPET_COLUMNS,
      [trimmedName, snippetUuid, code ?? '', scope, normalizedRole, sortOrder, now, now]
    );
    const row = insertResult.rows[0];
    if (!row) throw new Error('Snippet not found after insert');
    return rowToProviderSnippet(row as Record<string, unknown>);
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
    const updateResult = await this.getPool().query(
      'UPDATE snippets SET name = $1, code = $2, scope = $3, stage = $4, updated_at = $5 WHERE id = $6',
      [trimmedName, code ?? '', scope, normalizedRole, now, id]
    );
    if (updateResult.rowCount === 0) throw new Error('Snippet not found');

    const selectResult = await this.getPool().query(
      `SELECT ${PROVIDER_SNIPPET_COLUMNS} FROM snippets WHERE id = $1`,
      [id]
    );
    const row = selectResult.rows[0];
    if (!row) throw new Error('Snippet not found');
    return rowToProviderSnippet(row as Record<string, unknown>);
  }

  /**
   * Deletes a snippet from this provider.
   */
  async deleteSnippet(id: number): Promise<void> {
    await this.getPool().query('DELETE FROM snippets WHERE id = $1', [id]);
  }

  /**
   * Lists live servers ordered by their provider sort position.
   */
  async listLiveServers(): Promise<LiveServer[]> {
    const result = await this.getPool().query(
      `SELECT ${PROVIDER_LIVE_SERVER_COLUMNS} FROM live_servers ORDER BY sort_order ASC, name ASC`
    );
    return result.rows.map((row) => rowToProviderLiveServer(row as Record<string, unknown>));
  }

  /**
   * Creates a live server with normalized payload fields.
   *
   * @param input - Live server fields to persist.
   */
  async createLiveServer(input: CreateLiveServerInput): Promise<LiveServer> {
    const name = trimRequiredName(input.name, 'Live server name');
    if (!input.root.trim()) throw new Error('Root directory is required');
    const now = Date.now();
    const maxResult = await this.getPool().query(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM live_servers'
    );
    const result = await this.getPool().query(
      `INSERT INTO live_servers (uuid, name, payload, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${PROVIDER_LIVE_SERVER_COLUMNS}`,
      [
        input.uuid?.trim() || generateDocumentUuid(),
        name,
        serializeLiveServerPayload(input),
        Number(maxResult.rows[0]?.max_order ?? -1) + 1,
        now,
        now
      ]
    );
    return rowToProviderLiveServer(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Replaces a live server's mutable fields.
   *
   * @param input - Complete live server update.
   */
  async updateLiveServer(input: UpdateLiveServerInput): Promise<LiveServer> {
    const name = trimRequiredName(input.name, 'Live server name');
    if (!input.root.trim()) throw new Error('Root directory is required');
    const result = await this.getPool().query(
      `UPDATE live_servers SET name = $1, payload = $2, updated_at = $3 WHERE id = $4
       RETURNING ${PROVIDER_LIVE_SERVER_COLUMNS}`,
      [name, serializeLiveServerPayload(input), Date.now(), input.id]
    );
    if (!result.rows[0]) throw new Error(`Live server not found: ${input.id}`);
    return rowToProviderLiveServer(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Deletes a live server by provider-local id.
   *
   * @param id - Live server id.
   */
  async deleteLiveServer(id: number): Promise<void> {
    await this.getPool().query('DELETE FROM live_servers WHERE id = $1', [id]);
  }

  /**
   * Lists live pages ordered by their provider sort position.
   */
  async listLivePages(): Promise<Website[]> {
    const result = await this.getPool().query(
      `SELECT ${PROVIDER_LIVE_PAGE_COLUMNS} FROM live_pages ORDER BY sort_order ASC, name ASC`
    );
    return result.rows.map((row) => rowToProviderLivePage(row as Record<string, unknown>));
  }

  /**
   * Creates a live page with a serialized website payload.
   *
   * @param input - Website fields to persist.
   */
  async createLivePage(input: CreateWebsiteInput): Promise<Website> {
    const name = trimRequiredName(input.name, 'Live page name');
    const now = Date.now();
    const maxResult = await this.getPool().query(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM live_pages'
    );
    const result = await this.getPool().query(
      `INSERT INTO live_pages (uuid, name, payload, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${PROVIDER_LIVE_PAGE_COLUMNS}`,
      [
        input.uuid?.trim() || generateDocumentUuid(),
        name,
        serializeLivePagePayload(input),
        Number(maxResult.rows[0]?.max_order ?? -1) + 1,
        now,
        now
      ]
    );
    return rowToProviderLivePage(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Replaces a live page's mutable fields.
   *
   * @param input - Complete live page update.
   */
  async updateLivePage(input: UpdateWebsiteInput): Promise<Website> {
    const result = await this.getPool().query(
      `UPDATE live_pages SET name = $1, payload = $2, updated_at = $3 WHERE id = $4
       RETURNING ${PROVIDER_LIVE_PAGE_COLUMNS}`,
      [
        trimRequiredName(input.name, 'Live page name'),
        serializeLivePagePayload(input),
        Date.now(),
        input.id
      ]
    );
    if (!result.rows[0]) throw new Error(`Live page not found: ${input.id}`);
    return rowToProviderLivePage(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Deletes a live page by provider-local id.
   *
   * @param id - Live page id.
   */
  async deleteLivePage(id: number): Promise<void> {
    await this.getPool().query('DELETE FROM live_pages WHERE id = $1', [id]);
  }

  /**
   * PostgreSQL-backed storage does not persist run result snapshots.
   */
  async listRunResults(): Promise<ProviderRunResultSummary[]> {
    return [];
  }

  /**
   * PostgreSQL-backed storage does not persist run result snapshots.
   */
  async saveRunResult(input: SaveRunResultInput): Promise<ProviderRunResult> {
    void input;
    throw new Error('Run results are not supported for this storage provider');
  }

  /**
   * PostgreSQL-backed storage does not persist run result snapshots.
   */
  async getRunResult(id: number): Promise<ProviderRunResult | null> {
    void id;
    throw new Error('Run results are not supported for this storage provider');
  }

  /**
   * PostgreSQL-backed storage does not persist run result snapshots.
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
