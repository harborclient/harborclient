import { Pool } from 'pg';
import {
  buildFolderImportMaps,
  buildRequestUuidIndex,
  planImportedFolderUpsert,
  registerImportedFolderInMaps,
  resolveImportFolderId,
  resolveImportedCollectionUuid,
  resolveImportedFolderUuid,
  serializeImportedRequestFields
} from '#/main/storage/collectionImport';
import {
  maskVariablesForExport,
  normalizeVariable,
  validateCollectionExport
} from '#/main/storage/collectionData';
import {
  rowToCollection,
  rowToEnvironment,
  rowToFolder,
  rowToRequest
} from '#/main/storage/entityMappers';
import {
  bundleScriptFieldsWithLegacy,
  migratePostgresScriptArrayColumns
} from '#/main/storage/scriptFields';
import { trimRequiredName } from '#/main/storage/trimRequiredName';
import { DEFAULT_AUTH_JSON, defaultAuth, normalizeAuth } from '#/shared/auth';
import type { IStorage } from '#/main/storage/IStorage';
import type {
  AuthConfig,
  Collection,
  CollectionExport,
  Environment,
  Folder,
  KeyValue,
  PostgresSettings,
  SaveRequestInput,
  SavedRequest,
  ScriptRef,
  Variable
} from '#/shared/types';
import { parseJson } from '#/shared/parseJson';
import { generateDocumentUuid } from '#/main/storage/uuid';

const COLLECTION_COLUMNS =
  'id, uuid, name, variables, headers, auth, pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, created_at';
