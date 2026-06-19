import Database from 'better-sqlite3'
import { join } from 'path'
import type {
  BodyType,
  Collection,
  CollectionExport,
  ExportedRequest,
  HttpMethod,
  KeyValue,
  SaveRequestInput,
  SavedRequest,
  Variable
} from '#/shared/types'

let db: Database.Database | null = null

/**
 * Parses a JSON string, returning a fallback value on failure.
 *
 * @param value - JSON string to parse.
 * @param fallback - Value returned when parsing fails.
 * @returns Parsed value or fallback.
 */
function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
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
    variables: parseJson<Variable[]>(row.variables as string, []),
    created_at: row.created_at as string
  }
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
    sort_order: row.sort_order as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }
}

/**
 * Opens (or returns) the SQLite database for the given user-data directory.
 *
 * @param userDataPath - Electron app userData path where harbor-client.db is stored.
 * @returns The initialized database handle.
 */
export function initDb(userDataPath: string): Database.Database {
  if (db) return db

  const dbPath = join(userDataPath, 'harbor-client.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      variables TEXT NOT NULL DEFAULT '[]',
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
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    );
  `)

  const columns = db
    .prepare("PRAGMA table_info(collections)")
    .all() as Array<{ name: string }>
  const hasVariables = columns.some((col) => col.name === 'variables')
  if (!hasVariables) {
    db.exec("ALTER TABLE collections ADD COLUMN variables TEXT NOT NULL DEFAULT '[]'")
  }

  return db
}

/**
 * Returns the active database handle.
 *
 * @returns The initialized database handle.
 * @throws When initDb has not been called yet.
 */
export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

/**
 * Lists all collections ordered by name.
 *
 * @returns All collections in the database.
 */
export function listCollections(): Collection[] {
  const rows = getDb()
    .prepare('SELECT id, name, variables, created_at FROM collections ORDER BY name ASC')
    .all() as Record<string, unknown>[]

  return rows.map(rowToCollection)
}

/**
 * Creates a new collection with the given name.
 *
 * @param name - Display name for the collection.
 * @returns The newly created collection.
 */
export function createCollection(name: string): Collection {
  const result = getDb()
    .prepare('INSERT INTO collections (name) VALUES (?)')
    .run(name.trim())

  const row = getDb()
    .prepare('SELECT id, name, variables, created_at FROM collections WHERE id = ?')
    .get(result.lastInsertRowid) as Record<string, unknown>

  return rowToCollection(row)
}

/**
 * Updates a collection's name and variables.
 *
 * @param id - Collection ID to update.
 * @param name - New display name.
 * @param variables - Collection-scoped variables.
 * @returns The updated collection.
 * @throws When the collection does not exist.
 */
export function updateCollection(id: number, name: string, variables: Variable[]): Collection {
  getDb()
    .prepare('UPDATE collections SET name = ?, variables = ? WHERE id = ?')
    .run(name.trim(), JSON.stringify(variables), id)

  const row = getDb()
    .prepare('SELECT id, name, variables, created_at FROM collections WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined

  if (!row) throw new Error('Collection not found')
  return rowToCollection(row)
}

/**
 * Deletes a collection and all of its requests (via CASCADE).
 *
 * @param id - Collection ID to delete.
 */
export function deleteCollection(id: number): void {
  getDb().prepare('DELETE FROM collections WHERE id = ?').run(id)
}

/**
 * Lists all saved requests in a collection.
 *
 * @param collectionId - Collection to query.
 * @returns Requests ordered by sort_order then name.
 */
export function listRequests(collectionId: number): SavedRequest[] {
  const rows = getDb()
    .prepare(
      'SELECT * FROM requests WHERE collection_id = ? ORDER BY sort_order ASC, name ASC'
    )
    .all(collectionId) as Record<string, unknown>[]

  return rows.map(rowToRequest)
}

/**
 * Inserts a new request or updates an existing one.
 *
 * @param input - Request fields to persist.
 * @returns The saved request with ID and timestamps.
 * @throws When the request is not found after insert or update.
 */
export function saveRequest(input: SaveRequestInput): SavedRequest {
  const headers = JSON.stringify(input.headers)
  const params = JSON.stringify(input.params)
  const now = new Date().toISOString()

  if (input.id) {
    getDb()
      .prepare(
        `UPDATE requests SET
          collection_id = ?, name = ?, method = ?, url = ?,
          headers = ?, params = ?, body = ?, body_type = ?,
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
        now,
        input.id
      )

    const row = getDb().prepare('SELECT * FROM requests WHERE id = ?').get(input.id)
    if (!row) throw new Error('Request not found after update')
    return rowToRequest(row as Record<string, unknown>)
  }

  const maxOrder = getDb()
    .prepare('SELECT COALESCE(MAX(sort_order), -1) as max_order FROM requests WHERE collection_id = ?')
    .get(input.collection_id) as { max_order: number }

  const result = getDb()
    .prepare(
      `INSERT INTO requests (
        collection_id, name, method, url, headers, params, body, body_type, sort_order, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      maxOrder.max_order + 1,
      now
    )

  const row = getDb()
    .prepare('SELECT * FROM requests WHERE id = ?')
    .get(result.lastInsertRowid)

  if (!row) throw new Error('Request not found after insert')
  return rowToRequest(row as Record<string, unknown>)
}

/**
 * Deletes a saved request by ID.
 *
 * @param id - Request ID to delete.
 */
export function deleteRequest(id: number): void {
  getDb().prepare('DELETE FROM requests WHERE id = ?').run(id)
}

const HTTP_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
])

const BODY_TYPES = new Set<BodyType>(['none', 'json', 'text'])

/**
 * Validates and normalizes imported collection export data.
 *
 * @param data - Parsed JSON payload from an export file.
 * @returns Normalized collection export.
 * @throws When the payload is invalid.
 */
function validateCollectionExport(data: unknown): CollectionExport {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid collection file: expected a JSON object')
  }

  const record = data as Record<string, unknown>
  const formatVersion = record.formatVersion
  if (formatVersion !== 1) {
    throw new Error('Invalid collection file: unsupported format version')
  }

  const name = typeof record.name === 'string' ? record.name.trim() : ''
  if (!name) {
    throw new Error('Invalid collection file: collection name is required')
  }

  if (!Array.isArray(record.requests)) {
    throw new Error('Invalid collection file: requests must be an array')
  }

  const variables = Array.isArray(record.variables)
    ? (record.variables as Variable[]).filter(
        (v) => v && typeof v.key === 'string' && typeof v.value === 'string'
      )
    : []

  const requests = record.requests.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid collection file: request ${index + 1} is malformed`)
    }

    const req = item as Record<string, unknown>
    const method = req.method
    if (typeof method !== 'string' || !HTTP_METHODS.has(method as HttpMethod)) {
      throw new Error(`Invalid collection file: request ${index + 1} has an invalid method`)
    }

    const bodyType = req.body_type
    if (typeof bodyType !== 'string' || !BODY_TYPES.has(bodyType as BodyType)) {
      throw new Error(`Invalid collection file: request ${index + 1} has an invalid body type`)
    }

    const requestName = typeof req.name === 'string' ? req.name.trim() : ''
    if (!requestName) {
      throw new Error(`Invalid collection file: request ${index + 1} is missing a name`)
    }

    return {
      name: requestName,
      method: method as HttpMethod,
      url: typeof req.url === 'string' ? req.url : '',
      headers: Array.isArray(req.headers) ? (req.headers as KeyValue[]) : [],
      params: Array.isArray(req.params) ? (req.params as KeyValue[]) : [],
      body: typeof req.body === 'string' ? req.body : '',
      body_type: bodyType as BodyType,
      sort_order: typeof req.sort_order === 'number' ? req.sort_order : index
    } satisfies ExportedRequest
  })

  return {
    formatVersion: 1,
    name,
    variables,
    requests
  }
}

