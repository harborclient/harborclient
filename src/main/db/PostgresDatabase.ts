import { Pool } from 'pg';
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
  PostgresSettings,
  SaveRequestInput,
  SavedRequest,
  Variable
} from '#/shared/types';
import { parseJson } from '#/shared/parseJson';

export class PostgresDatabase implements IDatabase {
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
  }

  /**
   * Lists all collections ordered by name.
   *
   * @returns All collections in the database.
   */
  async listCollections(): Promise<Collection[]> {
    const result = await this.getPool().query(
      'SELECT id, name, variables, headers, auth, pre_request_script, post_request_script, created_at FROM collections ORDER BY name ASC'
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
    const result = await this.getPool().query(
      `INSERT INTO collections (name, variables, headers, pre_request_script, post_request_script, created_at)
       VALUES ($1, '[]', '[]', '', '', $2)
       RETURNING id, name, variables, headers, auth, pre_request_script, post_request_script, created_at`,
      [trimmedName, createdAt]
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
    auth: AuthConfig
  ): Promise<Collection> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const result = await this.getPool().query(
      'UPDATE collections SET name = $1, variables = $2, headers = $3, auth = $4, pre_request_script = $5, post_request_script = $6 WHERE id = $7',
      [
        trimmedName,
        JSON.stringify(variables),
        JSON.stringify(headers),
        JSON.stringify(auth),
        preRequestScript,
        postRequestScript,
        id
      ]
    );

    if (result.rowCount === 0) throw new Error('Collection not found');

    const selectResult = await this.getPool().query(
      'SELECT id, name, variables, headers, auth, pre_request_script, post_request_script, created_at FROM collections WHERE id = $1',
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
      'SELECT id, name, variables, created_at FROM environments ORDER BY name ASC'
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
    const result = await this.getPool().query(
      `INSERT INTO environments (name, variables, created_at) VALUES ($1, '[]', $2)
       RETURNING id, name, variables, created_at`,
      [trimmedName, createdAt]
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
      'SELECT id, name, variables, created_at FROM environments WHERE id = $1',
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
    const preRequestScript = input.pre_request_script ?? '';
    const postRequestScript = input.post_request_script ?? '';
    const comment = input.comment ?? '';
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
          pre_request_script = $11, post_request_script = $12, comment = $13,
          updated_at = $14
        WHERE id = $15`,
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
          comment,
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

    const maxResult = await this.getPool().query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM requests
       WHERE collection_id = $1 AND (($2::int IS NULL AND folder_id IS NULL) OR folder_id = $2)`,
      [input.collection_id, folderId]
    );
    const maxOrder = (maxResult.rows[0]?.max_order as number) ?? -1;

    const result = await this.getPool().query(
      `INSERT INTO requests (
        collection_id, folder_id, name, method, url, headers, params, auth, body, body_type,
        pre_request_script, post_request_script, comment, sort_order, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
        comment,
        maxOrder + 1,
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
      `INSERT INTO folders (collection_id, name, sort_order, created_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [collectionId, trimmedName, maxOrder + 1, createdAt]
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
      'SELECT name, variables, headers, auth, pre_request_script, post_request_script FROM collections WHERE id = $1',
      [id]
    );

    const row = result.rows[0];
    if (!row) throw new Error('Collection not found');

    const folderRecords = await this.listFolders(id);
    const folders = folderRecords.map(({ name, sort_order }) => ({ name, sort_order }));
    const folderNameById = new Map(folderRecords.map((folder) => [folder.id, folder.name]));

    const requests = (await this.listRequests(id)).map(
      ({
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
        folder_name: folder_id != null ? (folderNameById.get(folder_id) ?? null) : null
      })
    );

    const variables = parseJson<Partial<Variable>[]>(row.variables as string, []).map(
      normalizeVariable
    );
    const headers = parseJson<KeyValue[]>(row.headers as string, []);
    const auth = normalizeAuth(parseJson(row.auth as string, defaultAuth()));

    return {
      harborclientVersion: 2,
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

      const collectionResult = await client.query(
        `INSERT INTO collections (name, variables, headers, auth, pre_request_script, post_request_script, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, variables, headers, auth, pre_request_script, post_request_script, created_at`,
        [
          exportData.name,
          JSON.stringify(exportData.variables),
          JSON.stringify(exportData.headers),
          JSON.stringify(exportData.auth ?? defaultAuth()),
          exportData.pre_request_script,
          exportData.post_request_script,
          now
        ]
      );

      const collectionId = collectionResult.rows[0]?.id as number;
      const folderIdByName = new Map<string, number>();

      for (const folder of exportData.folders ?? []) {
        if (folderIdByName.has(folder.name)) {
          throw new Error(`Invalid collection file: duplicate folder name "${folder.name}"`);
        }
        const folderResult = await client.query(
          `INSERT INTO folders (collection_id, name, sort_order, created_at)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [collectionId, folder.name, folder.sort_order, now]
        );
        folderIdByName.set(folder.name, folderResult.rows[0]?.id as number);
      }

      for (const request of exportData.requests) {
        const folderName = request.folder_name ?? null;
        const folderId =
          folderName != null && folderName.trim() ? (folderIdByName.get(folderName) ?? null) : null;

        await client.query(
          `INSERT INTO requests (
            collection_id, folder_id, name, method, url, headers, params, auth, body, body_type,
            pre_request_script, post_request_script, comment, sort_order, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            collectionId,
            folderId,
            request.name,
            request.method,
            request.url,
            JSON.stringify(request.headers),
            JSON.stringify(request.params),
            JSON.stringify(request.auth ?? defaultAuth()),
            request.body,
            request.body_type,
            request.pre_request_script,
            request.post_request_script,
            request.comment,
            request.sort_order,
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
   * Closes the database connection.
   */
  async close(): Promise<void> {
    if (this.#pool) {
      await this.#pool.end();
      this.#pool = null;
    }
  }
}
