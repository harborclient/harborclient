import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Entity kinds stored in the team hub id map.
 */
export type TeamHubEntityType =
  | 'collection'
  | 'environment'
  | 'folder'
  | 'request'
  | 'run_result'
  | 'snippet';

/**
 * Persistent bidirectional map between HarborClient Server UUIDs and local numeric ids.
 *
 * Stored per team hub so {@link IStorage} callers keep using numeric ids while the
 * server API uses UUID strings.
 */
export class TeamHubIdMap {
  private db: Database.Database | null = null;

  /**
   * @param dbPath - Absolute path to the SQLite file (`team-hub-<hubId>.db`).
   */
  constructor(private readonly dbPath: string) {}

  /**
   * Opens the SQLite database and ensures the id map schema exists.
   */
  init(): void {
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS id_map (
        entity_type TEXT NOT NULL,
        server_id TEXT NOT NULL,
        local_id INTEGER PRIMARY KEY AUTOINCREMENT,
        UNIQUE(entity_type, server_id)
      );
      CREATE INDEX IF NOT EXISTS idx_id_map_local
        ON id_map(entity_type, local_id);
    `);
  }

  /**
   * Returns the active SQLite handle.
   *
   * @throws When {@link init} has not been called yet.
   */
  private getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Team hub id map not initialized');
    }
    return this.db;
  }

  /**
   * Maps a server UUID to a stable local numeric id, inserting on first sight.
   *
   * @param entityType - Entity kind (`collection`, `environment`, `folder`, or `request`).
   * @param serverId - Server-side UUID string.
   * @returns Local numeric id for use with {@link IStorage}.
   */
  toLocalId(entityType: TeamHubEntityType, serverId: string): number {
    const db = this.getDb();
    db.prepare('INSERT OR IGNORE INTO id_map (entity_type, server_id) VALUES (?, ?)').run(
      entityType,
      serverId
    );
    const row = db
      .prepare('SELECT local_id FROM id_map WHERE entity_type = ? AND server_id = ?')
      .get(entityType, serverId) as { local_id: number } | undefined;
    if (!row) {
      throw new Error(`Failed to resolve local id for ${entityType} ${serverId}`);
    }
    return row.local_id;
  }

  /**
   * Looks up a local numeric id for a server UUID without inserting a new mapping.
   *
   * @param entityType - Entity kind (`collection`, `environment`, `folder`, or `request`).
   * @param serverId - Server-side UUID string.
   * @returns Local numeric id when mapped, otherwise undefined.
   */
  findLocalId(entityType: TeamHubEntityType, serverId: string): number | undefined {
    const row = this.getDb()
      .prepare('SELECT local_id FROM id_map WHERE entity_type = ? AND server_id = ?')
      .get(entityType, serverId) as { local_id: number } | undefined;
    return row?.local_id;
  }

  /**
   * Resolves a local numeric id back to the server UUID.
   *
   * @param entityType - Entity kind (`collection`, `environment`, `folder`, or `request`).
   * @param localId - Local numeric id from {@link toLocalId}.
   * @returns Server UUID, or undefined when the local id is unknown.
   */
  toServerId(entityType: TeamHubEntityType, localId: number): string | undefined {
    const row = this.getDb()
      .prepare('SELECT server_id FROM id_map WHERE entity_type = ? AND local_id = ?')
      .get(entityType, localId) as { server_id: string } | undefined;
    return row?.server_id;
  }

  /**
   * Removes a server UUID mapping so a detached collection is not reused accidentally.
   *
   * @param entityType - Entity kind (`collection`, `environment`, `folder`, or `request`).
   * @param serverId - Server-side UUID string to forget.
   */
  forget(entityType: TeamHubEntityType, serverId: string): void {
    this.getDb()
      .prepare('DELETE FROM id_map WHERE entity_type = ? AND server_id = ?')
      .run(entityType, serverId);
  }

  /**
   * Closes the SQLite connection.
   */
  close(): void {
    this.db?.close();
    this.db = null;
  }
}
