import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  rowToChat,
  rowToChatMessage,
  rowToChatSummary,
  rowToEnvironment,
  rowToSnippet
} from '#/main/storage/entityMappers';
import { trimRequiredName } from '#/main/storage/trimRequiredName';
import { generateDocumentUuid } from '#/main/storage/uuid';
import { DEFAULT_CHAT_TITLE, normalizeChatTitle } from '#/shared/ai/chatTitle';
import type {
  Chat,
  ChatMessage,
  ChatRole,
  ChatSummary,
  Environment,
  Snippet,
  Variable
} from '#/shared/types';
import type { SnippetScope } from '#/shared/snippetScope';
import { DEFAULT_SCRIPT_STAGE, normalizeScriptStage } from '#/shared/scriptStage';
import type { ScriptStage } from '@harborclient/sdk';

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
   * Portable collection uuid mirrored from the provider for import deduplication.
   */
  collectionUuid: string;

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
  collectionUuid?: string;
}

/**
 * Mutable fields of a registry entry.
 */
export type UpdateRegistryEntryInput = Partial<
  Pick<CollectionRegistryEntry, 'name' | 'connectionId' | 'providerCollectionId' | 'collectionUuid'>
>;

/**
 * A single entry in the local snippet registry.
 */
export interface SnippetRegistryEntry {
  /**
   * Stable global snippet id exposed to the renderer.
   */
  id: number;

  /**
   * Display name shown in snippet lists.
   */
  name: string;

  /**
   * Portable snippet uuid mirrored from the provider for script references.
   */
  uuid: string;

  /**
   * Id of the storage connection that stores this snippet's data.
   */
  connectionId: string;

  /**
   * Id of the snippet within the provider's own store.
   */
  providerSnippetId: number;

  /**
   * Script phases where this snippet may be referenced.
   */
  scope: SnippetScope;

  /**
   * ISO 8601 timestamp when the registry entry was created.
   */
  created_at: string;
}

/**
 * Input for creating a snippet registry entry.
 */
export interface AddSnippetRegistryEntryInput {
  id?: number;
  name: string;
  connectionId: string;
  providerSnippetId: number;
  uuid?: string;
  scope?: SnippetScope;
}

/**
 * Mutable fields of a snippet registry entry.
 */
export type UpdateSnippetRegistryEntryInput = Partial<
  Pick<SnippetRegistryEntry, 'name' | 'connectionId' | 'providerSnippetId' | 'uuid' | 'scope'>
>;

/**
 * Maps a raw SQLite row to a snippet registry entry.
 */
function rowToSnippetRegistryEntry(row: Record<string, unknown>): SnippetRegistryEntry {
  return {
    id: row.id as number,
    name: row.name as string,
    uuid: (row.uuid as string) ?? '',
    connectionId: row.connection_id as string,
    providerSnippetId: row.provider_snippet_id as number,
    scope: (row.scope as SnippetScope) ?? 'any',
    created_at: row.created_at as string
  };
}

/**
 * Maps a raw SQLite row to a collection registry entry.
 */
