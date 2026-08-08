import { DEFAULT_AUTH_JSON } from '#/db/types.js';

/**
 * DDL for creating the tenants table when absent.
 */
export const TENANTS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT,
  updated_by_user_id TEXT
);
`.trim();

/**
 * DDL for creating the api_tokens table when absent.
 */
export const API_TOKENS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  token_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (tenant_id, token_hash)
);
`.trim();

/**
 * DDL for creating the collections table when absent.
 */
export const COLLECTIONS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  name TEXT NOT NULL,
  variables TEXT NOT NULL DEFAULT '[]',
  headers TEXT NOT NULL DEFAULT '[]',
  auth TEXT NOT NULL DEFAULT '${DEFAULT_AUTH_JSON.replace(/'/g, "''")}',
  pre_request_script TEXT NOT NULL DEFAULT '',
  post_request_script TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);
`.trim();

/**
 * DDL for creating the environments table when absent.
 */
export const ENVIRONMENTS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  name TEXT NOT NULL,
  variables TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  parent_uuid TEXT REFERENCES environments(id) ON DELETE SET NULL
);
`.trim();

/**
 * DDL for creating the snippets table when absent.
 */
export const SNIPPETS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS snippets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT 'any' CHECK (scope IN ('pre-request', 'post-request', 'any')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  deletion_locked BOOLEAN NOT NULL DEFAULT FALSE
);
`.trim();

/**
 * DDL for provider-routed live server and live page entities.
 */
export const LIVE_ENTITIES_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS live_servers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  name TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  deletion_locked BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS live_pages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  name TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  deletion_locked BOOLEAN NOT NULL DEFAULT FALSE
);
`.trim();

/**
 * DDL for creating the folders table when absent.
 */
export const FOLDERS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  collection_id TEXT NOT NULL,
  parent_folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);
`.trim();

/**
 * DDL for creating the requests table when absent.
 */
export const REQUESTS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  collection_id TEXT NOT NULL,
  folder_id TEXT,
  name TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  protocol TEXT NOT NULL DEFAULT 'http',
  url TEXT NOT NULL DEFAULT '',
  headers TEXT NOT NULL DEFAULT '[]',
  params TEXT NOT NULL DEFAULT '[]',
  auth TEXT NOT NULL DEFAULT '${DEFAULT_AUTH_JSON.replace(/'/g, "''")}',
  body TEXT NOT NULL DEFAULT '',
  body_type TEXT NOT NULL DEFAULT 'none',
  pre_request_script TEXT NOT NULL DEFAULT '',
  post_request_script TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);
`.trim();

/**
 * DDL for creating the documents table when absent.
 */
export const DOCUMENTS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  collection_id TEXT NOT NULL,
  folder_id TEXT,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);
`.trim();

/**
 * DDL for creating the users table when absent.
 */
export const USERS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  collection_access TEXT NOT NULL DEFAULT '[]',
  environment_access TEXT NOT NULL DEFAULT '[]',
  snippet_access TEXT NOT NULL DEFAULT '[]',
  live_server_access TEXT NOT NULL DEFAULT '[]',
  live_page_access TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (tenant_id, name)
);
`.trim();

/**
 * DDL for creating the audit_log table when absent.
 */
export const AUDIT_LOG_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);
`.trim();

/**
 * Adds the owning user reference to api_tokens when upgrading existing databases.
 */
export const API_TOKENS_USER_ID_MIGRATION_SQL = `
ALTER TABLE api_tokens
  ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
`.trim();

/**
 * Adds user attribution columns to api_tokens when upgrading existing databases.
 */
export const API_TOKENS_ATTRIBUTION_MIGRATION_SQL = `
ALTER TABLE api_tokens
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
`.trim();

/**
 * Adds user attribution and updated_at to collections when upgrading existing databases.
 */
export const COLLECTIONS_ATTRIBUTION_MIGRATION_SQL = `
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
`.trim();

/**
 * Adds user attribution and updated_at to environments when upgrading existing databases.
 */
export const ENVIRONMENTS_ATTRIBUTION_MIGRATION_SQL = `
ALTER TABLE environments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
`.trim();

/**
 * Adds user attribution and updated_at to folders when upgrading existing databases.
 */
export const FOLDERS_ATTRIBUTION_MIGRATION_SQL = `
ALTER TABLE folders
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
`.trim();

/**
 * Adds nested-folder ancestry to existing folder tables.
 */
export const FOLDERS_PARENT_MIGRATION_SQL = `
ALTER TABLE folders
  ADD COLUMN IF NOT EXISTS parent_folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE;
