import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { join } from 'path';
import { rowToEnvironment } from '#/main/db/entityMappers';
import { trimRequiredName } from '#/main/db/trimRequiredName';
import type { Environment, Variable } from '#/shared/types';

const REGISTRY_DB_FILENAME = 'harborclient-registry.db';

/**
 * A single entry in the local collection registry.
 *
 * The registry is the authoritative list of collections. It stores only the
 * display name and a mapping to the database connection (provider) that holds
 * the collection's actual data and requests.
 */
export interface CollectionRegistryEntry {
  /**
   * Stable global collection id exposed to the renderer.
   */
  id: number;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * Id of the database connection that stores this collection's data.
   */
  connectionId: string;

  /**
   * Id of the collection within the provider's own store.
   */
  providerCollectionId: number;

  /**
   * ISO 8601 timestamp when the registry entry was created.
   */
  created_at: string;
}

/**
 * Input for creating a registry entry. An explicit id is used during migration
 * to preserve existing collection ids.
 */
export interface AddRegistryEntryInput {
  id?: number;
  name: string;
  connectionId: string;
  providerCollectionId: number;
}

/**
 * Mutable fields of a registry entry.
 */
export type UpdateRegistryEntryInput = Partial<
  Pick<CollectionRegistryEntry, 'name' | 'connectionId' | 'providerCollectionId'>
>;

/**
 * Maps a raw SQLite row to a collection registry entry.
 */
function rowToRegistryEntry(row: Record<string, unknown>): CollectionRegistryEntry {
  return {
    id: row.id as number,
    name: row.name as string,
    connectionId: row.connection_id as string,
    providerCollectionId: row.provider_collection_id as number,
    created_at: row.created_at as string
  };
}

/**
 * Hidden local SQLite store for collection metadata, environments, and app settings.
 *
 * Not exposed as a user-facing database connection.
 */
export class LocalRegistry {
  #db: Database.Database | null = null;
  readonly #userDataPath: string;

  /**
   * @param userDataPath - Electron app userData path where the registry file is stored.
   */
  constructor(userDataPath: string) {
    this.#userDataPath = userDataPath;
  }

