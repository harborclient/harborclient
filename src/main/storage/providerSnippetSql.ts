/**
 * Shared SQL DDL and column lists for provider-backed snippet tables.
 */
export const PROVIDER_SNIPPET_COLUMNS =
  'id, uuid, name, code, scope, sort_order, created_at, updated_at';

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
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
)
`.trim();