`.trim();

/**
 * Adds user attribution columns to requests when upgrading existing databases.
 */
export const REQUESTS_ATTRIBUTION_MIGRATION_SQL = `
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
`.trim();

/**
 * Adds user attribution columns to users when upgrading existing databases.
 */
export const USERS_ATTRIBUTION_MIGRATION_SQL = `
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
`.trim();

/**
 * Backfills updated_at on collections from created_at for upgraded databases.
 */
export const COLLECTIONS_BACKFILL_UPDATED_AT_SQL = `
UPDATE collections SET updated_at = created_at WHERE updated_at IS NULL;
`.trim();

/**
 * Backfills updated_at on environments from created_at for upgraded databases.
 */
export const ENVIRONMENTS_BACKFILL_UPDATED_AT_SQL = `
UPDATE environments SET updated_at = created_at WHERE updated_at IS NULL;
`.trim();

/**
 * Backfills updated_at on folders from created_at for upgraded databases.
 */
export const FOLDERS_BACKFILL_UPDATED_AT_SQL = `
UPDATE folders SET updated_at = created_at WHERE updated_at IS NULL;
`.trim();

/**
 * Adds LLM access columns to users when upgrading existing databases.
 */
export const USERS_LLM_MIGRATION_SQL = `
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS llm_access BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS llm_models TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS llm_monthly_token_limit INT;
`.trim();

/**
 * DDL for creating the llm_usage table when absent.
 */
export const LLM_USAGE_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS llm_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, user_id, period)
);
`.trim();

/**
 * DDL for creating the llm_usage_log table when absent.
 */
export const LLM_USAGE_LOG_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS llm_usage_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_token_id TEXT REFERENCES api_tokens(id) ON DELETE SET NULL,
  period TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  prompt_tokens INT NOT NULL,
  completion_tokens INT NOT NULL,
  total_tokens INT NOT NULL,
  is_new_turn BOOLEAN NOT NULL DEFAULT FALSE,
  had_tool_calls BOOLEAN NOT NULL DEFAULT FALSE,
  message_count INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS llm_usage_log_user_created_at_idx ON llm_usage_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS llm_usage_log_period_idx ON llm_usage_log (period);
`.trim();

/**
 * Adds deletion lock columns to collections when upgrading existing databases.
 */
export const COLLECTIONS_DELETION_LOCKED_MIGRATION_SQL = `
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS deletion_locked BOOLEAN NOT NULL DEFAULT FALSE;
`.trim();

/**
 * Adds deletion lock columns to environments when upgrading existing databases.
 */
export const ENVIRONMENTS_DELETION_LOCKED_MIGRATION_SQL = `
ALTER TABLE environments
  ADD COLUMN IF NOT EXISTS deletion_locked BOOLEAN NOT NULL DEFAULT FALSE;
`.trim();

/**
 * Adds snippet access column to users when upgrading existing databases.
 */
export const USERS_SNIPPET_ACCESS_MIGRATION_SQL = `
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS snippet_access TEXT NOT NULL DEFAULT '[]';
`.trim();

/**
 * Adds snippet access for user accounts that have collection wildcard access but no snippet access.
 */
export const USERS_SNIPPET_ACCESS_BACKFILL_SQL = `
UPDATE users
SET snippet_access = '["*"]'
WHERE role = 'user'
  AND snippet_access = '[]'
  AND collection_access LIKE '%"*"%';
`.trim();

/**
 * Adds live entity access columns and grants them to existing wildcard users.
 */
export const USERS_LIVE_ENTITY_ACCESS_MIGRATION_SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS live_server_access TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS live_page_access TEXT NOT NULL DEFAULT '[]';
UPDATE users SET live_server_access = '["*"]', live_page_access = '["*"]'
WHERE role = 'user' AND collection_access LIKE '%"*"%';
`.trim();

/**
 * DDL for creating the run_results table when absent.
 */
