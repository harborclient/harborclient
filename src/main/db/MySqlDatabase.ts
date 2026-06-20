import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
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
  MySqlSettings,
  SaveRequestInput,
  SavedRequest,
  Variable
} from '#/shared/types';
import { parseJson } from '#/shared/parseJson';

export class MySqlDatabase implements IDatabase {
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
        params LONGTEXT NOT NULL,
        body LONGTEXT NOT NULL,
        body_type VARCHAR(32) NOT NULL DEFAULT 'none',
        pre_request_script LONGTEXT NOT NULL,
        post_request_script LONGTEXT NOT NULL,
        comment LONGTEXT NOT NULL DEFAULT '',
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
        created_at VARCHAR(64) NOT NULL
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
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS comment LONGTEXT NOT NULL DEFAULT ''
    `);

    await this.#pool.execute(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS folder_id INT NULL
    `);
  }

  async listCollections(): Promise<Collection[]> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT id, name, variables, headers, pre_request_script, post_request_script, created_at FROM collections ORDER BY name ASC'
    );
    return rows.map(rowToCollection);
  }

  async createCollection(name: string): Promise<Collection> {
    const createdAt = new Date().toISOString();
    const [result] = await this.getPool().execute<ResultSetHeader>(
      `INSERT INTO collections (name, variables, headers, pre_request_script, post_request_script, created_at)
       VALUES (?, '[]', '[]', '', '', ?)`,
      [name.trim(), createdAt]
    );

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT id, name, variables, headers, pre_request_script, post_request_script, created_at FROM collections WHERE id = ?',
      [result.insertId]
    );

    const row = rows[0];
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
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'UPDATE collections SET name = ?, variables = ?, headers = ?, pre_request_script = ?, post_request_script = ? WHERE id = ?',
      [
        name.trim(),
        JSON.stringify(variables),
        JSON.stringify(headers),
        preRequestScript,
        postRequestScript,
        id
      ]
    );

    if (result.affectedRows === 0) throw new Error('Collection not found');

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT id, name, variables, headers, pre_request_script, post_request_script, created_at FROM collections WHERE id = ?',
      [id]
    );

    const row = rows[0];
    if (!row) throw new Error('Collection not found');
    return rowToCollection(row);
  }

  async deleteCollection(id: number): Promise<void> {
    await this.getPool().execute('DELETE FROM collections WHERE id = ?', [id]);
  }

  async listEnvironments(): Promise<Environment[]> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT id, name, variables, created_at FROM environments ORDER BY name ASC'
    );
    return rows.map(rowToEnvironment);
  }

  async createEnvironment(name: string): Promise<Environment> {
    const createdAt = new Date().toISOString();
    const [result] = await this.getPool().execute<ResultSetHeader>(
      `INSERT INTO environments (name, variables, created_at) VALUES (?, '[]', ?)`,
      [name.trim(), createdAt]
    );

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT id, name, variables, created_at FROM environments WHERE id = ?',
      [result.insertId]
    );

    const row = rows[0];
    if (!row) throw new Error('Environment not found after insert');
    return rowToEnvironment(row);
  }

  async updateEnvironment(id: number, name: string, variables: Variable[]): Promise<Environment> {
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'UPDATE environments SET name = ?, variables = ? WHERE id = ?',
      [name.trim(), JSON.stringify(variables), id]
    );

    if (result.affectedRows === 0) throw new Error('Environment not found');

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT id, name, variables, created_at FROM environments WHERE id = ?',
      [id]
    );

    const row = rows[0];
    if (!row) throw new Error('Environment not found');
    return rowToEnvironment(row);
  }

  async deleteEnvironment(id: number): Promise<void> {
    await this.getPool().execute('DELETE FROM environments WHERE id = ?', [id]);
  }

  async listRequests(collectionId: number): Promise<SavedRequest[]> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM requests WHERE collection_id = ? ORDER BY sort_order ASC, name ASC',
      [collectionId]
    );
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
      const [result] = await this.getPool().execute<ResultSetHeader>(
        `UPDATE requests SET
          collection_id = ?, folder_id = ?, name = ?, method = ?, url = ?,
          headers = ?, params = ?, body = ?, body_type = ?,
          pre_request_script = ?, post_request_script = ?, comment = ?,
          updated_at = ?
        WHERE id = ?`,
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

      if (result.affectedRows > 0) {
        const [rows] = await this.getPool().execute<RowDataPacket[]>(
          'SELECT * FROM requests WHERE id = ?',
          [input.id]
        );
        const row = rows[0];
        if (row) return rowToRequest(row);
      }
    }

    const [maxRows] = await this.getPool().execute<RowDataPacket[]>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM requests
       WHERE collection_id = ? AND ((? IS NULL AND folder_id IS NULL) OR folder_id = ?)`,
      [input.collection_id, folderId, folderId]
    );
    const maxOrder = (maxRows[0]?.max_order as number) ?? -1;

    const [result] = await this.getPool().execute<ResultSetHeader>(
      `INSERT INTO requests (
        collection_id, folder_id, name, method, url, headers, params, body, body_type,
        pre_request_script, post_request_script, comment, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM requests WHERE id = ?',
      [result.insertId]
    );

    const row = rows[0];
    if (!row) throw new Error('Request not found after insert');
    return rowToRequest(row);
  }

  async deleteRequest(id: number): Promise<void> {
    await this.getPool().execute('DELETE FROM requests WHERE id = ?', [id]);
  }

  async listFolders(collectionId: number): Promise<Folder[]> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM folders WHERE collection_id = ? ORDER BY sort_order ASC, name ASC',
      [collectionId]
    );
    return rows.map(rowToFolder);
  }

  async createFolder(collectionId: number, name: string): Promise<Folder> {
    const createdAt = new Date().toISOString();
    const [maxRows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM folders WHERE collection_id = ?',
      [collectionId]
    );
    const maxOrder = (maxRows[0]?.max_order as number) ?? -1;

    const [result] = await this.getPool().execute<ResultSetHeader>(
      'INSERT INTO folders (collection_id, name, sort_order, created_at) VALUES (?, ?, ?, ?)',
      [collectionId, name.trim(), maxOrder + 1, createdAt]
    );

    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM folders WHERE id = ?',
      [result.insertId]
    );
    const row = rows[0];
    if (!row) throw new Error('Folder not found after insert');
    return rowToFolder(row);
  }

  async renameFolder(id: number, name: string): Promise<Folder> {
    const [result] = await this.getPool().execute<ResultSetHeader>(
      'UPDATE folders SET name = ? WHERE id = ?',
      [name.trim(), id]
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

  async deleteFolder(id: number): Promise<void> {
    const connection = await this.getPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('DELETE FROM requests WHERE folder_id = ?', [id]);
      await connection.execute('DELETE FROM folders WHERE id = ?', [id]);
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async reorderFolders(collectionId: number, orderedFolderIds: number[]): Promise<void> {
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

  async moveRequest(requestId: number, folderId: number | null, index: number): Promise<void> {
    const pool = this.getPool();
    const [requestRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM requests WHERE id = ?',
      [requestId]
    );
    const requestRow = requestRows[0];
    if (!requestRow) throw new Error('Request not found');

    const request = rowToRequest(requestRow);
    const collectionId = request.collection_id;
    const oldFolderId = request.folder_id;

    if (folderId != null) {
      const [folderRows] = await pool.execute<RowDataPacket[]>(
        'SELECT collection_id FROM folders WHERE id = ?',
        [folderId]
      );
      const folderRow = folderRows[0];
      if (!folderRow || folderRow.collection_id !== collectionId) {
        throw new Error('Folder not found');
      }
    }

    const listInContainer = async (targetFolderId: number | null): Promise<number[]> => {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM requests WHERE collection_id = ?
         AND ((? IS NULL AND folder_id IS NULL) OR folder_id = ?)
         ORDER BY sort_order ASC, name ASC`,
        [collectionId, targetFolderId, targetFolderId]
      );
      return rows.map((row) => row.id as number);
    };

    const reindexContainer = async (
      targetFolderId: number | null,
      orderedIds: number[]
    ): Promise<void> => {
      for (let sortIndex = 0; sortIndex < orderedIds.length; sortIndex++) {
        await pool.execute('UPDATE requests SET sort_order = ?, folder_id = ? WHERE id = ?', [
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
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT name, variables, headers, pre_request_script, post_request_script FROM collections WHERE id = ?',
      [id]
    );

    const row = rows[0];
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
    const connection = await this.getPool().getConnection();

    try {
      await connection.beginTransaction();

      const [collectionResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO collections (name, variables, headers, pre_request_script, post_request_script, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          exportData.name,
          JSON.stringify(exportData.variables),
          JSON.stringify(exportData.headers),
          exportData.pre_request_script,
          exportData.post_request_script,
          now
        ]
      );

      const collectionId = collectionResult.insertId;
      const folderIdByName = new Map<string, number>();

      for (const folder of exportData.folders ?? []) {
        const [folderResult] = await connection.execute<ResultSetHeader>(
          'INSERT INTO folders (collection_id, name, sort_order, created_at) VALUES (?, ?, ?, ?)',
          [collectionId, folder.name, folder.sort_order, now]
        );
        folderIdByName.set(folder.name, folderResult.insertId);
      }

      for (const request of exportData.requests) {
        const folderName = request.folder_name ?? null;
        const folderId =
          folderName != null && folderName.trim() ? (folderIdByName.get(folderName) ?? null) : null;

        await connection.execute(
          `INSERT INTO requests (
            collection_id, folder_id, name, method, url, headers, params, body, body_type,
            pre_request_script, post_request_script, comment, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT id, name, variables, headers, pre_request_script, post_request_script, created_at FROM collections WHERE id = ?',
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

  async getSetting(key: string): Promise<string | undefined> {
    const [rows] = await this.getPool().execute<RowDataPacket[]>(
      'SELECT value FROM settings WHERE `key` = ?',
      [key]
    );
    const row = rows[0];
    return row ? (row.value as string) : undefined;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.getPool().execute(
      'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
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
