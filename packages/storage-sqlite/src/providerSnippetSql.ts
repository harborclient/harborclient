/**
 * Shared SQL DDL and column lists for provider-backed snippet tables.
 */
import type Database from 'better-sqlite3';

export const PROVIDER_SNIPPET_COLUMNS =
  'id, uuid, name, code, scope, stage, sort_order, created_at, updated_at';

/**
 * SQL fragment for creating the snippets table in SQL-backed providers.
 */
export const CREATE_PROVIDER_SNIPPETS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT 'any',
  stage TEXT NOT NULL DEFAULT 'main',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`.trim();

/**
 * MySQL-compatible snippets table DDL.
 */
export const CREATE_PROVIDER_SNIPPETS_TABLE_MYSQL = `
CREATE TABLE IF NOT EXISTS snippets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  code LONGTEXT NOT NULL,
  scope VARCHAR(32) NOT NULL DEFAULT 'any',
  stage VARCHAR(32) NOT NULL DEFAULT 'main',
  sort_order INT NOT NULL DEFAULT 0,
  created_at VARCHAR(64) NOT NULL,
  updated_at VARCHAR(64) NOT NULL
)
`.trim();

/**
 * PostgreSQL-compatible snippets table DDL.
 */
export const CREATE_PROVIDER_SNIPPETS_TABLE_POSTGRES = `
CREATE TABLE IF NOT EXISTS snippets (
  id SERIAL PRIMARY KEY,
  uuid TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT 'any',
  stage TEXT NOT NULL DEFAULT 'main',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
)
`.trim();

/**
 * Migrates legacy snippet `role` columns to `stage` in SQLite provider databases.
 *
 * @param db - Open SQLite database handle.
 */
export function migrateSqliteSnippetStageColumn(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(snippets)').all() as Array<{ name: string }>;
  if (columns.length === 0) {
    return;
  }
  if (columns.some((col) => col.name === 'stage')) {
    migrateSqliteSnippetStageRunToMain(db);
    return;
  }
  if (columns.some((col) => col.name === 'role')) {
    db.exec('ALTER TABLE snippets RENAME COLUMN role TO stage');
    migrateSqliteSnippetStageRunToMain(db);
    return;
  }
  db.exec("ALTER TABLE snippets ADD COLUMN stage TEXT NOT NULL DEFAULT 'main'");
}

/**
 * Rewrites legacy snippet stage value `run` to `main`.
 *
 * @param db - Open SQLite database handle.
 */
export function migrateSqliteSnippetStageRunToMain(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(snippets)').all() as Array<{ name: string }>;
  if (!columns.some((col) => col.name === 'stage')) {
    return;
  }
  db.exec("UPDATE snippets SET stage = 'main' WHERE stage = 'run'");
}
