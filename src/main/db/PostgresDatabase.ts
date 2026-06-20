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
import type { IDatabase } from '#/main/db/IDatabase';
import type {
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

  async listCollections(): Promise<Collection[]> {
    const result = await this.getPool().query(
      'SELECT id, name, variables, headers, pre_request_script, post_request_script, created_at FROM collections ORDER BY name ASC'
    );
    return result.rows.map(rowToCollection);
  }

  async createCollection(name: string): Promise<Collection> {
    const createdAt = new Date().toISOString();
    const result = await this.getPool().query(
      `INSERT INTO collections (name, variables, headers, pre_request_script, post_request_script, created_at)
       VALUES ($1, '[]', '[]', '', '', $2)
       RETURNING id, name, variables, headers, pre_request_script, post_request_script, created_at`,
      [name.trim(), createdAt]
    );

    const row = result.rows[0];
    if (!row) throw new Error('Collection not found after insert');
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
    const result = await this.getPool().query(
      'UPDATE collections SET name = $1, variables = $2, headers = $3, pre_request_script = $4, post_request_script = $5 WHERE id = $6',
      [
        name.trim(),
        JSON.stringify(variables),
        JSON.stringify(headers),
        preRequestScript,
        postRequestScript,
        id
      ]
    );

    if (result.rowCount === 0) throw new Error('Collection not found');

    const selectResult = await this.getPool().query(
      'SELECT id, name, variables, headers, pre_request_script, post_request_script, created_at FROM collections WHERE id = $1',
      [id]
    );

    const row = selectResult.rows[0];
    if (!row) throw new Error('Collection not found');
    return rowToCollection(row);
  }

  async deleteCollection(id: number): Promise<void> {
    await this.getPool().query('DELETE FROM collections WHERE id = $1', [id]);
  }

  async listEnvironments(): Promise<Environment[]> {
    const result = await this.getPool().query(
      'SELECT id, name, variables, created_at FROM environments ORDER BY name ASC'
    );
    return result.rows.map(rowToEnvironment);
  }

  async createEnvironment(name: string): Promise<Environment> {
    const createdAt = new Date().toISOString();
    const result = await this.getPool().query(
      `INSERT INTO environments (name, variables, created_at) VALUES ($1, '[]', $2)
       RETURNING id, name, variables, created_at`,
      [name.trim(), createdAt]
    );

    const row = result.rows[0];
    if (!row) throw new Error('Environment not found after insert');
    return rowToEnvironment(row);
  }

  async updateEnvironment(id: number, name: string, variables: Variable[]): Promise<Environment> {
    const result = await this.getPool().query(
      'UPDATE environments SET name = $1, variables = $2 WHERE id = $3',
      [name.trim(), JSON.stringify(variables), id]
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

  async deleteEnvironment(id: number): Promise<void> {
    await this.getPool().query('DELETE FROM environments WHERE id = $1', [id]);
  }

  async listRequests(collectionId: number): Promise<SavedRequest[]> {
    const result = await this.getPool().query(
      'SELECT * FROM requests WHERE collection_id = $1 ORDER BY sort_order ASC, name ASC',
      [collectionId]
    );
    return result.rows.map(rowToRequest);
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
      const result = await this.getPool().query(
        `UPDATE requests SET
          collection_id = $1, folder_id = $2, name = $3, method = $4, url = $5,
          headers = $6, params = $7, body = $8, body_type = $9,
          pre_request_script = $10, post_request_script = $11, comment = $12,
          updated_at = $13
        WHERE id = $14`,
        [
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
        collection_id, folder_id, name, method, url, headers, params, body, body_type,
        pre_request_script, post_request_script, comment, sort_order, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
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
        maxOrder + 1,
        now,
        now
      ]
    );

    const row = result.rows[0];
    if (!row) throw new Error('Request not found after insert');
    return rowToRequest(row);
  }

  async deleteRequest(id: number): Promise<void> {
    await this.getPool().query('DELETE FROM requests WHERE id = $1', [id]);
  }

  async listFolders(collectionId: number): Promise<Folder[]> {
    const result = await this.getPool().query(
      'SELECT * FROM folders WHERE collection_id = $1 ORDER BY sort_order ASC, name ASC',
      [collectionId]
    );
    return result.rows.map(rowToFolder);
  }

  async createFolder(collectionId: number, name: string): Promise<Folder> {
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
      [collectionId, name.trim(), maxOrder + 1, createdAt]
    );

    const row = result.rows[0];
    if (!row) throw new Error('Folder not found after insert');
    return rowToFolder(row);
  }

  async renameFolder(id: number, name: string): Promise<Folder> {
    const result = await this.getPool().query(
      'UPDATE folders SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), id]
    );
    const row = result.rows[0];
    if (!row) throw new Error('Folder not found');
    return rowToFolder(row);
  }

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

  async moveRequest(requestId: number, folderId: number | null, index: number): Promise<void> {
    const pool = this.getPool();
    const requestResult = await pool.query('SELECT * FROM requests WHERE id = $1', [requestId]);
    const requestRow = requestResult.rows[0];
    if (!requestRow) throw new Error('Request not found');

    const request = rowToRequest(requestRow);
    const collectionId = request.collection_id;
    const oldFolderId = request.folder_id;

    if (folderId != null) {
      const folderResult = await pool.query('SELECT collection_id FROM folders WHERE id = $1', [
        folderId
      ]);
      const folderRow = folderResult.rows[0];
      if (!folderRow || folderRow.collection_id !== collectionId) {
        throw new Error('Folder not found');
      }
    }

    const listInContainer = async (targetFolderId: number | null): Promise<number[]> => {
      const result = await pool.query(
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
        await pool.query('UPDATE requests SET sort_order = $1, folder_id = $2 WHERE id = $3', [
          sortIndex,
          targetFolderId,
          orderedIds[sortIndex]
        ]);
      }
    };

    if (oldFolderId === folderId) {
      const siblings = (await listInContainer(folderId)).filter((id) => id !== requestId);
      siblings.splice(index, 0, requestId);
      await reindexContainer(folderId, siblings);
      return;
    }

    const oldIds = (await listInContainer(oldFolderId)).filter((id) => id !== requestId);
    await reindexContainer(oldFolderId, oldIds);

    const newIds = (await listInContainer(folderId)).filter((id) => id !== requestId);
    newIds.splice(index, 0, requestId);
    await reindexContainer(folderId, newIds);
  }

  async exportCollectionData(id: number): Promise<CollectionExport> {
    const result = await this.getPool().query(
      'SELECT name, variables, headers, pre_request_script, post_request_script FROM collections WHERE id = $1',
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

    const variables = parseJson<Partial<Variable>[]>(row.variables as string, []).map(
      normalizeVariable
    );
    const headers = parseJson<KeyValue[]>(row.headers as string, []);

    return {
      formatVersion: 2,
      name: row.name as string,
      variables: maskVariablesForExport(variables),
      headers,
      pre_request_script: (row.pre_request_script as string) ?? '',
      post_request_script: (row.post_request_script as string) ?? '',
      folders,
      requests
    };
  }

  async importCollectionData(data: unknown): Promise<Collection> {
    const exportData = validateCollectionExport(data);
    const now = new Date().toISOString();
    const client = await this.getPool().connect();

    try {
      await client.query('BEGIN');

      const collectionResult = await client.query(
        `INSERT INTO collections (name, variables, headers, pre_request_script, post_request_script, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, variables, headers, pre_request_script, post_request_script, created_at`,
        [
          exportData.name,
          JSON.stringify(exportData.variables),
          JSON.stringify(exportData.headers),
          exportData.pre_request_script,
          exportData.post_request_script,
          now
        ]
      );

      const collectionId = collectionResult.rows[0]?.id as number;
      const folderIdByName = new Map<string, number>();

      for (const folder of exportData.folders ?? []) {
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
            collection_id, folder_id, name, method, url, headers, params, body, body_type,
            pre_request_script, post_request_script, comment, sort_order, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
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

  async getSetting(key: string): Promise<string | undefined> {
    const result = await this.getPool().query('SELECT value FROM settings WHERE "key" = $1', [key]);
    const row = result.rows[0];
    return row ? (row.value as string) : undefined;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.getPool().query(
      'INSERT INTO settings ("key", value) VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET value = EXCLUDED.value',
      [key, value]
    );
  }

  async close(): Promise<void> {
    if (this.#pool) {
      await this.#pool.end();
      this.#pool = null;
    }
  }
}