export const RUN_RESULTS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS run_results (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  kind TEXT NOT NULL CHECK (kind IN ('collection-run-results', 'request-run-results')),
  label TEXT NOT NULL,
  collection_name TEXT,
  request_name TEXT,
  summary_passed INT NOT NULL DEFAULT 0,
  summary_failed INT NOT NULL DEFAULT 0,
  summary_skipped INT NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS run_results_created_idx ON run_results (created_at DESC);
`.trim();

/**
 * DDL for creating the discussion_comments table when absent.
 */
export const DISCUSSION_COMMENTS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS discussion_comments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('request', 'collection', 'folder', 'runResult')),
  target_entity_id TEXT NOT NULL,
  parent_comment_id TEXT REFERENCES discussion_comments(id) ON DELETE SET NULL,
  root_comment_id TEXT NOT NULL,
  depth INT NOT NULL CHECK (depth >= 1 AND depth <= 3),
  body TEXT NOT NULL DEFAULT '',
  body_format TEXT NOT NULL DEFAULT 'plaintext' CHECK (body_format IN ('plaintext', 'encrypted')),
  body_metadata TEXT,
  author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  tombstoned_at TIMESTAMPTZ,
  tombstoned_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS discussion_comments_target_idx
  ON discussion_comments (tenant_id, target_entity_type, target_entity_id, created_at);
CREATE INDEX IF NOT EXISTS discussion_comments_root_idx
  ON discussion_comments (tenant_id, root_comment_id, created_at);
`.trim();

/**
 * DDL for collaboration notices, notification settings, and thread subscriptions.
 */
export const NOTICES_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('request', 'collection', 'folder', 'runResult')),
  entity_id TEXT NOT NULL,
  request_id TEXT,
  collection_id TEXT,
  folder_id TEXT,
  run_result_id TEXT,
  discussion_thread_id TEXT,
  discussion_comment_id TEXT,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ,
  display_metadata TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notices_recipient_idx
  ON notices (tenant_id, recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notices_recipient_unread_idx
  ON notices (tenant_id, recipient_user_id, read_at);

CREATE TABLE IF NOT EXISTS user_notification_settings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  level TEXT NOT NULL DEFAULT 'all' CHECK (level IN ('all', 'mentions', 'none')),
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS discussion_thread_subscriptions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  root_comment_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, user_id, root_comment_id)
);
CREATE INDEX IF NOT EXISTS discussion_thread_subscriptions_thread_idx
  ON discussion_thread_subscriptions (tenant_id, root_comment_id);
`.trim();

/**
 * SQL migration creating the user_invitations table for onboarding links.
 */
export const USER_INVITATIONS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS user_invitations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash CHAR(64) NOT NULL,
  code_prefix TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (tenant_id, code_hash)
);
CREATE INDEX IF NOT EXISTS user_invitations_user_id_idx ON user_invitations (user_id);
CREATE INDEX IF NOT EXISTS user_invitations_expires_at_idx ON user_invitations (expires_at);
`.trim();

/**
 * Builds the sidebar marker column migration for a table.
 *
 * Runs as a single statement so it works under both the simple and extended
 * query protocols, and stays idempotent across restarts. Databases predating
 * the marker rename carry the value in a `color` column, which is renamed in
 * place so existing assignments survive the upgrade.
 *
 * @param table - Table receiving the sidebar marker column.
 * @returns Idempotent PL/pgSQL migration statement.
 */
function buildMarkerMigrationSql(table: string): string {
  return `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = '${table}' AND column_name = 'color'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = '${table}' AND column_name = 'marker'
  ) THEN
    ALTER TABLE ${table} RENAME COLUMN color TO marker;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = '${table}' AND column_name = 'marker'
  ) THEN
    ALTER TABLE ${table} ADD COLUMN marker TEXT;
  END IF;
END $$;
`.trim();
}

/**
 * Adds the sidebar marker column to collections, renaming a legacy `marker` column.
 */
export const COLLECTIONS_MARKER_MIGRATION_SQL = buildMarkerMigrationSql('collections');

/**
 * Adds the sidebar marker column to folders, renaming a legacy `marker` column.
 */
export const FOLDERS_MARKER_MIGRATION_SQL = buildMarkerMigrationSql('folders');