  /**
   * Returns the active database handle.
   */
  private getDb(): Database.Database {
    if (!this.#db) throw new Error('Local registry not initialized');
    return this.#db;
  }

  /**
   * Opens the registry SQLite database and ensures schema exists.
   */
  async init(): Promise<void> {
    if (this.#db) return;

    const dbPath = join(this.#userDataPath, REGISTRY_DB_FILENAME);
    this.#db = new Database(dbPath);
    this.#db.pragma('journal_mode = WAL');
    this.#db.pragma('foreign_keys = ON');

    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS collection_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        connection_id TEXT NOT NULL,
        provider_collection_id INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS environments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        variables TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    this.migrateRegistrySortOrder();
  }

  /**
   * Adds sort_order to legacy registry databases and backfills from name order.
   */
  private migrateRegistrySortOrder(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(collection_registry)').all() as Array<{
      name: string;
    }>;
    const hasSortOrder = columns.some((col) => col.name === 'sort_order');
    if (hasSortOrder) return;

    this.getDb().exec(
      'ALTER TABLE collection_registry ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0'
    );

    const rows = this.getDb()
      .prepare('SELECT id FROM collection_registry ORDER BY name ASC, id ASC')
      .all() as Array<{ id: number }>;
    const update = this.getDb().prepare(
      'UPDATE collection_registry SET sort_order = ? WHERE id = ?'
    );
    const backfill = this.getDb().transaction((entries: Array<{ id: number }>) => {
      entries.forEach((entry, index) => {
        update.run(index, entry.id);
      });
    });
    backfill(rows);
  }

  /**
   * Returns the next sort_order value for a new registry entry.
   */
  private nextRegistrySortOrder(): number {
    const row = this.getDb()
      .prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM collection_registry')
      .get() as { max_order: number };
    return row.max_order + 1;
  }

  /**
   * Closes the registry database connection.
   */
  async close(): Promise<void> {
    if (this.#db) {
      this.#db.close();
      this.#db = null;
    }
  }

  /**
   * Lists all collection registry entries ordered for sidebar display.
   *
   * @returns Registry entries with connection routing metadata.
   */
  listRegistry(): CollectionRegistryEntry[] {
    const rows = this.getDb()
      .prepare(
        'SELECT id, name, connection_id, provider_collection_id, created_at FROM collection_registry ORDER BY sort_order ASC, name ASC'
      )
      .all() as Record<string, unknown>[];

    return rows.map(rowToRegistryEntry);
  }

  /**
   * Persists a new sidebar order for registry entries.
   *
   * @param orderedIds - Global collection ids in desired order.
   */
  reorderRegistry(orderedIds: number[]): void {
    const reorder = this.getDb().transaction((ids: number[]) => {
      const stmt = this.getDb().prepare(
        'UPDATE collection_registry SET sort_order = ? WHERE id = ?'
      );
      ids.forEach((id, index) => {
        stmt.run(index, id);
      });
    });
    reorder(orderedIds);
  }

  /**
   * Looks up a single registry entry by global collection id.
   *
   * @param id - Global collection id.
   * @returns The entry when found, otherwise undefined.
   */
  getRegistryEntry(id: number): CollectionRegistryEntry | undefined {
    const row = this.getDb()
      .prepare(
        'SELECT id, name, connection_id, provider_collection_id, created_at FROM collection_registry WHERE id = ?'
      )
      .get(id) as Record<string, unknown> | undefined;

    return row ? rowToRegistryEntry(row) : undefined;
  }

  /**
   * Registers a new collection in the local routing registry.
   *
   * @param input - Registry entry fields including optional explicit id.
   * @returns The persisted registry entry.
   */
  addRegistryEntry(input: AddRegistryEntryInput): CollectionRegistryEntry {
    const sortOrder = this.nextRegistrySortOrder();

    if (input.id != null) {
      this.getDb()
        .prepare(
          'INSERT INTO collection_registry (id, name, connection_id, provider_collection_id, sort_order) VALUES (?, ?, ?, ?, ?)'
        )
        .run(
          input.id,
          input.name.trim(),
          input.connectionId,
          input.providerCollectionId,
          sortOrder
        );
      const entry = this.getRegistryEntry(input.id);
      if (!entry) throw new Error('Registry entry not found after insert');
      return entry;
    }

    const result = this.getDb()
      .prepare(
        'INSERT INTO collection_registry (name, connection_id, provider_collection_id, sort_order) VALUES (?, ?, ?, ?)'
      )
      .run(input.name.trim(), input.connectionId, input.providerCollectionId, sortOrder);

    const entry = this.getRegistryEntry(Number(result.lastInsertRowid));
    if (!entry) throw new Error('Registry entry not found after insert');
    return entry;
  }

  /**
   * Updates registry metadata for an existing collection entry.
   *
   * @param id - Global collection id.
   * @param fields - Partial fields to merge into the entry.
   * @returns The updated registry entry.
   */
  updateRegistryEntry(id: number, fields: UpdateRegistryEntryInput): CollectionRegistryEntry {
    const current = this.getRegistryEntry(id);
    if (!current) throw new Error('Registry entry not found');

    const next: CollectionRegistryEntry = {
      ...current,
      ...fields
    };

    this.getDb()
      .prepare(
        'UPDATE collection_registry SET name = ?, connection_id = ?, provider_collection_id = ? WHERE id = ?'
      )
      .run(next.name.trim(), next.connectionId, next.providerCollectionId, id);

    const updated = this.getRegistryEntry(id);
    if (!updated) throw new Error('Registry entry not found after update');
    return updated;
  }

  /**
   * Removes a collection from the local routing registry.
   *
   * @param id - Global collection id to delete.
   */
  deleteRegistryEntry(id: number): void {
    this.getDb().prepare('DELETE FROM collection_registry WHERE id = ?').run(id);
  }

  /**
   * Lists all environments ordered by name.
   *
   * @returns All environments in the database.
   */
  listEnvironments(): Environment[] {
    const rows = this.getDb()
      .prepare('SELECT id, name, variables, created_at FROM environments ORDER BY name ASC')
      .all() as Record<string, unknown>[];

    return rows.map(rowToEnvironment);
  }

  /**
   * Creates a new environment with the given name.
   *
   * @param name - Display name for the environment.
   * @returns The newly created environment.
   */
  createEnvironment(name: string): Environment {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const result = this.getDb()
      .prepare('INSERT INTO environments (name) VALUES (?)')
      .run(trimmedName);

    const row = this.getDb()
      .prepare('SELECT id, name, variables, created_at FROM environments WHERE id = ?')
      .get(result.lastInsertRowid) as Record<string, unknown>;

    return rowToEnvironment(row);
  }

  /**
   * Inserts an environment with an explicit id (used during migration).
   */
  seedEnvironment(environment: Environment): Environment {
    this.getDb()
      .prepare('INSERT INTO environments (id, name, variables, created_at) VALUES (?, ?, ?, ?)')
      .run(
        environment.id,
        environment.name.trim(),
        JSON.stringify(environment.variables),
        environment.created_at
      );

    const row = this.getDb()
      .prepare('SELECT id, name, variables, created_at FROM environments WHERE id = ?')
      .get(environment.id) as Record<string, unknown>;

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
  updateEnvironment(id: number, name: string, variables: Variable[]): Environment {
    const trimmedName = trimRequiredName(name, 'Environment name');
    this.getDb()
      .prepare('UPDATE environments SET name = ?, variables = ? WHERE id = ?')
      .run(trimmedName, JSON.stringify(variables), id);

    const row = this.getDb()
      .prepare('SELECT id, name, variables, created_at FROM environments WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!row) throw new Error('Environment not found');
    return rowToEnvironment(row);
  }

  /**
   * Deletes an environment.
   *
   * @param id - Environment ID to delete.
   */
  deleteEnvironment(id: number): void {
    this.getDb().prepare('DELETE FROM environments WHERE id = ?').run(id);
  }

  /**
   * Reads a persisted setting by key.
   *
   * @param key - Setting key to look up.
   * @returns The stored value, or undefined when not set.
   */
  getSetting(key: string): string | undefined {
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
  setSetting(key: string, value: string): void {
    this.getDb()
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
      )
      .run(key, value, value);
  }

  /**
   * Copies registry rows from a legacy provider SQLite file when present.
   *
   * @param legacyDbPath - Path to harborclient.db that may contain collection_registry.
   * @returns Number of entries migrated.
   */
  migrateFromLegacyProviderDb(legacyDbPath: string): number {
    if (!existsSync(legacyDbPath)) return 0;

    const legacy = new Database(legacyDbPath, { readonly: true });
    try {
      const table = legacy
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'collection_registry'"
        )
        .get() as { name: string } | undefined;
      if (!table) return 0;

      const rows = legacy
        .prepare(
          'SELECT id, name, connection_id, provider_collection_id, created_at FROM collection_registry ORDER BY id ASC'
        )
        .all() as Record<string, unknown>[];

      for (const row of rows) {
        this.addRegistryEntry({
          id: row.id as number,
          name: row.name as string,
          connectionId: row.connection_id as string,
          providerCollectionId: row.provider_collection_id as number
        });
      }

      return rows.length;
    } finally {
      legacy.close();
    }
  }
}