/**
 * Builds a portable export payload for a collection and its requests.
 *
 * @param id - Collection ID to export.
 * @returns Collection export data without database IDs.
 * @throws When the collection does not exist.
 */
export function exportCollectionData(id: number): CollectionExport {
  const row = getDb()
    .prepare('SELECT name, variables FROM collections WHERE id = ?')
    .get(id) as { name: string; variables: string } | undefined

  if (!row) throw new Error('Collection not found')

  const requests = listRequests(id).map(
    ({ name, method, url, headers, params, body, body_type, sort_order }) => ({
      name,
      method,
      url,
      headers,
      params,
      body,
      body_type,
      sort_order
    })
  )

  return {
    formatVersion: 1,
    name: row.name,
    variables: parseJson<Variable[]>(row.variables, []),
    requests
  }
}

/**
 * Imports a collection and its requests from export data.
 *
 * @param data - Parsed collection export payload.
 * @returns The newly created collection.
 * @throws When the payload is invalid.
 */
export function importCollectionData(data: unknown): Collection {
  const exportData = validateCollectionExport(data)
  const database = getDb()
  const now = new Date().toISOString()

  const importCollection = database.transaction((payload: CollectionExport) => {
    const collectionResult = database
      .prepare('INSERT INTO collections (name, variables) VALUES (?, ?)')
      .run(payload.name, JSON.stringify(payload.variables))

    const collectionId = Number(collectionResult.lastInsertRowid)
    const insertRequest = database.prepare(
      `INSERT INTO requests (
        collection_id, name, method, url, headers, params, body, body_type, sort_order, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

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
        request.sort_order,
        now
      )
    }

    const row = database
      .prepare('SELECT id, name, variables, created_at FROM collections WHERE id = ?')
      .get(collectionId) as Record<string, unknown>

    return rowToCollection(row)
  })

  return importCollection(exportData)
}

/**
 * Closes the database connection and clears the module-level handle.
 */
export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
