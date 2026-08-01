/**
 * Shared SQL DDL and column lists for provider-backed live server tables.
 */

export const PROVIDER_LIVE_SERVER_COLUMNS =
  'id, uuid, name, payload, sort_order, created_at, updated_at';

/**
 * SQL fragment for creating the live_servers table in SQLite providers.
 */
export const CREATE_PROVIDER_LIVE_SERVERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS live_servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL,
  name TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`.trim();

/**
 * MySQL-compatible live_servers table DDL.
 */
export const CREATE_PROVIDER_LIVE_SERVERS_TABLE_MYSQL = `
CREATE TABLE IF NOT EXISTS live_servers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  payload LONGTEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
)
`.trim();

/**
 * PostgreSQL-compatible live_servers table DDL.
 */
export const CREATE_PROVIDER_LIVE_SERVERS_TABLE_POSTGRES = `
CREATE TABLE IF NOT EXISTS live_servers (
  id SERIAL PRIMARY KEY,
  uuid TEXT NOT NULL,
  name TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
)
`.trim();
