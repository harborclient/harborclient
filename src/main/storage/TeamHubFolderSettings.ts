import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { normalizeVariable } from '#/main/storage/collectionData';
import { bundleScriptFieldsWithLegacy } from '#/main/storage/scriptFields';
import { DEFAULT_AUTH_JSON, defaultAuth, normalizeAuth } from '#/shared/auth';
import { readScriptRefsFromJson } from '#/shared/scriptRefs';
import type { AuthConfig, KeyValue, ScriptRef, Variable } from '#/shared/types';

/**
 * Folder settings persisted locally for Team Hub folders (server API has name only).
 */
export interface TeamHubFolderSettingsPayload {
  variables: Variable[];
  headers: KeyValue[];
  auth: AuthConfig;
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts: ScriptRef[];
  post_request_scripts: ScriptRef[];
}

/**
 * SQLite overlay for folder variables, headers, auth, and scripts on Team Hub collections.
 *
 * Stored in the same per-hub database as {@link TeamHubIdMap} (`team-hub-<hubId>.db`).
 */
export class TeamHubFolderSettings {
  private db: Database.Database | null = null;

  /**
   * @param dbPath - Absolute path to the team hub SQLite file.
   */
  constructor(private readonly dbPath: string) {}

  /**
   * Opens the SQLite database and ensures the folder settings schema exists.
   */
  init(): void {
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS folder_settings (
        server_id TEXT PRIMARY KEY,
        variables TEXT NOT NULL DEFAULT '[]',
        headers TEXT NOT NULL DEFAULT '[]',
        auth TEXT NOT NULL DEFAULT '${DEFAULT_AUTH_JSON.replace(/'/g, "''")}',
        pre_request_script TEXT NOT NULL DEFAULT '',
        post_request_script TEXT NOT NULL DEFAULT '',
        pre_request_scripts TEXT NOT NULL DEFAULT '[]',
        post_request_scripts TEXT NOT NULL DEFAULT '[]'
      );
    `);
  }

  /**
   * Returns the active SQLite handle.
   *
   * @throws When {@link init} has not been called yet.
   */
  private getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Team hub folder settings not initialized');
    }
    return this.db;
  }

  /**
   * Reads locally stored folder settings for a server folder UUID.
   *
   * @param serverId - Folder UUID from HarborClient Server.
   * @returns Stored settings, or null when none were saved locally.
   */
  get(serverId: string): TeamHubFolderSettingsPayload | null {
    const row = this.getDb()
      .prepare(
        `SELECT variables, headers, auth, pre_request_script, post_request_script,
          pre_request_scripts, post_request_scripts
         FROM folder_settings WHERE server_id = ?`
      )
      .get(serverId) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    const preRequestScript = String(row.pre_request_script ?? '');
    const postRequestScript = String(row.post_request_script ?? '');
    return {
      variables: parseVariables(row.variables),
      headers: parseJsonArray<KeyValue>(row.headers, []),
      auth: parseAuth(row.auth),
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript,
      pre_request_scripts: readScriptRefsFromJson(row.pre_request_scripts, preRequestScript),
      post_request_scripts: readScriptRefsFromJson(row.post_request_scripts, postRequestScript)
    };
  }

  /**
   * Upserts folder settings for a server folder UUID.
   *
   * @param serverId - Folder UUID from HarborClient Server.
   * @param settings - Folder settings to persist locally.
   */
  put(
    serverId: string,
    settings: {
      variables: Variable[];
      headers: KeyValue[];
      auth: AuthConfig;
      preRequestScript: string;
      postRequestScript: string;
      preRequestScripts: ScriptRef[];
      postRequestScripts: ScriptRef[];
    }
  ): void {
    const preScripts = bundleScriptFieldsWithLegacy(
      settings.preRequestScripts,
      settings.preRequestScript
    );
    const postScripts = bundleScriptFieldsWithLegacy(
      settings.postRequestScripts,
      settings.postRequestScript
    );

    this.getDb()
      .prepare(
        `INSERT INTO folder_settings (
          server_id, variables, headers, auth,
          pre_request_script, post_request_script, pre_request_scripts, post_request_scripts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(server_id) DO UPDATE SET
          variables = excluded.variables,
          headers = excluded.headers,
          auth = excluded.auth,
          pre_request_script = excluded.pre_request_script,
          post_request_script = excluded.post_request_script,
          pre_request_scripts = excluded.pre_request_scripts,
          post_request_scripts = excluded.post_request_scripts`
      )
      .run(
        serverId,
        JSON.stringify(settings.variables),
        JSON.stringify(settings.headers),
        JSON.stringify(normalizeAuth(settings.auth)),
        preScripts.legacy,
        postScripts.legacy,
        preScripts.json,
        postScripts.json
      );
  }

  /**
   * Removes locally stored folder settings when a folder is deleted on the server.
   *
   * @param serverId - Folder UUID from HarborClient Server.
   */
  delete(serverId: string): void {
    this.getDb().prepare('DELETE FROM folder_settings WHERE server_id = ?').run(serverId);
  }

  /**
   * Closes the SQLite connection.
   */
  close(): void {
    this.db?.close();
    this.db = null;
  }
}

/**
 * Parses a variables JSON column into normalized variable rows.
 *
 * @param value - Raw column value from SQLite.
 */
function parseVariables(value: unknown): Variable[] {
  return parseJsonArray<Partial<Variable>>(value, []).map(normalizeVariable);
}

/**
 * Parses auth JSON from a database row, falling back to defaultAuth when absent.
 *
 * @param value - Raw auth column from SQLite.
 */
function parseAuth(value: unknown): AuthConfig {
  if (typeof value === 'string') {
    try {
      return normalizeAuth(JSON.parse(value));
    } catch {
      return defaultAuth();
    }
  }
  return normalizeAuth(value);
}

/**
 * Parses a JSON array column with a safe fallback.
 *
 * @param value - Raw column value from SQLite.
 * @param fallback - Value used when parsing fails or the column is empty.
 */
function parseJsonArray<T>(value: unknown, fallback: T[]): T[] {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}
