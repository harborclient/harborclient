import type { ScriptRef } from '#/shared/types';
import {
  mirrorLegacyScriptString,
  normalizeScriptRefs,
  readScriptRefsFromJson,
  resolveScriptRefs,
  serializeScriptRefs
} from '#/shared/scriptRefs';

/**
 * Legacy string and JSON column values persisted together for script lists.
 */
export interface ScriptFieldBundle {
  /**
   * Legacy single-script mirror for exports and older read paths.
   */
  legacy: string;

  /**
   * Serialized script reference array for the canonical JSON column.
   */
  json: string;
}

/**
 * Builds persisted script column values from canonical script references.
 *
 * @param refs - Script references to save.
 * @returns Legacy mirror and JSON payload for storage columns.
 */
export function bundleScriptFields(refs: ScriptRef[] | undefined | null): ScriptFieldBundle {
  const normalized = refs ?? [];
  return {
    legacy: mirrorLegacyScriptString(normalized),
    json: serializeScriptRefs(normalized)
  };
}

/**
 * Builds persisted script columns, synthesizing inline refs from legacy strings when arrays are empty.
 *
 * @param refs - Canonical script references from the editor or IPC payload.
 * @param legacyScript - Legacy single-script column used when refs are empty.
 * @returns Legacy mirror and JSON payload for storage columns.
 */
export function bundleScriptFieldsWithLegacy(
  refs: ScriptRef[] | undefined | null,
  legacyScript: string
): ScriptFieldBundle {
  const resolved = resolveScriptRefs(refs, legacyScript);
  return {
    legacy: mirrorLegacyScriptString(resolved),
    json: serializeScriptRefs(resolved)
  };
}

/**
 * Encodes script references for Team Hub legacy script string columns.
 *
 * Team Hub API only persists `preRequestScript` / `postRequestScript` strings.
 * Multiple scripts, snippets, named inline scripts, or a blank default inline
 * script are stored as a JSON array in that column. A lone anonymous inline
 * script with non-empty source keeps plain text for backward compatibility.
 *
 * @param refs - Canonical script references to persist.
 * @returns Value suitable for Team Hub pre/post script string columns.
 */
export function teamHubScriptColumn(refs: ScriptRef[] | undefined | null): string {
  const normalized = normalizeScriptRefs(refs);
  if (normalized.length === 0) {
    return '';
  }
  if (normalized.length === 1 && normalized[0]?.kind === 'inline' && !normalized[0]?.name?.trim()) {
    const code = (normalized[0].code ?? '').trim();
    if (code) {
      return code;
    }
  }
  return serializeScriptRefs(normalized);
}

/**
 * Reads script references from a Team Hub legacy script string column.
 *
 * @param raw - Stored pre/post script column from HarborClient Server.
 * @returns Resolved script reference list.
 */
export function teamHubScriptRefsFromColumn(raw: string | undefined | null): ScriptRef[] {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith('[')) {
    return readScriptRefsFromJson(trimmed, '');
  }
  return resolveScriptRefs([], trimmed);
}

/**
 * Adds script array columns to a SQLite-backed table when missing.
 *
 * @param db - Open better-sqlite3 database handle.
 * @param table - Table name (`collections`, `requests`, or `folders`).
 */
export function migrateSqliteScriptArrayColumns(
  db: {
    prepare: (sql: string) => { all: () => Array<{ name: string }> };
    exec: (sql: string) => void;
  },
  table: 'collections' | 'requests' | 'folders'
): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((col) => col.name === 'pre_request_scripts')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN pre_request_scripts TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!columns.some((col) => col.name === 'post_request_scripts')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN post_request_scripts TEXT NOT NULL DEFAULT '[]'`);
  }
}

/**
 * Adds script array columns to a Postgres-backed table when missing.
 *
 * @param pool - Connected Postgres pool.
 * @param table - Table name (`collections`, `requests`, or `folders`).
 */
export async function migratePostgresScriptArrayColumns(
  pool: { query: (sql: string) => Promise<unknown> },
  table: 'collections' | 'requests' | 'folders'
): Promise<void> {
  await pool.query(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS pre_request_scripts TEXT NOT NULL DEFAULT '[]'`
  );
  await pool.query(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS post_request_scripts TEXT NOT NULL DEFAULT '[]'`
  );
}