function rowToRegistryEntry(row: Record<string, unknown>): CollectionRegistryEntry {
  return {
    id: row.id as number,
    name: row.name as string,
    collectionUuid: (row.collection_uuid as string) ?? '',
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
export class LocalDatabase {
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
    if (!this.#db) {
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
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        model TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        model TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS plugin_storage (
        plugin_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (plugin_id, key)
      );

      CREATE TABLE IF NOT EXISTS plugin_fs_grants (
        plugin_id TEXT NOT NULL,
        path TEXT NOT NULL,
        PRIMARY KEY (plugin_id, path)
      );

      CREATE TABLE IF NOT EXISTS snippets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        scope TEXT NOT NULL DEFAULT 'any',
        stage TEXT NOT NULL DEFAULT 'main',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS snippet_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        uuid TEXT NOT NULL DEFAULT '',
        connection_id TEXT NOT NULL,
        provider_snippet_id INTEGER NOT NULL,
        scope TEXT NOT NULL DEFAULT 'any',
        stage TEXT NOT NULL DEFAULT 'main',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    }

    this.migratePluginTables();
    this.migrateRegistrySortOrder();
    this.migrateRegistryCollectionUuid();
    this.migrateEnvironmentUuid();
    this.migrateEnvironmentSortOrder();
    this.migrateSnippetUuid();
    this.migrateSnippetScope();
    this.migrateSnippetStage();
    this.migrateChatMessageRole();
    this.migrateSnippetMarketplaceFields();
    this.migrateSnippetRegistryTable();
  }

  /**
   * Ensures the snippet registry table exists on legacy databases.
   */
  private migrateSnippetRegistryTable(): void {
    this.getDb().exec(`
      CREATE TABLE IF NOT EXISTS snippet_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        uuid TEXT NOT NULL DEFAULT '',
        connection_id TEXT NOT NULL,
        provider_snippet_id INTEGER NOT NULL,
        scope TEXT NOT NULL DEFAULT 'any',
        stage TEXT NOT NULL DEFAULT 'main',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  /**
   * Ensures plugin storage and filesystem grant tables exist on legacy databases.
   */
  private migratePluginTables(): void {
    this.getDb().exec(`
      CREATE TABLE IF NOT EXISTS plugin_storage (
        plugin_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (plugin_id, key)
      );

      CREATE TABLE IF NOT EXISTS plugin_fs_grants (
        plugin_id TEXT NOT NULL,
        path TEXT NOT NULL,
        PRIMARY KEY (plugin_id, path)
      );
    `);
  }

  /**
   * Adds collection_uuid to legacy registry databases when missing.
   */
  private migrateRegistryCollectionUuid(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(collection_registry)').all() as Array<{
      name: string;
    }>;
    if (columns.some((col) => col.name === 'collection_uuid')) {
      return;
    }
    this.getDb().exec(
      "ALTER TABLE collection_registry ADD COLUMN collection_uuid TEXT NOT NULL DEFAULT ''"
    );
  }

  /**
   * Adds uuid to legacy snippet rows when missing.
   */
  private migrateSnippetUuid(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(snippets)').all() as Array<{
      name: string;
    }>;
    if (columns.length === 0) {
      return;
    }
    if (columns.some((col) => col.name === 'uuid')) {
      this.backfillSnippetUuids();
      return;
    }
    this.getDb().exec("ALTER TABLE snippets ADD COLUMN uuid TEXT NOT NULL DEFAULT ''");
    this.backfillSnippetUuids();
  }

  /**
   * Assigns uuids to snippets created before uuid support existed.
   */
  private backfillSnippetUuids(): void {
    const database = this.getDb();
    const rows = database
      .prepare("SELECT id FROM snippets WHERE uuid IS NULL OR uuid = ''")
      .all() as Array<{ id: number }>;
    if (rows.length === 0) {
      return;
    }

    const update = database.prepare('UPDATE snippets SET uuid = ? WHERE id = ?');
    const backfill = database.transaction((items: Array<{ id: number }>) => {
      for (const row of items) {
        update.run(generateDocumentUuid(), row.id);
      }
    });
    backfill(rows);
  }

  /**
   * Adds scope to legacy snippet rows when missing.
   */
  private migrateSnippetScope(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(snippets)').all() as Array<{
      name: string;
    }>;
    if (columns.length === 0) {
      return;
    }
    if (columns.some((col) => col.name === 'scope')) {
      return;
    }
    this.getDb().exec("ALTER TABLE snippets ADD COLUMN scope TEXT NOT NULL DEFAULT 'any'");
  }

  /**
   * Migrates legacy snippet `role` columns to `stage` when missing.
   */
  private migrateSnippetStage(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(snippets)').all() as Array<{
      name: string;
    }>;
    if (columns.length === 0) {
      return;
    }
    if (columns.some((col) => col.name === 'stage')) {
      this.getDb().exec("UPDATE snippets SET stage = 'main' WHERE stage = 'run'");
      return;
    }
    if (columns.some((col) => col.name === 'role')) {
      this.getDb().exec('ALTER TABLE snippets RENAME COLUMN role TO stage');
      this.getDb().exec("UPDATE snippets SET stage = 'main' WHERE stage = 'run'");
      return;
    }
    this.getDb().exec("ALTER TABLE snippets ADD COLUMN stage TEXT NOT NULL DEFAULT 'main'");
  }

  /**
   * Restores the chat message author column when a rename pass used `stage` by mistake.
   */
  private migrateChatMessageRole(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(chat_messages)').all() as Array<{
      name: string;
    }>;
    if (columns.length === 0) {
      return;
    }
    if (columns.some((col) => col.name === 'role')) {
      return;
    }
    if (columns.some((col) => col.name === 'stage')) {
      this.getDb().exec('ALTER TABLE chat_messages RENAME COLUMN stage TO role');
    }
  }

  /**
   * Adds marketplace origin columns to legacy snippet rows when missing.
   */
  private migrateSnippetMarketplaceFields(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(snippets)').all() as Array<{
      name: string;
    }>;
    if (columns.length === 0) {
      return;
    }
    if (!columns.some((col) => col.name === 'source')) {
      this.getDb().exec("ALTER TABLE snippets ADD COLUMN source TEXT NOT NULL DEFAULT 'local'");
    }
    if (!columns.some((col) => col.name === 'catalog_id')) {
      this.getDb().exec('ALTER TABLE snippets ADD COLUMN catalog_id TEXT');
    }
    if (!columns.some((col) => col.name === 'catalog_version')) {
      this.getDb().exec('ALTER TABLE snippets ADD COLUMN catalog_version TEXT');
    }
    if (!columns.some((col) => col.name === 'catalog_author')) {
      this.getDb().exec('ALTER TABLE snippets ADD COLUMN catalog_author TEXT');
    }
  }

  /**
   * Returns the next sort order value for a new snippet.
   */
  private nextSnippetSortOrder(): number {
    const row = this.getDb()
      .prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM snippets')
      .get() as { max_order: number };
    return row.max_order + 1;
  }

  /**
   * Adds uuid to legacy environment rows when missing.
   */
  private migrateEnvironmentUuid(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(environments)').all() as Array<{
      name: string;
    }>;
    if (columns.some((col) => col.name === 'uuid')) {
      this.backfillEnvironmentUuids();
      return;
    }
    this.getDb().exec("ALTER TABLE environments ADD COLUMN uuid TEXT NOT NULL DEFAULT ''");
    this.backfillEnvironmentUuids();
  }

  /**
   * Assigns uuids to environments created before uuid support existed.
   */
  private backfillEnvironmentUuids(): void {
    const database = this.getDb();
    const rows = database
      .prepare("SELECT id FROM environments WHERE uuid IS NULL OR uuid = ''")
      .all() as Array<{ id: number }>;
    if (rows.length === 0) {
      return;
    }

    const update = database.prepare('UPDATE environments SET uuid = ? WHERE id = ?');
    const backfill = database.transaction((items: Array<{ id: number }>) => {
      for (const row of items) {
        update.run(generateDocumentUuid(), row.id);
      }
    });
    backfill(rows);
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
   * Adds sort_order to legacy environment rows and backfills from name order.
   */
  private migrateEnvironmentSortOrder(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(environments)').all() as Array<{
      name: string;
    }>;
    const hasSortOrder = columns.some((col) => col.name === 'sort_order');
    if (hasSortOrder) return;

    this.getDb().exec('ALTER TABLE environments ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');

    const rows = this.getDb()
      .prepare('SELECT id FROM environments ORDER BY name ASC, id ASC')
      .all() as Array<{ id: number }>;
    const update = this.getDb().prepare('UPDATE environments SET sort_order = ? WHERE id = ?');
    const backfill = this.getDb().transaction((entries: Array<{ id: number }>) => {
      entries.forEach((entry, index) => {
        update.run(index, entry.id);
      });
    });
    backfill(rows);
  }

  /**
   * Returns the next sort_order value for a new environment.
   */
  private nextEnvironmentSortOrder(): number {
    const row = this.getDb()
      .prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM environments')
      .get() as { max_order: number };
    return row.max_order + 1;
  }

  /**
   * Flushes WAL pages into the main database file for consistent backup snapshots.
   */
  checkpointWal(): void {
    if (this.#db) {
      this.#db.pragma('wal_checkpoint(TRUNCATE)');
    }
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
        'SELECT id, name, collection_uuid, connection_id, provider_collection_id, created_at FROM collection_registry ORDER BY sort_order ASC, name ASC'
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
        'SELECT id, name, collection_uuid, connection_id, provider_collection_id, created_at FROM collection_registry WHERE id = ?'
      )
      .get(id) as Record<string, unknown> | undefined;

    return row ? rowToRegistryEntry(row) : undefined;
  }

  findRegistryEntryByUuid(uuid: string): CollectionRegistryEntry | undefined {
    const trimmed = uuid.trim();
    if (!trimmed) {
      return undefined;
    }

    const row = this.getDb()
      .prepare(
        'SELECT id, name, collection_uuid, connection_id, provider_collection_id, created_at FROM collection_registry WHERE collection_uuid = ?'
      )
      .get(trimmed) as Record<string, unknown> | undefined;

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
    const collectionUuid = input.collectionUuid?.trim() ?? '';

    if (input.id != null) {
      this.getDb()
        .prepare(
          'INSERT INTO collection_registry (id, name, collection_uuid, connection_id, provider_collection_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(
          input.id,
          input.name.trim(),
          collectionUuid,
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
        'INSERT INTO collection_registry (name, collection_uuid, connection_id, provider_collection_id, sort_order) VALUES (?, ?, ?, ?, ?)'
      )
      .run(
        input.name.trim(),
        collectionUuid,
        input.connectionId,
        input.providerCollectionId,
        sortOrder
      );

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
        'UPDATE collection_registry SET name = ?, collection_uuid = ?, connection_id = ?, provider_collection_id = ? WHERE id = ?'
      )
      .run(next.name.trim(), next.collectionUuid, next.connectionId, next.providerCollectionId, id);

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
   * Lists all snippet registry entries ordered for settings display.
   *
   * @returns Registry entries with connection routing metadata.
   */
  listSnippetRegistry(): SnippetRegistryEntry[] {
    const rows = this.getDb()
      .prepare(
        'SELECT id, name, uuid, connection_id, provider_snippet_id, scope, created_at FROM snippet_registry ORDER BY sort_order ASC, name ASC'
      )
      .all() as Record<string, unknown>[];

    return rows.map(rowToSnippetRegistryEntry);
  }

  /**
   * Looks up a single snippet registry entry by global snippet id.
   *
   * @param id - Global snippet id.
   * @returns The entry when found, otherwise undefined.
   */
  getSnippetRegistryEntry(id: number): SnippetRegistryEntry | undefined {
    const row = this.getDb()
      .prepare(
        'SELECT id, name, uuid, connection_id, provider_snippet_id, scope, created_at FROM snippet_registry WHERE id = ?'
      )
      .get(id) as Record<string, unknown> | undefined;

    return row ? rowToSnippetRegistryEntry(row) : undefined;
  }

  /**
   * Registers a new snippet in the local routing registry.
   *
   * @param input - Registry entry fields including optional explicit id.
   * @returns The persisted registry entry.
   */
  addSnippetRegistryEntry(input: AddSnippetRegistryEntryInput): SnippetRegistryEntry {
    const sortOrder = this.nextSnippetRegistrySortOrder();
    const snippetUuid = input.uuid?.trim() ?? '';
    const scope = input.scope ?? 'any';

    if (input.id != null) {
      this.getDb()
        .prepare(
          'INSERT INTO snippet_registry (id, name, uuid, connection_id, provider_snippet_id, scope, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          input.id,
          input.name.trim(),
          snippetUuid,
          input.connectionId,
          input.providerSnippetId,
          scope,
          sortOrder
        );
      const entry = this.getSnippetRegistryEntry(input.id);
      if (!entry) throw new Error('Snippet registry entry not found after insert');
      return entry;
    }

    const result = this.getDb()
      .prepare(
        'INSERT INTO snippet_registry (name, uuid, connection_id, provider_snippet_id, scope, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        input.name.trim(),
        snippetUuid,
        input.connectionId,
        input.providerSnippetId,
        scope,
        sortOrder
      );

    const entry = this.getSnippetRegistryEntry(Number(result.lastInsertRowid));
    if (!entry) throw new Error('Snippet registry entry not found after insert');
    return entry;
  }

  /**
   * Updates snippet registry metadata for an existing entry.
   *
   * @param id - Global snippet id.
   * @param fields - Partial fields to merge into the entry.
   * @returns The updated registry entry.
   */
  updateSnippetRegistryEntry(
    id: number,
    fields: UpdateSnippetRegistryEntryInput
  ): SnippetRegistryEntry {
    const current = this.getSnippetRegistryEntry(id);
    if (!current) throw new Error('Snippet registry entry not found');

    const next: SnippetRegistryEntry = {
      ...current,
      ...fields
    };

    this.getDb()
      .prepare(
        'UPDATE snippet_registry SET name = ?, uuid = ?, connection_id = ?, provider_snippet_id = ?, scope = ? WHERE id = ?'
      )
      .run(next.name.trim(), next.uuid, next.connectionId, next.providerSnippetId, next.scope, id);

    const updated = this.getSnippetRegistryEntry(id);
    if (!updated) throw new Error('Snippet registry entry not found after update');
    return updated;
  }

  /**
   * Removes a snippet from the local routing registry.
   *
   * @param id - Global snippet id to delete.
   */
  deleteSnippetRegistryEntry(id: number): void {
    this.getDb().prepare('DELETE FROM snippet_registry WHERE id = ?').run(id);
  }

  /**
   * Returns the next sort order value for a new snippet registry entry.
   */
  private nextSnippetRegistrySortOrder(): number {
    const row = this.getDb()
      .prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM snippet_registry')
      .get() as { max_order: number };
    return row.max_order + 1;
  }

  /**
   * Lists all environments ordered for sidebar display.
   *
   * @returns All environments in the database.
   */
  listEnvironments(): Environment[] {
    const rows = this.getDb()
      .prepare(
        'SELECT id, uuid, name, variables, created_at FROM environments ORDER BY sort_order ASC, name ASC'
      )
      .all() as Record<string, unknown>[];

    return rows.map(rowToEnvironment);
  }

  /**
   * Persists a new sidebar order for environments.
   *
   * @param orderedIds - Environment ids in desired order.
   */
  reorderEnvironments(orderedIds: number[]): void {
    const reorder = this.getDb().transaction((ids: number[]) => {
      const stmt = this.getDb().prepare('UPDATE environments SET sort_order = ? WHERE id = ?');
      ids.forEach((id, index) => {
        stmt.run(index, id);
      });
    });
    reorder(orderedIds);
  }

  findEnvironmentByUuid(uuid: string): Environment | undefined {
    const trimmed = uuid.trim();
    if (!trimmed) {
      return undefined;
    }

    const row = this.getDb()
      .prepare('SELECT id, uuid, name, variables, created_at FROM environments WHERE uuid = ?')
      .get(trimmed) as Record<string, unknown> | undefined;

    return row ? rowToEnvironment(row) : undefined;
  }

  /**
   * Creates a new environment with the given name.
   *
   * @param name - Display name for the environment.
   * @param uuid - Optional stable identifier; generated when omitted.
   * @returns The newly created environment.
   */
  createEnvironment(name: string, uuid?: string): Environment {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const environmentUuid = uuid?.trim() || generateDocumentUuid();
    const sortOrder = this.nextEnvironmentSortOrder();
    const result = this.getDb()
      .prepare('INSERT INTO environments (name, uuid, sort_order) VALUES (?, ?, ?)')
      .run(trimmedName, environmentUuid, sortOrder);

    const row = this.getDb()
      .prepare('SELECT id, uuid, name, variables, created_at FROM environments WHERE id = ?')
      .get(result.lastInsertRowid) as Record<string, unknown>;

    return rowToEnvironment(row);
  }

  /**
   * Inserts an environment with an explicit id (used during migration).
   */
  seedEnvironment(environment: Environment): Environment {
    const environmentUuid = environment.uuid.trim() || generateDocumentUuid();
    const sortOrder = this.nextEnvironmentSortOrder();
    this.getDb()
      .prepare(
        'INSERT INTO environments (id, uuid, name, variables, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        environment.id,
        environmentUuid,
        environment.name.trim(),
        JSON.stringify(environment.variables),
        sortOrder,
        environment.created_at
      );

    const row = this.getDb()
      .prepare('SELECT id, uuid, name, variables, created_at FROM environments WHERE id = ?')
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
      .prepare('SELECT id, uuid, name, variables, created_at FROM environments WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!row) throw new Error('Environment not found');
    return rowToEnvironment(row);
  }

  /**
   * Deep-copies an environment into a new record with a fresh uuid.
   *
   * @param id - Environment ID to duplicate.
   * @returns The newly created environment with copied variables.
   */
  duplicateEnvironment(id: number): Environment {
    const source = this.listEnvironments().find((environment) => environment.id === id);
    if (!source) {
      throw new Error(`Environment not found: ${id}`);
    }

    const copyName = `${source.name} (copy)`;
    const created = this.createEnvironment(copyName);
    return this.updateEnvironment(
      created.id,
      copyName,
      source.variables.map((variable) => ({ ...variable }))
    );
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
   * Lists marketplace snippets ordered for settings display.
   *
   * @returns Marketplace snippet rows stored in the local registry only.
   */
  listMarketplaceSnippets(): Snippet[] {
    const rows = this.getDb()
      .prepare(
        "SELECT id, uuid, name, code, scope, stage, source, catalog_id, catalog_version, catalog_author, created_at, updated_at FROM snippets WHERE source = 'marketplace' ORDER BY sort_order ASC, name ASC"
      )
      .all() as Record<string, unknown>[];

    return rows.map(rowToSnippet);
  }

  /**
   * Lists legacy local user snippets still stored in the registry table.
   *
   * Used during migration into provider-backed storage.
   *
   * @returns Local snippet rows not yet routed through providers.
   */
  listLegacyLocalSnippets(): Snippet[] {
    const rows = this.getDb()
      .prepare(
        "SELECT id, uuid, name, code, scope, stage, source, catalog_id, catalog_version, catalog_author, created_at, updated_at FROM snippets WHERE source = 'local' ORDER BY sort_order ASC, name ASC"
      )
      .all() as Record<string, unknown>[];

    return rows.map(rowToSnippet);
  }

  /**
   * Deletes a legacy local snippet row from the registry table after migration.
   *
   * @param id - Legacy local snippet id in the registry table.
   */
  deleteLegacyLocalSnippet(id: number): void {
    this.getDb().prepare("DELETE FROM snippets WHERE id = ? AND source = 'local'").run(id);
  }

  /**
   * Lists all snippets ordered for settings display.
   *
   * @returns All snippets in the database.
   */
  listSnippets(): Snippet[] {
    const rows = this.getDb()
      .prepare(
        'SELECT id, uuid, name, code, scope, stage, source, catalog_id, catalog_version, catalog_author, created_at, updated_at FROM snippets ORDER BY sort_order ASC, name ASC'
      )
      .all() as Record<string, unknown>[];

    return rows.map(rowToSnippet);
  }

  /**
   * Creates a new snippet with the given name and code.
   *
   * @param name - Display name for the snippet.
   * @param code - JavaScript source.
   * @param scope - Script phases where the snippet may be referenced.
   * @param uuid - Optional stable identifier; generated when omitted.
   * @returns The newly created snippet.
   */
  createSnippet(
    name: string,
    code: string,
    scope: Snippet['scope'] = 'any',
    stage: ScriptStage = DEFAULT_SCRIPT_STAGE,
    uuid?: string
  ): Snippet {
    const trimmedName = trimRequiredName(name, 'Snippet name');
    const snippetUuid = uuid?.trim() || generateDocumentUuid();
    const sortOrder = this.nextSnippetSortOrder();
    const now = new Date().toISOString();
    const normalizedRole = normalizeScriptStage(stage);
    const result = this.getDb()
      .prepare(
        'INSERT INTO snippets (name, uuid, code, scope, stage, source, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        trimmedName,
        snippetUuid,
        code ?? '',
        scope,
        normalizedRole,
        'local',
        sortOrder,
        now,
        now
      );

    const row = this.getDb()
      .prepare(
        'SELECT id, uuid, name, code, scope, stage, source, catalog_id, catalog_version, catalog_author, created_at, updated_at FROM snippets WHERE id = ?'
      )
      .get(result.lastInsertRowid) as Record<string, unknown>;

    return rowToSnippet(row);
  }

  /**
   * Updates a snippet's name, code, and scope.
   *
   * @param id - Snippet ID to update.
   * @param name - New display name.
   * @param code - Updated JavaScript source.
   * @param scope - Script phases where the snippet may be referenced.
   * @returns The updated snippet.
   */
  updateSnippet(
    id: number,
    name: string,
    code: string,
    scope: Snippet['scope'] = 'any',
    stage: ScriptStage = DEFAULT_SCRIPT_STAGE
  ): Snippet {
    const trimmedName = trimRequiredName(name, 'Snippet name');
    const now = new Date().toISOString();
    const normalizedRole = normalizeScriptStage(stage);
    this.getDb()
      .prepare(
        'UPDATE snippets SET name = ?, code = ?, scope = ?, stage = ?, updated_at = ? WHERE id = ?'
      )
      .run(trimmedName, code ?? '', scope, normalizedRole, now, id);

    const row = this.getDb()
      .prepare(
        'SELECT id, uuid, name, code, scope, stage, source, catalog_id, catalog_version, catalog_author, created_at, updated_at FROM snippets WHERE id = ?'
      )
      .get(id) as Record<string, unknown> | undefined;

    if (!row) {
      throw new Error('Snippet not found');
    }
    return rowToSnippet(row);
  }

  /**
   * Inserts or updates a marketplace snippet row keyed by stable UUID.
   *
   * @param input - Marketplace snippet fields to persist.
   * @returns Upserted snippet row.
   */
  upsertMarketplaceSnippet(input: {
    uuid: string;
    name: string;
    code: string;
    scope: Snippet['scope'];
    stage: Snippet['stage'];
    catalogId: string;
    catalogVersion: string;
    catalogAuthor?: string;
  }): Snippet {
    const trimmedName = trimRequiredName(input.name, 'Snippet name');
    const now = new Date().toISOString();
    const normalizedRole = normalizeScriptStage(input.stage);
    const existing = this.getDb()
      .prepare('SELECT id FROM snippets WHERE uuid = ?')
      .get(input.uuid) as { id: number } | undefined;

    if (existing) {
      this.getDb()
        .prepare(
          'UPDATE snippets SET name = ?, code = ?, scope = ?, stage = ?, source = ?, catalog_id = ?, catalog_version = ?, catalog_author = ?, updated_at = ? WHERE id = ?'
        )
        .run(
          trimmedName,
          input.code,
          input.scope,
          normalizedRole,
          'marketplace',
          input.catalogId,
          input.catalogVersion,
          input.catalogAuthor ?? null,
          now,
          existing.id
        );
    } else {
      const sortOrder = this.nextSnippetSortOrder();
      this.getDb()
        .prepare(
          'INSERT INTO snippets (name, uuid, code, scope, stage, source, catalog_id, catalog_version, catalog_author, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          trimmedName,
          input.uuid,
          input.code,
          input.scope,
          normalizedRole,
          'marketplace',
          input.catalogId,
          input.catalogVersion,
          input.catalogAuthor ?? null,
          sortOrder,
          now,
          now
        );
    }

    const row = this.getDb()
      .prepare(
        'SELECT id, uuid, name, code, scope, stage, source, catalog_id, catalog_version, catalog_author, created_at, updated_at FROM snippets WHERE uuid = ?'
      )
      .get(input.uuid) as Record<string, unknown>;

    return rowToSnippet(row);
  }

  /**
   * Lists marketplace snippet rows imported from one bundle id.
   *
   * @param catalogId - Marketplace bundle id from snippets.json.
   * @returns Snippet rows tagged with the bundle id.
   */
  listMarketplaceSnippetsByCatalogId(catalogId: string): Snippet[] {
    const rows = this.getDb()
      .prepare(
        'SELECT id, uuid, name, code, scope, stage, source, catalog_id, catalog_version, catalog_author, created_at, updated_at FROM snippets WHERE catalog_id = ? ORDER BY sort_order ASC, name ASC'
      )
      .all(catalogId) as Record<string, unknown>[];

    return rows.map(rowToSnippet);
  }

  /**
   * Deletes all marketplace snippet rows imported from one bundle id.
   *
   * @param catalogId - Marketplace bundle id from snippets.json.
   */
  deleteSnippetsByCatalogId(catalogId: string): void {
    this.getDb().prepare('DELETE FROM snippets WHERE catalog_id = ?').run(catalogId);
  }

  /**
   * Backfills missing marketplace publisher names on snippet rows for one bundle.
   *
   * @param catalogId - Marketplace bundle id from snippets.json.
   * @param author - Publisher name from the installed bundle summary.
   */
  backfillCatalogAuthor(catalogId: string, author: string): void {
    const trimmedAuthor = author.trim();
    if (!trimmedAuthor) {
      return;
    }

    this.getDb()
      .prepare(
        "UPDATE snippets SET catalog_author = ? WHERE catalog_id = ? AND (catalog_author IS NULL OR catalog_author = '')"
      )
      .run(trimmedAuthor, catalogId);
  }

  /**
   * Ensures snippet rows linked to a bundle id are tagged as marketplace imports.
   *
   * @param catalogId - Marketplace bundle id from snippets.json.
   */
  ensureMarketplaceSource(catalogId: string): void {
    this.getDb()
      .prepare(
        "UPDATE snippets SET source = 'marketplace' WHERE catalog_id = ? AND source != 'marketplace'"
      )
      .run(catalogId);
  }

  /**
   * Deletes a snippet.
   *
   * @param id - Snippet ID to delete.
   */
  deleteSnippet(id: number): void {
    this.getDb().prepare('DELETE FROM snippets WHERE id = ?').run(id);
  }

  /**
   * Lists all chats ordered by most recently updated.
   *
   * @returns Chat summaries for history and tab labels.
   */
  listChats(): ChatSummary[] {
    const rows = this.getDb()
      .prepare('SELECT id, title, model, updated_at FROM chats ORDER BY updated_at DESC, id DESC')
      .all() as Record<string, unknown>[];

    return rows.map(rowToChatSummary);
  }

  /**
   * Creates a new chat thread.
   *
   * @param input - Optional title and model for the new chat.
   * @returns The created chat with an empty message list.
   */
  createChat(input: { title?: string; model?: string } = {}): Chat {
    const title = input.title?.trim() || DEFAULT_CHAT_TITLE;
    const model = input.model?.trim();

    const result = this.getDb()
      .prepare('INSERT INTO chats (title, model) VALUES (?, ?)')
      .run(title, model ?? null);

    const chatId = Number(result.lastInsertRowid);
    const chat = this.getChat(chatId);
    if (!chat) throw new Error('Chat not found after insert');
    return chat;
  }

  /**
   * Loads a chat and its messages by id.
   *
   * @param id - Chat id to load.
   * @returns The chat when found, otherwise null.
   */
  getChat(id: number): Chat | null {
    const summaryRow = this.getDb()
      .prepare('SELECT id, title, model, created_at, updated_at FROM chats WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!summaryRow) return null;

    const messageRows = this.getDb()
      .prepare(
        'SELECT id, chat_id, role, content, model, created_at FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC, id ASC'
      )
      .all(id) as Record<string, unknown>[];

    return rowToChat(summaryRow, messageRows);
  }

  /**
   * Appends a message to a chat and updates the chat timestamp.
   *
   * @param input - Chat id, role, content, and optional model.
   * @returns The persisted message.
   */
  addChatMessage(input: {
    chatId: number;
    role: ChatRole;
    content: string;
    model?: string;
  }): ChatMessage {
    const content = input.content.trim();
    if (!content) {
      throw new Error('Message content is required');
    }

    const chatRow = this.getDb()
      .prepare('SELECT id, title FROM chats WHERE id = ?')
      .get(input.chatId) as { id: number; title: string } | undefined;

    if (!chatRow) {
      throw new Error('Chat not found');
    }

    const result = this.getDb()
      .prepare('INSERT INTO chat_messages (chat_id, role, content, model) VALUES (?, ?, ?, ?)')
      .run(input.chatId, input.role, content, input.model ?? null);

    this.getDb()
      .prepare("UPDATE chats SET updated_at = datetime('now') WHERE id = ?")
      .run(input.chatId);

    const row = this.getDb()
      .prepare(
        'SELECT id, chat_id, role, content, model, created_at FROM chat_messages WHERE id = ?'
      )
      .get(result.lastInsertRowid) as Record<string, unknown>;

    return rowToChatMessage(row);
  }

  /**
   * Deletes a chat and its messages.
   *
   * @param id - Chat id to delete.
   */
  deleteChat(id: number): void {
    this.getDb().prepare('DELETE FROM chats WHERE id = ?').run(id);
  }

  /**
   * Updates the last-selected model id stored on a chat row.
   *
   * @param chatId - Chat id to update.
   * @param model - Provider-specific model id.
   */
  updateChatModel(chatId: number, model: string): void {
    const trimmed = model.trim();
    if (!trimmed) {
      throw new Error('Model id is required');
    }

    const result = this.getDb()
      .prepare('UPDATE chats SET model = ? WHERE id = ?')
      .run(trimmed, chatId);

    if (result.changes === 0) {
      throw new Error('Chat not found');
    }
  }

  /**
   * Updates the display title stored on a chat row.
   *
   * @param chatId - Chat id to update.
   * @param title - New tab and history title.
   */
  updateChatTitle(chatId: number, title: string): void {
    const normalized = normalizeChatTitle(title);
    if (normalized === DEFAULT_CHAT_TITLE) {
      throw new Error('Chat title must differ from the default title');
    }

    const result = this.getDb()
      .prepare('UPDATE chats SET title = ? WHERE id = ?')
      .run(normalized, chatId);

    if (result.changes === 0) {
      throw new Error('Chat not found');
    }
  }

  /**
   * Lists setting keys that start with the given prefix.
   *
   * @param prefix - Key prefix to match.
   * @returns Matching setting keys in arbitrary order.
   */
  listSettingKeysWithPrefix(prefix: string): string[] {
    const rows = this.getDb()
      .prepare('SELECT key FROM settings WHERE key LIKE ?')
      .all(`${prefix}%`) as { key: string }[];
    return rows.map((row) => row.key);
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
          providerCollectionId: row.provider_collection_id as number,
          collectionUuid: ''
        });
      }

      return rows.length;
    } finally {
      legacy.close();
    }
  }

  /**
   * Reads a plugin-scoped persisted value.
   *
   * @param pluginId - Plugin manifest id.
   * @param key - Storage key within the plugin namespace.
   * @returns Stored JSON string, or undefined when unset.
   */
  getPluginValue(pluginId: string, key: string): string | undefined {
    const row = this.getDb()
      .prepare('SELECT value FROM plugin_storage WHERE plugin_id = ? AND key = ?')
      .get(pluginId, key) as { value: string } | undefined;
    return row?.value;
  }

  /**
   * Lists all persisted storage rows for one plugin.
   *
   * @param pluginId - Plugin manifest id.
   */
  listPluginStorageEntries(pluginId: string): Array<{ key: string; value: string }> {
    const rows = this.getDb()
      .prepare('SELECT key, value FROM plugin_storage WHERE plugin_id = ? ORDER BY key')
      .all(pluginId) as Array<{ key: string; value: string }>;
    return rows;
  }

  /**
   * Persists a plugin-scoped JSON value.
   *
   * @param pluginId - Plugin manifest id.
   * @param key - Storage key within the plugin namespace.
   * @param value - Serialized JSON value.
   */
  setPluginValue(pluginId: string, key: string, value: string): void {
    this.getDb()
      .prepare(
        `INSERT INTO plugin_storage (plugin_id, key, value)
         VALUES (?, ?, ?)
         ON CONFLICT(plugin_id, key) DO UPDATE SET value = excluded.value`
      )
      .run(pluginId, key, value);
  }

  /**
   * Deletes all persisted storage rows for one plugin.
   *
   * @param pluginId - Plugin manifest id.
   */
  deletePluginStorage(pluginId: string): void {
    this.getDb().prepare('DELETE FROM plugin_storage WHERE plugin_id = ?').run(pluginId);
  }

  /**
   * Persists a user-granted filesystem path for one plugin.
   *
   * @param pluginId - Plugin manifest id.
   * @param path - Normalized absolute path approved via pick/save dialogs.
   */
  addPluginFsGrant(pluginId: string, path: string): void {
    this.getDb()
      .prepare(
        `INSERT INTO plugin_fs_grants (plugin_id, path)
         VALUES (?, ?)
         ON CONFLICT(plugin_id, path) DO NOTHING`
      )
      .run(pluginId, path);
  }

  /**
   * Lists persisted filesystem grants for one plugin.
   *
   * @param pluginId - Plugin manifest id.
   * @returns Normalized absolute paths previously granted for the plugin.
   */
  listPluginFsGrants(pluginId: string): string[] {
    const rows = this.getDb()
      .prepare('SELECT path FROM plugin_fs_grants WHERE plugin_id = ? ORDER BY path')
      .all(pluginId) as Array<{ path: string }>;
    return rows.map((row) => row.path);
  }

  /**
   * Removes all persisted filesystem grants for one plugin.
   *
   * @param pluginId - Plugin manifest id.
   */
  clearPluginFsGrants(pluginId: string): void {
    this.getDb().prepare('DELETE FROM plugin_fs_grants WHERE plugin_id = ?').run(pluginId);
  }
}
