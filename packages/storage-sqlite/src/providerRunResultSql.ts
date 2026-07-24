/**
 * Shared SQL DDL and column lists for provider-backed run result tables.
 */
export const PROVIDER_RUN_RESULT_COLUMNS =
  'id, uuid, label, kind, collection_name, request_name, summary_passed, summary_failed, summary_skipped, payload, created_at';

/**
 * SQL fragment for creating the run_results table in SQLite-backed providers.
 */
export const CREATE_PROVIDER_RUN_RESULTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS run_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  collection_name TEXT,
  request_name TEXT,
  summary_passed INTEGER NOT NULL DEFAULT 0,
  summary_failed INTEGER NOT NULL DEFAULT 0,
  summary_skipped INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`.trim();

/**
 * MySQL-compatible run_results table DDL.
 */
export const CREATE_PROVIDER_RUN_RESULTS_TABLE_MYSQL = `
CREATE TABLE IF NOT EXISTS run_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(255) NOT NULL,
  label VARCHAR(512) NOT NULL,
  kind VARCHAR(64) NOT NULL,
  collection_name VARCHAR(512),
  request_name VARCHAR(512),
  summary_passed INT NOT NULL DEFAULT 0,
  summary_failed INT NOT NULL DEFAULT 0,
  summary_skipped INT NOT NULL DEFAULT 0,
  payload LONGTEXT NOT NULL,
  created_at VARCHAR(64) NOT NULL
)
`.trim();

/**
 * PostgreSQL-compatible run_results table DDL.
 */
export const CREATE_PROVIDER_RUN_RESULTS_TABLE_POSTGRES = `
CREATE TABLE IF NOT EXISTS run_results (
  id SERIAL PRIMARY KEY,
  uuid TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  collection_name TEXT,
  request_name TEXT,
  summary_passed INTEGER NOT NULL DEFAULT 0,
  summary_failed INTEGER NOT NULL DEFAULT 0,
  summary_skipped INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
)
`.trim();