/**
 * Adds the sidebar marker column to requests, renaming a legacy `marker` column.
 */
export const REQUESTS_MARKER_MIGRATION_SQL = buildMarkerMigrationSql('requests');

/**
 * Adds the sidebar marker column to documents, renaming a legacy `marker` column.
 */
export const DOCUMENTS_MARKER_MIGRATION_SQL = buildMarkerMigrationSql('documents');

/**
 * Adds the sidebar marker column to environments, renaming a legacy `marker` column.
 */
export const ENVIRONMENTS_MARKER_MIGRATION_SQL = buildMarkerMigrationSql('environments');

/**
 * Adds nullable parent_uuid for environment inheritance on existing databases.
 */
export const ENVIRONMENTS_PARENT_UUID_MIGRATION_SQL = `
ALTER TABLE environments
  ADD COLUMN IF NOT EXISTS parent_uuid TEXT REFERENCES environments(id) ON DELETE SET NULL;
`.trim();

/**
 * Adds the request transport protocol column on existing databases.
 */
export const REQUESTS_PROTOCOL_MIGRATION_SQL = `
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS protocol TEXT NOT NULL DEFAULT 'http';
`.trim();

/**
 * Adds tenant_id columns and tenant-scoped unique constraints on existing databases.
 *
 * Fresh installs already include tenant_id in CREATE TABLE statements; this migration
 * upgrades older schemas that predate multitenancy.
 */
export const TENANT_ID_COLUMNS_MIGRATION_SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE collections ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE environments ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE snippets ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE live_servers ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE live_pages ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE folders ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE llm_usage_log ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE run_results ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';
ALTER TABLE discussion_comments ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '__default__';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_name_key'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_name_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_tenant_id_name_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_tenant_id_name_key UNIQUE (tenant_id, name);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_tokens_token_hash_key'
  ) THEN
    ALTER TABLE api_tokens DROP CONSTRAINT api_tokens_token_hash_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_tokens_tenant_id_token_hash_key'
  ) THEN
    ALTER TABLE api_tokens ADD CONSTRAINT api_tokens_tenant_id_token_hash_key UNIQUE (tenant_id, token_hash);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_invitations_code_hash_key'
  ) THEN
    ALTER TABLE user_invitations DROP CONSTRAINT user_invitations_code_hash_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_invitations_tenant_id_code_hash_key'
  ) THEN
    ALTER TABLE user_invitations ADD CONSTRAINT user_invitations_tenant_id_code_hash_key UNIQUE (tenant_id, code_hash);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'llm_usage_user_id_period_key'
  ) THEN
    ALTER TABLE llm_usage DROP CONSTRAINT llm_usage_user_id_period_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'llm_usage_tenant_id_user_id_period_key'
  ) THEN
    ALTER TABLE llm_usage ADD CONSTRAINT llm_usage_tenant_id_user_id_period_key UNIQUE (tenant_id, user_id, period);
  END IF;
END $$;
`.trim();

/**
 * Adds persisted hub avatar fields to tenant records.
 */
export const TENANT_AVATAR_MIGRATION_SQL = `
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS avatar_initials TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS avatar_color TEXT;
`.trim();

/**
 * Adds persisted user avatar fields to user records.
 */
export const USERS_AVATAR_MIGRATION_SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_initials TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color TEXT;
`.trim();

/**
 * Adds uploaded avatar image storage columns to user records.
 */
export const USERS_AVATAR_IMAGE_MIGRATION_SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_image TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_image_mime TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_image_updated_at TIMESTAMPTZ;
`.trim();

/**
 * DDL for creating the device_keys table when absent.
 */
export const DEVICE_KEYS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS device_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  key_format TEXT NOT NULL DEFAULT 'identity-v1',
  public_key_material TEXT NOT NULL,
  fingerprint CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (tenant_id, user_id, device_id)
);
CREATE INDEX IF NOT EXISTS device_keys_user_idx ON device_keys (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS device_keys_fingerprint_idx ON device_keys (tenant_id, fingerprint);
`.trim();

/**
 * DDL for discussion MLS group state, commits, and welcome relay records.
 */