const ENVIRONMENT_COLUMNS = 'id, uuid, name, variables, created_at';

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
        url TEXT NOT NULL,
        headers TEXT NOT NULL,
        params TEXT NOT NULL,
        body TEXT NOT NULL,
        body_type VARCHAR(32) NOT NULL DEFAULT 'none',
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
        created_at VARCHAR(64) NOT NULL
      )
    `);

    await this.#pool.query(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS comment TEXT NOT NULL DEFAULT ''
    `);

    await this.#pool.query(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT ''
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
      ALTER TABLE collections ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT ''
    `);

    await this.#pool.query(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT ''
    `);

    await this.#pool.query(`
      ALTER TABLE environments ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT ''
    `);

    await this.#pool.query(`
      ALTER TABLE folders ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT ''
    `);

    await this.backfillDocumentUuids('collections');
    await this.backfillDocumentUuids('requests');
    await this.backfillDocumentUuids('environments');
    await this.backfillDocumentUuids('folders');
    await migratePostgresScriptArrayColumns(this.getPool(), 'collections');
    await migratePostgresScriptArrayColumns(this.getPool(), 'requests');
  }

  /**
   * Assigns uuids to rows that were created before uuid support existed.
   *
   * @param table - Table name (`collections`, `requests`, `environments`, or `folders`).
   */
  private async backfillDocumentUuids(
    table: 'collections' | 'requests' | 'environments' | 'folders'
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
    const result = await this.getPool().query(
      'UPDATE collections SET name = $1, variables = $2, headers = $3, auth = $4, pre_request_script = $5, post_request_script = $6, pre_request_scripts = $7, post_request_scripts = $8 WHERE id = $9',
      [
        trimmedName,
        JSON.stringify(variables),
        JSON.stringify(headers),
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
  async createEnvironment(name: string): Promise<Environment> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const createdAt = new Date().toISOString();
    const environmentUuid = generateDocumentUuid();
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
   * Updates an environment's name and variables.
   *
   * @param id - Environment ID to update.
   * @param name - New display name.
   * @param variables - Environment-scoped variables.
   * @returns The updated environment.
   */
  async updateEnvironment(id: number, name: string, variables: Variable[]): Promise<Environment> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const result = await this.getPool().query(
      'UPDATE environments SET name = $1, variables = $2 WHERE id = $3',
      [trimmedName, JSON.stringify(variables), id]
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
   * Deletes an environment.
   *
   * @param id - Environment ID to delete.
   */
  async deleteEnvironment(id: number): Promise<void> {
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
      const result = await this.getPool().query(
        `UPDATE requests SET
          collection_id = $1, folder_id = $2, name = $3, method = $4, url = $5,
          headers = $6, params = $7, auth = $8, body = $9, body_type = $10,
          pre_request_script = $11, post_request_script = $12, pre_request_scripts = $13, post_request_scripts = $14, comment = $15, tags = $16,
          updated_at = $17
        WHERE id = $18`,
        [
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
        collection_id, folder_id, name, method, url, headers, params, auth, body, body_type,
        pre_request_script, post_request_script, pre_request_scripts, post_request_scripts, comment, tags, sort_order, uuid, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
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
        maxOrder + 1,
        requestUuid,
        now,
        now
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
   * @returns The newly created folder.
   */
  async createFolder(collectionId: number, name: string): Promise<Folder> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    const createdAt = new Date().toISOString();
    const maxResult = await this.getPool().query(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM folders WHERE collection_id = $1',
      [collectionId]
    );
    const maxOrder = (maxResult.rows[0]?.max_order as number) ?? -1;

    const result = await this.getPool().query(
      `INSERT INTO folders (collection_id, name, sort_order, uuid, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [collectionId, trimmedName, maxOrder + 1, generateDocumentUuid(), createdAt]
    );

    const row = result.rows[0];
    if (!row) throw new Error('Folder not found after insert');
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
    const result = await this.getPool().query(
      'UPDATE folders SET name = $1 WHERE id = $2 RETURNING *',
      [trimmedName, id]
    );
    const row = result.rows[0];
    if (!row) throw new Error('Folder not found');
    return rowToFolder(row);
  }

  /**
   * Deletes a folder and all requests inside it.
   *
   * @param id - Folder ID to delete.
   */
  async deleteFolder(id: number): Promise<void> {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM requests WHERE folder_id = $1', [id]);
      await client.query('DELETE FROM folders WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Reorders folders within a collection.
   *
   * @param collectionId - Collection containing the folders.
   * @param orderedFolderIds - Folder IDs in desired order.
   */
  async reorderFolders(collectionId: number, orderedFolderIds: number[]): Promise<void> {
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
    // Run the read, validate, and reindex steps on a single client wrapped in a
    // transaction so a concurrent move or mid-operation failure cannot leave
    // duplicate or gap-filled sort_order values across the source and
    // destination containers.
    const client = await this.getPool().connect();

    const listInContainer = async (
      collectionId: number,
      targetFolderId: number | null
    ): Promise<number[]> => {
      const result = await client.query(
        `SELECT id FROM requests WHERE collection_id = $1
         AND (($2::int IS NULL AND folder_id IS NULL) OR folder_id = $2)
         ORDER BY sort_order ASC, name ASC`,
        [collectionId, targetFolderId]
      );
      return result.rows.map((row) => row.id as number);
    };

    const reindexContainer = async (
      targetFolderId: number | null,
      orderedIds: number[]
    ): Promise<void> => {
      for (let sortIndex = 0; sortIndex < orderedIds.length; sortIndex++) {
        await client.query('UPDATE requests SET sort_order = $1, folder_id = $2 WHERE id = $3', [
          sortIndex,
          targetFolderId,
          orderedIds[sortIndex]
        ]);
      }
    };

    try {
      await client.query('BEGIN');

      const requestResult = await client.query('SELECT * FROM requests WHERE id = $1', [requestId]);
      const requestRow = requestResult.rows[0];
      if (!requestRow) throw new Error('Request not found');

      const request = rowToRequest(requestRow);
      const collectionId = request.collection_id;
      const oldFolderId = request.folder_id;

      if (folderId != null) {
        const folderResult = await client.query('SELECT collection_id FROM folders WHERE id = $1', [
          folderId
        ]);
        const folderRow = folderResult.rows[0];
        if (!folderRow || folderRow.collection_id !== collectionId) {
          throw new Error('Folder not found');
        }
      }

      if (oldFolderId === folderId) {
        const siblings = (await listInContainer(collectionId, folderId)).filter(
          (id) => id !== requestId
        );
        siblings.splice(index, 0, requestId);
        await reindexContainer(folderId, siblings);
      } else {
        const oldIds = (await listInContainer(collectionId, oldFolderId)).filter(
          (id) => id !== requestId
        );
        await reindexContainer(oldFolderId, oldIds);

        const newIds = (await listInContainer(collectionId, folderId)).filter(
          (id) => id !== requestId
        );
        newIds.splice(index, 0, requestId);
        await reindexContainer(folderId, newIds);
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
   * Builds a portable export payload for a collection and its requests.
   *
   * @param id - Collection ID to export.
   * @returns Collection export data without database IDs.
   */
  async exportCollectionData(id: number): Promise<CollectionExport> {
    const result = await this.getPool().query(
      'SELECT name, uuid, variables, headers, auth, pre_request_script, post_request_script FROM collections WHERE id = $1',
      [id]
    );

    const row = result.rows[0];
    if (!row) throw new Error('Collection not found');

    const folderRecords = await this.listFolders(id);
    const folders = folderRecords.map(({ uuid, name, sort_order }) => ({
      uuid,
      name,
      sort_order
    }));
    const folderNameById = new Map(folderRecords.map((folder) => [folder.id, folder.name]));
    const folderUuidById = new Map(folderRecords.map((folder) => [folder.id, folder.uuid]));

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
        tags,
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
        tags,
        sort_order,
        folder_name: folder_id != null ? (folderNameById.get(folder_id) ?? null) : null,
        folder_uuid: folder_id != null ? (folderUuidById.get(folder_id) ?? null) : null
      })
    );

    const variables = parseJson<Partial<Variable>[]>(row.variables as string, []).map(
      normalizeVariable
    );
    const headers = parseJson<KeyValue[]>(row.headers as string, []);
    const auth = normalizeAuth(parseJson(row.auth as string, defaultAuth()));

    return {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid: row.uuid as string,
      name: row.name as string,
      variables: maskVariablesForExport(variables),
      headers,
      auth,
      pre_request_script: (row.pre_request_script as string) ?? '',
      post_request_script: (row.post_request_script as string) ?? '',
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
    const now = new Date().toISOString();
    const client = await this.getPool().connect();

    try {
      await client.query('BEGIN');

      const collectionUuid = resolveImportedCollectionUuid(exportData);
      const collectionResult = await client.query(
        `INSERT INTO collections (name, uuid, variables, headers, auth, pre_request_script, post_request_script, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${COLLECTION_COLUMNS}`,
        [
          exportData.name,
          collectionUuid,
          JSON.stringify(exportData.variables),
          JSON.stringify(exportData.headers),
          JSON.stringify(exportData.auth ?? defaultAuth()),
          exportData.pre_request_script,
          exportData.post_request_script,
          now
        ]
      );

      const collectionId = collectionResult.rows[0]?.id as number;
      const folderMaps: ReturnType<typeof buildFolderImportMaps> = {
        folderIdByUuid: new Map(),
        folderIdByName: new Map(),
        folderUuidById: new Map()
      };

      for (const folder of exportData.folders ?? []) {
        const folderUuid = resolveImportedFolderUuid(folder);
        const folderResult = await client.query(
          `INSERT INTO folders (collection_id, name, sort_order, uuid, created_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [collectionId, folder.name, folder.sort_order, folderUuid, now]
        );
        registerImportedFolderInMaps(
          folderMaps,
          folderResult.rows[0]?.id as number,
          folder.name,
          folderUuid
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
            collection_id, folder_id, name, method, url, headers, params, auth, body, body_type,
            pre_request_script, post_request_script, comment, tags, sort_order, uuid, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
          [
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
            fields.tags,
            fields.sort_order,
            fields.uuid,
            now,
            now
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

      await client.query(
        'UPDATE collections SET name = $1, variables = $2, headers = $3, auth = $4, pre_request_script = $5, post_request_script = $6 WHERE id = $7',
        [
          exportData.name,
          JSON.stringify(exportData.variables),
          JSON.stringify(exportData.headers),
          JSON.stringify(exportData.auth ?? defaultAuth()),
          exportData.pre_request_script,
          exportData.post_request_script,
          id
        ]
      );

      const existingFolderResult = await client.query(
        'SELECT * FROM folders WHERE collection_id = $1',
        [id]
      );
      const folderMaps = buildFolderImportMaps(existingFolderResult.rows.map(rowToFolder));

      for (const folder of exportData.folders ?? []) {
        const plan = planImportedFolderUpsert(folder, folderMaps);
        if (plan.action === 'update') {
          await client.query(
            'UPDATE folders SET name = $1, sort_order = $2 WHERE id = $3 AND collection_id = $4',
            [plan.name, plan.sort_order, plan.existingId, id]
          );
          registerImportedFolderInMaps(folderMaps, plan.existingId, plan.name, plan.uuid);
          continue;
        }

        const folderResult = await client.query(
          `INSERT INTO folders (collection_id, name, sort_order, uuid, created_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [id, plan.name, plan.sort_order, plan.uuid, now]
        );
        registerImportedFolderInMaps(
          folderMaps,
          folderResult.rows[0]?.id as number,
          plan.name,
          plan.uuid
        );
      }

      const existingRequestResult = await client.query(
        'SELECT * FROM requests WHERE collection_id = $1',
        [id]
      );
      const requestUuidIndex = buildRequestUuidIndex(existingRequestResult.rows.map(rowToRequest));

      for (const request of exportData.requests) {
        const folderId = resolveImportFolderId(
          request.folder_uuid,
          request.folder_name,
          folderMaps.folderIdByUuid,
          folderMaps.folderIdByName
        );
        const fields = serializeImportedRequestFields(request);
        const existingRequestId = fields.uuid ? requestUuidIndex.get(fields.uuid) : undefined;

        if (existingRequestId != null) {
          await client.query(
            `UPDATE requests SET
              folder_id = $1, name = $2, method = $3, url = $4, headers = $5, params = $6, auth = $7,
              body = $8, body_type = $9, pre_request_script = $10, post_request_script = $11, comment = $12, tags = $13,
              sort_order = $14, updated_at = $15
            WHERE id = $16 AND collection_id = $17`,
            [
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
              fields.tags,
              fields.sort_order,
              now,
              existingRequestId,
              id
            ]
          );
          continue;
        }

        await client.query(
          `INSERT INTO requests (
            collection_id, folder_id, name, method, url, headers, params, auth, body, body_type,
            pre_request_script, post_request_script, comment, tags, sort_order, uuid, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
          [
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
            fields.tags,
            fields.sort_order,
            fields.uuid,
            now,
            now
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
   * Closes the database connection.
   */
  async close(): Promise<void> {
    if (this.#pool) {
      await this.#pool.end();
      this.#pool = null;
    }
  }
}