export const DISCUSSION_MLS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS discussion_mls_group_state (
  mls_group_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('request', 'collection', 'folder', 'runResult')),
  target_entity_id TEXT NOT NULL,
  current_epoch INT NOT NULL CHECK (current_epoch >= 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (tenant_id, mls_group_id)
);

CREATE TABLE IF NOT EXISTS discussion_mls_commits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  mls_group_id TEXT NOT NULL,
  epoch INT NOT NULL CHECK (epoch >= 0),
  ciphertext TEXT NOT NULL,
  sender_device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (tenant_id, mls_group_id, epoch)
);
CREATE INDEX IF NOT EXISTS discussion_mls_commits_group_epoch_idx
  ON discussion_mls_commits (tenant_id, mls_group_id, epoch);

CREATE TABLE IF NOT EXISTS discussion_mls_welcomes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__default__',
  mls_group_id TEXT NOT NULL,
  recipient_device_id TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  ratchet_tree TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS discussion_mls_welcomes_group_idx
  ON discussion_mls_welcomes (tenant_id, mls_group_id, created_at);
`.trim();

/**
 * Ordered Postgres migrations applied by {@link PostgresDatabase.migrate}.
 */
export const POSTGRES_MIGRATIONS = [
  TENANTS_MIGRATION_SQL,
  USERS_MIGRATION_SQL,
  API_TOKENS_MIGRATION_SQL,
  COLLECTIONS_MIGRATION_SQL,
  ENVIRONMENTS_MIGRATION_SQL,
  SNIPPETS_MIGRATION_SQL,
  LIVE_ENTITIES_MIGRATION_SQL,
  FOLDERS_MIGRATION_SQL,
  REQUESTS_MIGRATION_SQL,
  DOCUMENTS_MIGRATION_SQL,
  AUDIT_LOG_MIGRATION_SQL,
  API_TOKENS_USER_ID_MIGRATION_SQL,
  API_TOKENS_ATTRIBUTION_MIGRATION_SQL,
  COLLECTIONS_ATTRIBUTION_MIGRATION_SQL,
  ENVIRONMENTS_ATTRIBUTION_MIGRATION_SQL,
  FOLDERS_ATTRIBUTION_MIGRATION_SQL,
  FOLDERS_PARENT_MIGRATION_SQL,
  REQUESTS_ATTRIBUTION_MIGRATION_SQL,
  USERS_ATTRIBUTION_MIGRATION_SQL,
  COLLECTIONS_BACKFILL_UPDATED_AT_SQL,
  ENVIRONMENTS_BACKFILL_UPDATED_AT_SQL,
  FOLDERS_BACKFILL_UPDATED_AT_SQL,
  USERS_LLM_MIGRATION_SQL,
  LLM_USAGE_MIGRATION_SQL,
  LLM_USAGE_LOG_MIGRATION_SQL,
  COLLECTIONS_DELETION_LOCKED_MIGRATION_SQL,
  ENVIRONMENTS_DELETION_LOCKED_MIGRATION_SQL,
  USERS_SNIPPET_ACCESS_MIGRATION_SQL,
  USERS_SNIPPET_ACCESS_BACKFILL_SQL,
  USERS_LIVE_ENTITY_ACCESS_MIGRATION_SQL,
  RUN_RESULTS_MIGRATION_SQL,
  DISCUSSION_COMMENTS_MIGRATION_SQL,
  USER_INVITATIONS_MIGRATION_SQL,
  COLLECTIONS_MARKER_MIGRATION_SQL,
  FOLDERS_MARKER_MIGRATION_SQL,
  REQUESTS_MARKER_MIGRATION_SQL,
  DOCUMENTS_MARKER_MIGRATION_SQL,
  ENVIRONMENTS_MARKER_MIGRATION_SQL,
  ENVIRONMENTS_PARENT_UUID_MIGRATION_SQL,
  REQUESTS_PROTOCOL_MIGRATION_SQL,
  TENANT_ID_COLUMNS_MIGRATION_SQL,
  TENANT_AVATAR_MIGRATION_SQL,
  USERS_AVATAR_MIGRATION_SQL,
  NOTICES_MIGRATION_SQL,
  DEVICE_KEYS_MIGRATION_SQL,
  DISCUSSION_MLS_MIGRATION_SQL,
  USERS_AVATAR_IMAGE_MIGRATION_SQL
];
