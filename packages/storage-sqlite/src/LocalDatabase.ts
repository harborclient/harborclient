import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  rowToChat,
  rowToChatMessage,
  rowToChatSummary,
  rowToEnvironment,
  rowToSnippet
} from './entityMappers';
import { trimRequiredName } from './trimRequiredName';
import { generateDocumentUuid } from './uuid';
import { migrateSidebarMarkerColumn, serializeSidebarMarker } from './sidebarMarkerMigration';
import { wouldCreateEnvironmentInheritanceCycle } from '@harborclient/core/environmentTree';
import { readSidebarMarker } from '@harborclient/core/sidebarMarker';
import { DEFAULT_CHAT_TITLE, normalizeChatTitle } from '@harborclient/core/ai/chatTitle';
import { defaultAuth, normalizeAuth, type AuthConfig } from '@harborclient/core/auth';
import { normalizeVariable } from '@harborclient/core/filestore/variables';
import type {
  Chat,
  ChatMessage,
  ChatRole,
  ChatSummary,
  CreateLiveServerInput,
  CreateWebsiteInput,
  CreateWorkflowInput,
  CreateWorkspaceInput,
  Environment,
  KeyValue,
  LiveServer,
  LiveServerAlias,
  LiveServerCorsSettings,
  LiveServerErrorPage,
  LiveServerProxy,
  LiveServerResponseHeader,
  LiveServerRoute,
  LiveServerScriptRef,
  LiveServerSslSettings,
  McpServerLogEntry,
  McpServerLogInput,
  RequestHistoryEntry,
  ScriptRef,
  Snippet,
  UpdateLiveServerInput,
  UpdateWebsiteInput,
  Website,
  WebsiteInjectionScript,
  Workflow,
  WorkflowAction,
  Workspace,
  WorkspaceLayout,
  WorkspaceRequest,
  Variable
} from '@harborclient/core/types';
import {
  normalizeLiveServerConfigFields,
  normalizeLiveServerCorsSettings,
  normalizeWorkflowDelayMs
} from '@harborclient/core/types';
import {
  normalizeWorkspaceLayout,
  serializeWorkspaceLayout
} from '@harborclient/core/types/workspace';
import type { InsertTrashItemInput, TrashItem } from '@harborclient/core/types/trash';
import { MCP_SERVER_LOG_CAP } from '@harborclient/core/types/mcp';
import { REQUEST_HISTORY_CAP } from '@harborclient/core/types/requestHistory';
import {
  WORKFLOW_RUN_HISTORY_CAP,
  type WorkflowRunHistoryEntry,
  type WorkflowRunHistoryPayload
} from '@harborclient/core/types/workflowRunHistory';
import type { SnippetScope } from '@harborclient/core/snippetScope';
import { DEFAULT_SCRIPT_STAGE, normalizeScriptStage } from '@harborclient/core/scriptStage';
import type { ScriptStage } from '@harborclient/sdk';

const REGISTRY_DB_FILENAME = 'harborclient-registry.db';
const ENVIRONMENT_COLUMNS = 'id, uuid, name, variables, created_at, marker, parent_uuid';
const WORKSPACE_COLUMNS = 'id, name, created_at, updated_at, marker, layout';
const WORKFLOW_COLUMNS =
  'id, uuid, name, payload, duration_ms, sort_order, created_at, updated_at, archived';
const WEBSITE_COLUMNS = 'id, uuid, name, payload, sort_order, created_at, updated_at';
const LIVE_SERVER_COLUMNS = 'id, uuid, name, payload, sort_order, created_at, updated_at';

/**
 * Stored JSON payload for a live server row.
 *
 * Expanded fields (`openPath`, `host`, `headers`, `ssl`, …) are always written
 * in normalized form. Legacy rows missing keys are filled by
 * {@link parseLiveServerPayload} via {@link normalizeLiveServerConfigFields}.
 */
interface LiveServerPayloadJson {
  root: string;
  port: number | null;
  aliases: LiveServerAlias[];
  watch: boolean;
  cors: LiveServerCorsSettings;
  openPath: string;
  openPathOnStartup: boolean;
  rememberLastUrl: boolean;
  lastOpenedPath: string | null;
  indexFiles: string[];
  host: string;
  headers: LiveServerResponseHeader[];
  routes: LiveServerRoute[];
  errorPages: LiveServerErrorPage[];
  proxies: LiveServerProxy[];
  ssl: LiveServerSslSettings;
  runCommand: string;
  runtimeId: string;
  runCommandEnabled: boolean;
  runCommandEnv: KeyValue[];
  restartOnCrash: boolean;
  urlVariable: string;
  preRequestScripts: LiveServerScriptRef[];
  postRequestScripts: LiveServerScriptRef[];
}

/**
 * Returns an empty live-server payload used when stored JSON is corrupt.
 *
 * @returns Normalized empty payload with defaults for all expanded fields.
 */
function emptyLiveServerPayload(): LiveServerPayloadJson {
  const fields = normalizeLiveServerConfigFields(undefined);
  return {
    root: '',
    port: null,
    aliases: [],
    watch: true,
    cors: normalizeLiveServerCorsSettings(undefined),
    ...fields
  };
}

/**
 * Stored JSON payload for a workflow row.
 */
interface WorkflowPayloadJson {
  variables: Record<string, string>;
  actions: WorkflowAction[];
  /**
   * Pause between consecutive actions during playback, in milliseconds.
   */
  delayMs?: number;
}

/**
 * Stored JSON payload for a website row.
 */
interface WebsitePayloadJson {
  url: string;
  homeUrl: string;
  faviconDataUrl: string | null;
  scripts: WebsiteInjectionScript[];
  preRequestScripts: ScriptRef[];
  postRequestScripts: ScriptRef[];
  variables: Variable[];
  headers: KeyValue[];
  userAgent: string;
  auth: AuthConfig;
}

/**
 * Normalizes a partial key/value row from website payload JSON.
 *
 * @param row - Raw header row candidate.
 * @returns Normalized KeyValue, or null when the row is not an object.
 */
function normalizeWebsiteKeyValue(row: unknown): KeyValue | null {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const candidate = row as Partial<KeyValue>;
  return {
    key: typeof candidate.key === 'string' ? candidate.key : '',
    value: typeof candidate.value === 'string' ? candidate.value : '',
    enabled: candidate.enabled !== false
  };
}

/**
 * Empty website payload used when JSON parse fails or fields are missing.
 *
 * @returns Default website payload fields.
 */
function emptyWebsitePayload(): WebsitePayloadJson {
  return {
    url: 'about:blank',
    homeUrl: 'about:blank',
    faviconDataUrl: null,
    scripts: [],
    preRequestScripts: [],
    postRequestScripts: [],
    variables: [],
    headers: [],
    userAgent: '',
    auth: defaultAuth()
  };
}

/**
 * Row shape returned from mcp_server_logs queries.
 */
interface McpServerLogRow {
  id: number;
  ts: number;
  direction: string;
  kind: string;
  method: string | null;
  path: string | null;
  rpc_method: string | null;
  tool_name: string | null;
  status_code: number | null;
  ok: number | null;
  duration_ms: number | null;
  session_id: string | null;
  error: string | null;
}

/**
 * Maps a database row to a {@link McpServerLogEntry}.
 *
 * @param row - SQLite row from mcp_server_logs.
 * @returns Parsed MCP server log entry for the UI.
 */
function rowToMcpServerLogEntry(row: McpServerLogRow): McpServerLogEntry {
  const direction = row.direction === 'out' ? 'out' : 'in';
  const kind =
    row.kind === 'session' || row.kind === 'tool' || row.kind === 'lifecycle' ? row.kind : 'http';

  return {
    id: row.id,
    timestamp: row.ts,
    direction,
    kind,
    ...(row.method != null ? { method: row.method } : {}),
    ...(row.path != null ? { path: row.path } : {}),
    ...(row.rpc_method != null ? { rpcMethod: row.rpc_method } : {}),
    ...(row.tool_name != null ? { toolName: row.tool_name } : {}),
    ...(row.status_code != null ? { statusCode: row.status_code } : {}),
    ...(row.ok != null ? { ok: row.ok === 1 } : {}),
    ...(row.duration_ms != null ? { durationMs: row.duration_ms } : {}),
    ...(row.session_id != null ? { sessionId: row.session_id } : {}),
    ...(row.error != null ? { error: row.error } : {})
  };
}

/**
 * Row shape returned from request_history queries.
 */
interface RequestHistoryRow {
  id: number;
  method: string;
  url: string;
  status: number;
  status_text: string;
  ts: number;
  saved_request_id: number | null;
  name: string | null;
  headers: string;
  params: string;
  body: string | null;
  body_type: string | null;
  response_headers: string | null;
  response_body: string | null;
  kind: string | null;
  run_collection_id: number | null;
  run_folder_id: number | null;
  run_request_id: number | null;
}

/**
 * Row shape returned from trash_items queries.
 */
interface TrashItemRow {
  id: number;
  entity_type: string;
  label: string;
  connection_id: string | null;
  original_ids: string;
  payload: string;
  deleted_at: string;
}

/**
 * Keys for corrupt JSON columns that have already been logged this process.
 * Prevents list/refresh spam while still surfacing each distinct failure once.
 */
const loggedCorruptJsonKeys = new Set<string>();

/**
 * Logs a corrupt JSON column once per process for a given row key.
 *
 * @param key - Stable identity such as `trash:12:payload`.
 * @param message - Warning text describing the failure.
 */
function logCorruptJsonOnce(key: string, message: string): void {
  if (loggedCorruptJsonKeys.has(key)) {
    return;
  }
  loggedCorruptJsonKeys.add(key);
  console.warn(message);
}

/**
 * Parses a JSON column with a fallback, marking corruption and logging once on failure.
 *
 * @param raw - Stored JSON string.
 * @param fallback - Value used when parsing fails.
 * @param logKey - Stable key for one-time logging.
 * @param message - Warning text when the column is corrupt.
 * @returns Parsed value and whether parsing failed.
 */
function parseJsonColumnWithCorruption<T>(
  raw: string,
  fallback: T,
  logKey: string,
  message: string
): { value: T; corrupt: boolean } {
  try {
    return { value: JSON.parse(raw) as T, corrupt: false };
  } catch {
    logCorruptJsonOnce(logKey, message);
    return { value: fallback, corrupt: true };
  }
}

/**
 * Maps a database row to a {@link TrashItem}.
 *
 * @param row - SQLite row from trash_items.
 * @returns Parsed trash item for the sidebar and restore flows.
 */
function rowToTrashItem(row: TrashItemRow): TrashItem {
  const originalIdsParsed = parseJsonColumnWithCorruption<Record<string, unknown>>(
    row.original_ids,
    {},
    `trash:${row.id}:original_ids`,
    `Corrupt trash original_ids JSON for id ${row.id}; using empty object.`
  );
  const payloadParsed = parseJsonColumnWithCorruption<unknown>(
    row.payload,
    null,
    `trash:${row.id}:payload`,
    `Corrupt trash payload JSON for id ${row.id}; using null.`
  );

  return {
    id: row.id,
    entityType: row.entity_type as TrashItem['entityType'],
    label: row.label,
    connectionId: row.connection_id,
    originalIds: originalIdsParsed.value,
    payload: payloadParsed.value,
    deletedAt: row.deleted_at,
    ...(originalIdsParsed.corrupt || payloadParsed.corrupt ? { corrupt: true } : {})
  };
}

/**
 * Parses stored request headers JSON, falling back to an empty object.
 *
 * @param raw - JSON-encoded headers column value.
 * @param logKey - Stable key for one-time corruption logging.
 * @returns Parsed headers and whether the column was corrupt.
 */
function parseRequestHistoryHeaders(
  raw: string,
  logKey: string
): { headers: Record<string, string>; corrupt: boolean } {
  const parsed = parseJsonColumnWithCorruption<Record<string, string>>(
    raw,
    {},
    logKey,
    `Corrupt request history headers JSON (${logKey}); using empty object.`
  );
  return { headers: parsed.value, corrupt: parsed.corrupt };
}

/**
 * Parses stored query parameters JSON, falling back to an empty list.
 *
 * @param raw - JSON-encoded params column value.
 * @param logKey - Stable key for one-time corruption logging.
 * @returns Parsed query parameters and whether the column was corrupt.
 */
function parseRequestHistoryParams(
  raw: string,
  logKey: string
): { params: RequestHistoryEntry['params']; corrupt: boolean } {
  const parsed = parseJsonColumnWithCorruption<RequestHistoryEntry['params']>(
    raw,
    [],
    logKey,
    `Corrupt request history params JSON (${logKey}); using empty list.`
  );
  return { params: parsed.value, corrupt: parsed.corrupt };
}

/**
 * Maps a database row to a {@link RequestHistoryEntry}.
 *
 * @param row - SQLite row from request_history.
 * @returns Parsed request history entry for the UI and editor.
 */
function rowToRequestHistoryEntry(row: RequestHistoryRow): RequestHistoryEntry {
  const kind = row.kind === 'run' ? 'run' : row.kind === 'request' ? 'request' : undefined;
  const headersParsed = parseRequestHistoryHeaders(row.headers, `history:${row.id}:headers`);
  const paramsParsed = parseRequestHistoryParams(row.params, `history:${row.id}:params`);
  const responseHeadersParsed =
    row.response_headers != null
      ? parseRequestHistoryHeaders(row.response_headers, `history:${row.id}:response_headers`)
      : null;
  const corrupt =
    headersParsed.corrupt || paramsParsed.corrupt || (responseHeadersParsed?.corrupt ?? false);

  return {
    id: row.id,
    method: row.method,
    url: row.url,
    status: row.status,
    statusText: row.status_text,
    ts: row.ts,
    savedRequestId: row.saved_request_id ?? undefined,
    name: row.name ?? undefined,
    headers: headersParsed.headers,
    params: paramsParsed.params,
    body: row.body ?? undefined,
    bodyType: (row.body_type as RequestHistoryEntry['bodyType'] | null) ?? undefined,
    responseHeaders: responseHeadersParsed?.headers,
    responseBody: row.response_body ?? undefined,
    kind,
    runCollectionId: row.run_collection_id ?? undefined,
    runFolderId: row.run_folder_id,
    runRequestId: row.run_request_id,
    ...(corrupt ? { corrupt: true } : {})
  };
}

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

  /**
   * When true, the collection is hidden from the Collections tree and listed
   * in the Archive sidebar section instead.
   */
  archived: boolean;

  /**
   * Remote URL this collection was imported from, when present.
   * Used to re-download and merge updates via the sidebar Refresh action.
   */
  sourceUrl?: string | null;
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
  /**
   * Remote URL this collection was imported from, when present.
   */
  sourceUrl?: string | null;
}

/**
 * Mutable fields of a registry entry.
 */
export type UpdateRegistryEntryInput = Partial<
  Pick<
    CollectionRegistryEntry,
    'name' | 'connectionId' | 'providerCollectionId' | 'collectionUuid' | 'sourceUrl'
  >
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
 * A single entry in the local live-server routing registry.
 */
export interface LiveServerRegistryEntry {
  id: number;
  name: string;
  uuid: string;
  connectionId: string;
  providerLiveServerId: number;
  created_at: string;
}

/**
 * Input for creating a live-server registry entry.
 */
export interface AddLiveServerRegistryEntryInput {
  id?: number;
  name: string;
  connectionId: string;
  providerLiveServerId: number;
  uuid?: string;
}

/**
 * Mutable fields of a live-server registry entry.
 */
export type UpdateLiveServerRegistryEntryInput = Partial<
  Pick<LiveServerRegistryEntry, 'name' | 'connectionId' | 'providerLiveServerId' | 'uuid'>
>;

/**
 * A single entry in the local live-page routing registry.
 */
export interface LivePageRegistryEntry {
  id: number;
  name: string;
  uuid: string;
  connectionId: string;
  providerLivePageId: number;
  created_at: string;
}

/**
 * Input for creating a live-page registry entry.
 */
export interface AddLivePageRegistryEntryInput {
  id?: number;
  name: string;
  connectionId: string;
  providerLivePageId: number;
  uuid?: string;
}

/**
 * Mutable fields of a live-page registry entry.
 */
export type UpdateLivePageRegistryEntryInput = Partial<
  Pick<LivePageRegistryEntry, 'name' | 'connectionId' | 'providerLivePageId' | 'uuid'>
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
 * Maps a raw SQLite row to a live-server registry entry.
 *
 * @param row - SQLite result row using database column names.
 * @returns Registry metadata using application field names.
 */
function rowToLiveServerRegistryEntry(row: Record<string, unknown>): LiveServerRegistryEntry {
  return {
    id: row.id as number,
    name: row.name as string,
    uuid: (row.uuid as string) ?? '',
    connectionId: row.connection_id as string,
    providerLiveServerId: row.provider_live_server_id as number,
    created_at: row.created_at as string
  };
}

/**
 * Maps a raw SQLite row to a live-page registry entry.
 *
 * @param row - SQLite result row using database column names.
 * @returns Registry metadata using application field names.
 */
function rowToLivePageRegistryEntry(row: Record<string, unknown>): LivePageRegistryEntry {
  return {
    id: row.id as number,
    name: row.name as string,
    uuid: (row.uuid as string) ?? '',
    connectionId: row.connection_id as string,
    providerLivePageId: row.provider_live_page_id as number,
    created_at: row.created_at as string
  };
}

/**
 * Maps a raw SQLite row to a collection registry entry.
 */
function rowToRegistryEntry(row: Record<string, unknown>): CollectionRegistryEntry {
  const sourceUrl =
    typeof row.source_url === 'string' && row.source_url.trim().length > 0
      ? row.source_url.trim()
      : null;
  return {
    id: row.id as number,
    name: row.name as string,
    collectionUuid: (row.collection_uuid as string) ?? '',
    connectionId: row.connection_id as string,
    providerCollectionId: row.provider_collection_id as number,
    created_at: row.created_at as string,
    archived: Boolean(row.archived),
    sourceUrl
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

      // Must run before CREATE TABLE IF NOT EXISTS workspaces so we do not
      // create an empty workspaces table alongside the legacy tab_groups table.
      this.migrateLegacyTabGroupTables();

      this.#db.exec(`
      CREATE TABLE IF NOT EXISTS collection_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        connection_id TEXT NOT NULL,
        provider_collection_id INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        source_url TEXT,
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
        reference_snapshots TEXT,
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

      CREATE TABLE IF NOT EXISTS live_server_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        uuid TEXT NOT NULL DEFAULT '',
        connection_id TEXT NOT NULL,
        provider_live_server_id INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS live_page_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        uuid TEXT NOT NULL DEFAULT '',
        connection_id TEXT NOT NULL,
        provider_live_page_id INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS live_server_local_state (
        uuid TEXT PRIMARY KEY,
        last_opened_path TEXT
      );

      CREATE TABLE IF NOT EXISTS request_history (
        id               INTEGER PRIMARY KEY,
        method           TEXT    NOT NULL,
        url              TEXT    NOT NULL,
        status           INTEGER NOT NULL,
        status_text      TEXT    NOT NULL,
        ts               INTEGER NOT NULL,
        saved_request_id INTEGER,
        name             TEXT,
        headers          TEXT    NOT NULL DEFAULT '{}',
        params           TEXT    NOT NULL DEFAULT '[]',
        body             TEXT,
        body_type        TEXT,
        response_headers TEXT,
        response_body    TEXT,
        kind             TEXT,
        run_collection_id INTEGER,
        run_folder_id    INTEGER,
        run_request_id   INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_request_history_ts ON request_history (ts DESC);

      CREATE TABLE IF NOT EXISTS mcp_server_logs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        ts           INTEGER NOT NULL,
        direction    TEXT    NOT NULL,
        kind         TEXT    NOT NULL,
        method       TEXT,
        path         TEXT,
        rpc_method   TEXT,
        tool_name    TEXT,
        status_code  INTEGER,
        ok           INTEGER,
        duration_ms  INTEGER,
        session_id   TEXT,
        error        TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_mcp_server_logs_ts ON mcp_server_logs (ts DESC);

      CREATE TABLE IF NOT EXISTS workspaces (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_requests (
        workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        request_uuid  TEXT    NOT NULL,
        collection_id INTEGER,
        request_name  TEXT,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (workspace_id, request_uuid)
      );

      CREATE TABLE IF NOT EXISTS workflows (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid        TEXT    NOT NULL UNIQUE,
        name        TEXT    NOT NULL,
        payload     TEXT    NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        archived    INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS websites (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid       TEXT    NOT NULL UNIQUE,
        name       TEXT    NOT NULL,
        payload    TEXT    NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS live_servers (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid       TEXT    NOT NULL UNIQUE,
        name       TEXT    NOT NULL,
        payload    TEXT    NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_run_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_uuid TEXT    NOT NULL,
        name          TEXT    NOT NULL,
        environment   TEXT    NOT NULL DEFAULT '',
        date_created  TEXT    NOT NULL,
        ts            INTEGER NOT NULL,
        payload       TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_run_history_ts ON workflow_run_history (ts DESC);

      CREATE TABLE IF NOT EXISTS trash_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        label TEXT NOT NULL,
        connection_id TEXT,
        original_ids TEXT NOT NULL,
        payload TEXT NOT NULL,
        deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    }

    this.migratePluginTables();
    this.migrateRegistrySortOrder();
    this.migrateRegistryCollectionUuid();
    this.migrateRegistryArchived();
    this.migrateRegistrySourceUrl();
    this.migrateEnvironmentUuid();
    this.migrateEnvironmentSortOrder();
    this.migrateEnvironmentParentUuid();
    this.migrateSnippetUuid();
    this.migrateSnippetScope();
    this.migrateSnippetStage();
    this.migrateChatMessageRole();
    this.migrateChatMessageReferenceSnapshots();
    this.migrateSnippetMarketplaceFields();
    this.migrateSnippetRegistryTable();
    this.migrateLiveServerRegistryTables();
    this.migrateLivePageRegistryTable();
    this.migrateRequestHistoryTable();
    this.migrateMcpServerLogsTable();
    this.migrateWorkspacesTable();
    this.migrateWorkflowsTable();
    this.migrateWorkflowsArchived();
    this.migrateWebsitesTable();
    this.migrateLiveServersTable();
    this.migrateWorkflowRunHistoryTable();
    this.migrateTrashTable();
    this.migrateLegacyTabGroupTrashItems();
    migrateSidebarMarkerColumn(this.getDb(), 'environments');
    migrateSidebarMarkerColumn(this.getDb(), 'workspaces');
    this.migrateWorkspaceLayoutColumn();
  }

  /**
   * Ensures the workspaces table has a nullable layout TEXT column for UI snapshots.
   */
  private migrateWorkspaceLayoutColumn(): void {
    const database = this.getDb();
    const columns = database.prepare(`PRAGMA table_info(workspaces)`).all() as Array<{
      name: string;
    }>;
    if (columns.some((column) => column.name === 'layout')) {
      return;
    }
    database.exec(`ALTER TABLE workspaces ADD COLUMN layout TEXT`);
  }

  /**
   * Ensures the trash_items table exists on legacy databases.
   */
  private migrateTrashTable(): void {
    this.getDb().exec(`
      CREATE TABLE IF NOT EXISTS trash_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        label TEXT NOT NULL,
        connection_id TEXT,
        original_ids TEXT NOT NULL,
        payload TEXT NOT NULL,
        deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  /**
   * Renames legacy `tab_groups` / `tab_group_requests` tables to `workspaces` /
   * `workspace_requests` when upgrading an existing registry database.
   *
   * Runs before `CREATE TABLE IF NOT EXISTS workspaces` so an empty workspaces
   * table is not created beside the legacy tables. Idempotent: no-ops when the
   * legacy tables are absent or the new tables already exist.
   */
  private migrateLegacyTabGroupTables(): void {
    const db = this.getDb();
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .all() as Array<{ name: string }>;
    const names = new Set(tables.map((row) => row.name));

    if (names.has('tab_groups') && !names.has('workspaces')) {
      // Parent rename rewrites child REFERENCES clauses when legacy_alter_table is off.
      db.exec('ALTER TABLE tab_groups RENAME TO workspaces');
    }

    if (names.has('tab_group_requests') && !names.has('workspace_requests')) {
      db.exec('ALTER TABLE tab_group_requests RENAME TO workspace_requests');
      names.delete('tab_group_requests');
      names.add('workspace_requests');
    }

    if (names.has('workspace_requests')) {
      const requestColumns = db.prepare(`PRAGMA table_info(workspace_requests)`).all() as Array<{
        name: string;
      }>;
      if (
        requestColumns.some((column) => column.name === 'group_id') &&
        !requestColumns.some((column) => column.name === 'workspace_id')
      ) {
        db.exec('ALTER TABLE workspace_requests RENAME COLUMN group_id TO workspace_id');
      }
    }
  }

  /**
   * Rewrites trash snapshot rows that still use the legacy tab-group entity type
   * and JSON keys onto the workspace naming.
   */
  private migrateLegacyTabGroupTrashItems(): void {
    const db = this.getDb();
    const rows = db
      .prepare(`SELECT id, original_ids, payload FROM trash_items WHERE entity_type = 'tabGroup'`)
      .all() as Array<{ id: number; original_ids: string; payload: string }>;

    if (rows.length === 0) {
      return;
    }

    const update = db.prepare(
      `UPDATE trash_items SET entity_type = 'workspace', original_ids = ?, payload = ? WHERE id = ?`
    );

    const migrate = db.transaction(() => {
      for (const row of rows) {
        let originalIds: Record<string, unknown> = {};
        let payload: unknown = null;
        try {
          originalIds = JSON.parse(row.original_ids) as Record<string, unknown>;
        } catch {
          originalIds = {};
        }
        try {
          payload = JSON.parse(row.payload);
        } catch {
          payload = null;
        }

        if (
          Object.prototype.hasOwnProperty.call(originalIds, 'tabGroupId') &&
          !Object.prototype.hasOwnProperty.call(originalIds, 'workspaceId')
        ) {
          originalIds.workspaceId = originalIds.tabGroupId;
          delete originalIds.tabGroupId;
        }

        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const payloadObj = payload as Record<string, unknown>;
          if (
            Object.prototype.hasOwnProperty.call(payloadObj, 'tabGroup') &&
            !Object.prototype.hasOwnProperty.call(payloadObj, 'workspace')
          ) {
            payloadObj.workspace = payloadObj.tabGroup;
            delete payloadObj.tabGroup;
          }
        }

        update.run(JSON.stringify(originalIds), JSON.stringify(payload), row.id);
      }
    });

    migrate();
  }

  /**
   * Ensures workspace tables exist on legacy databases.
   */
  private migrateWorkspacesTable(): void {
    this.getDb().exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_requests (
        workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        request_uuid  TEXT    NOT NULL,
        collection_id INTEGER,
        request_name  TEXT,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (workspace_id, request_uuid)
      );
    `);
  }

  /**
   * Ensures the workflows table exists on legacy databases.
   */
  private migrateWorkflowsTable(): void {
    this.getDb().exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid        TEXT    NOT NULL UNIQUE,
        name        TEXT    NOT NULL,
        payload     TEXT    NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        archived    INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  /**
   * Adds archived to legacy workflow databases when missing.
   */
  private migrateWorkflowsArchived(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(workflows)').all() as Array<{
      name: string;
    }>;
    if (columns.length === 0 || columns.some((col) => col.name === 'archived')) {
      return;
    }
    this.getDb().exec('ALTER TABLE workflows ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
  }

  /**
   * Ensures the websites table exists on legacy databases.
   */
  private migrateWebsitesTable(): void {
    this.getDb().exec(`
      CREATE TABLE IF NOT EXISTS websites (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid       TEXT    NOT NULL UNIQUE,
        name       TEXT    NOT NULL,
        payload    TEXT    NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  /**
   * Ensures the live_servers table exists on legacy databases.
   */
  private migrateLiveServersTable(): void {
    this.getDb().exec(`
      CREATE TABLE IF NOT EXISTS live_servers (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid       TEXT    NOT NULL UNIQUE,
        name       TEXT    NOT NULL,
        payload    TEXT    NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  /**
   * Ensures the workflow run history table exists on legacy databases.
   */
  private migrateWorkflowRunHistoryTable(): void {
    this.getDb().exec(`
      CREATE TABLE IF NOT EXISTS workflow_run_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_uuid TEXT    NOT NULL,
        name          TEXT    NOT NULL,
        environment   TEXT    NOT NULL DEFAULT '',
        date_created  TEXT    NOT NULL,
        ts            INTEGER NOT NULL,
        payload       TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_run_history_ts ON workflow_run_history (ts DESC);
    `);
  }

  /**
   * Ensures the request history table exists on legacy databases.
   */
  private migrateRequestHistoryTable(): void {
    this.getDb().exec(`
      CREATE TABLE IF NOT EXISTS request_history (
        id               INTEGER PRIMARY KEY,
        method           TEXT    NOT NULL,
        url              TEXT    NOT NULL,
        status           INTEGER NOT NULL,
        status_text      TEXT    NOT NULL,
        ts               INTEGER NOT NULL,
        saved_request_id INTEGER,
        name             TEXT,
        headers          TEXT    NOT NULL DEFAULT '{}',
        params           TEXT    NOT NULL DEFAULT '[]',
        body             TEXT,
        body_type        TEXT,
        response_headers TEXT,
        response_body    TEXT,
        kind             TEXT,
        run_collection_id INTEGER,
        run_folder_id    INTEGER,
        run_request_id   INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_request_history_ts ON request_history (ts DESC);
    `);

    const columns = this.getDb().prepare('PRAGMA table_info(request_history)').all() as Array<{
      name: string;
    }>;
    if (columns.length === 0) {
      return;
    }
    if (!columns.some((col) => col.name === 'kind')) {
      this.getDb().exec('ALTER TABLE request_history ADD COLUMN kind TEXT');
    }
    if (!columns.some((col) => col.name === 'run_collection_id')) {
      this.getDb().exec('ALTER TABLE request_history ADD COLUMN run_collection_id INTEGER');
    }
    if (!columns.some((col) => col.name === 'run_folder_id')) {
      this.getDb().exec('ALTER TABLE request_history ADD COLUMN run_folder_id INTEGER');
    }
    if (!columns.some((col) => col.name === 'run_request_id')) {
      this.getDb().exec('ALTER TABLE request_history ADD COLUMN run_request_id INTEGER');
    }
    if (!columns.some((col) => col.name === 'response_headers')) {
      this.getDb().exec('ALTER TABLE request_history ADD COLUMN response_headers TEXT');
    }
    if (!columns.some((col) => col.name === 'response_body')) {
      this.getDb().exec('ALTER TABLE request_history ADD COLUMN response_body TEXT');
    }
  }

  /**
   * Ensures the MCP server logs table exists on legacy databases.
   */
  private migrateMcpServerLogsTable(): void {
    this.getDb().exec(`
      CREATE TABLE IF NOT EXISTS mcp_server_logs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        ts           INTEGER NOT NULL,
        direction    TEXT    NOT NULL,
        kind         TEXT    NOT NULL,
        method       TEXT,
        path         TEXT,
        rpc_method   TEXT,
        tool_name    TEXT,
        status_code  INTEGER,
        ok           INTEGER,
        duration_ms  INTEGER,
        session_id   TEXT,
        error        TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_mcp_server_logs_ts ON mcp_server_logs (ts DESC);
    `);
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
   * Ensures live-server routing and machine-local state tables exist on legacy databases.
   */
  private migrateLiveServerRegistryTables(): void {
    this.getDb().exec(`
      CREATE TABLE IF NOT EXISTS live_server_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        uuid TEXT NOT NULL DEFAULT '',
        connection_id TEXT NOT NULL,
        provider_live_server_id INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS live_server_local_state (
        uuid TEXT PRIMARY KEY,
        last_opened_path TEXT
      );
    `);
  }

  /**
   * Ensures the live-page routing registry exists on legacy databases.
   */
  private migrateLivePageRegistryTable(): void {
    this.getDb().exec(`
      CREATE TABLE IF NOT EXISTS live_page_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        uuid TEXT NOT NULL DEFAULT '',
        connection_id TEXT NOT NULL,
        provider_live_page_id INTEGER NOT NULL,
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
   * Adds archived to legacy registry databases when missing.
   */
  private migrateRegistryArchived(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(collection_registry)').all() as Array<{
      name: string;
    }>;
    if (columns.some((col) => col.name === 'archived')) {
      return;
    }
    this.getDb().exec(
      'ALTER TABLE collection_registry ADD COLUMN archived INTEGER NOT NULL DEFAULT 0'
    );
  }

  /**
   * Adds source_url to legacy registry databases when missing.
   */
  private migrateRegistrySourceUrl(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(collection_registry)').all() as Array<{
      name: string;
    }>;
    if (columns.some((col) => col.name === 'source_url')) {
      return;
    }
    this.getDb().exec('ALTER TABLE collection_registry ADD COLUMN source_url TEXT');
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
   * Adds a nullable JSON column for persisted `@` reference snapshots on chat messages.
   */
  private migrateChatMessageReferenceSnapshots(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(chat_messages)').all() as Array<{
      name: string;
    }>;
    if (columns.length === 0) {
      return;
    }
    if (columns.some((col) => col.name === 'reference_snapshots')) {
      return;
    }
    this.getDb().exec('ALTER TABLE chat_messages ADD COLUMN reference_snapshots TEXT');
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
   * Adds nullable parent_uuid for environment inheritance on legacy databases.
   */
  private migrateEnvironmentParentUuid(): void {
    const columns = this.getDb().prepare('PRAGMA table_info(environments)').all() as Array<{
      name: string;
    }>;
    const hasParentUuid = columns.some((col) => col.name === 'parent_uuid');
    if (hasParentUuid) {
      return;
    }

    this.getDb().exec('ALTER TABLE environments ADD COLUMN parent_uuid TEXT');
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
        'SELECT id, name, collection_uuid, connection_id, provider_collection_id, created_at, archived, source_url FROM collection_registry ORDER BY sort_order ASC, name ASC'
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
        'SELECT id, name, collection_uuid, connection_id, provider_collection_id, created_at, archived, source_url FROM collection_registry WHERE id = ?'
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
        'SELECT id, name, collection_uuid, connection_id, provider_collection_id, created_at, archived, source_url FROM collection_registry WHERE collection_uuid = ?'
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
    const sourceUrl =
      typeof input.sourceUrl === 'string' && input.sourceUrl.trim().length > 0
        ? input.sourceUrl.trim()
        : null;

    if (input.id != null) {
      this.getDb()
        .prepare(
          'INSERT INTO collection_registry (id, name, collection_uuid, connection_id, provider_collection_id, sort_order, source_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          input.id,
          input.name.trim(),
          collectionUuid,
          input.connectionId,
          input.providerCollectionId,
          sortOrder,
          sourceUrl
        );
      const entry = this.getRegistryEntry(input.id);
      if (!entry) throw new Error('Registry entry not found after insert');
      return entry;
    }

    const result = this.getDb()
      .prepare(
        'INSERT INTO collection_registry (name, collection_uuid, connection_id, provider_collection_id, sort_order, source_url) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        input.name.trim(),
        collectionUuid,
        input.connectionId,
        input.providerCollectionId,
        sortOrder,
        sourceUrl
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
    const sourceUrl =
      typeof next.sourceUrl === 'string' && next.sourceUrl.trim().length > 0
        ? next.sourceUrl.trim()
        : null;

    this.getDb()
      .prepare(
        'UPDATE collection_registry SET name = ?, collection_uuid = ?, connection_id = ?, provider_collection_id = ?, source_url = ? WHERE id = ?'
      )
      .run(
        next.name.trim(),
        next.collectionUuid,
        next.connectionId,
        next.providerCollectionId,
        sourceUrl,
        id
      );

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
   * Sets whether a registry entry is archived in the Collections sidebar.
   *
   * @param id - Global collection id.
   * @param archived - When true, hide the collection from the main tree.
   * @returns The updated registry entry.
   */
  setRegistryArchived(id: number, archived: boolean): CollectionRegistryEntry {
    const current = this.getRegistryEntry(id);
    if (!current) throw new Error('Registry entry not found');

    this.getDb()
      .prepare('UPDATE collection_registry SET archived = ? WHERE id = ?')
      .run(archived ? 1 : 0, id);

    const updated = this.getRegistryEntry(id);
    if (!updated) throw new Error('Registry entry not found after update');
    return updated;
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
   * Lists live-server registry entries in stable display order.
   *
   * @returns Registry entries with provider routing metadata.
   */
  listLiveServerRegistry(): LiveServerRegistryEntry[] {
    const rows = this.getDb()
      .prepare(
        'SELECT id, name, uuid, connection_id, provider_live_server_id, created_at FROM live_server_registry ORDER BY sort_order ASC, name ASC'
      )
      .all() as Record<string, unknown>[];
    return rows.map(rowToLiveServerRegistryEntry);
  }

  /**
   * Looks up a live-server registry entry by global id.
   *
   * @param id - Stable global live-server id.
   * @returns The entry when found, otherwise undefined.
   */
  getLiveServerRegistryEntry(id: number): LiveServerRegistryEntry | undefined {
    const row = this.getDb()
      .prepare(
        'SELECT id, name, uuid, connection_id, provider_live_server_id, created_at FROM live_server_registry WHERE id = ?'
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToLiveServerRegistryEntry(row) : undefined;
  }

  /**
   * Registers a live server with its provider routing metadata.
   *
   * @param input - Registry fields, optionally including a preserved global id.
   * @returns The persisted registry entry.
   */
  addLiveServerRegistryEntry(input: AddLiveServerRegistryEntryInput): LiveServerRegistryEntry {
    const sortOrder = this.nextLiveServerRegistrySortOrder();
    const uuid = input.uuid?.trim() ?? '';
    if (input.id != null) {
      this.getDb()
        .prepare(
          'INSERT INTO live_server_registry (id, name, uuid, connection_id, provider_live_server_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(
          input.id,
          input.name.trim(),
          uuid,
          input.connectionId,
          input.providerLiveServerId,
          sortOrder
        );
      const entry = this.getLiveServerRegistryEntry(input.id);
      if (!entry) throw new Error('Live-server registry entry not found after insert');
      return entry;
    }

    const result = this.getDb()
      .prepare(
        'INSERT INTO live_server_registry (name, uuid, connection_id, provider_live_server_id, sort_order) VALUES (?, ?, ?, ?, ?)'
      )
      .run(input.name.trim(), uuid, input.connectionId, input.providerLiveServerId, sortOrder);
    const entry = this.getLiveServerRegistryEntry(Number(result.lastInsertRowid));
    if (!entry) throw new Error('Live-server registry entry not found after insert');
    return entry;
  }

  /**
   * Updates live-server registry routing metadata.
   *
   * @param id - Stable global live-server id.
   * @param fields - Partial registry fields to merge.
   * @returns The updated registry entry.
   */
  updateLiveServerRegistryEntry(
    id: number,
    fields: UpdateLiveServerRegistryEntryInput
  ): LiveServerRegistryEntry {
    const current = this.getLiveServerRegistryEntry(id);
    if (!current) throw new Error('Live-server registry entry not found');
    const next = { ...current, ...fields };
    this.getDb()
      .prepare(
        'UPDATE live_server_registry SET name = ?, uuid = ?, connection_id = ?, provider_live_server_id = ? WHERE id = ?'
      )
      .run(next.name.trim(), next.uuid, next.connectionId, next.providerLiveServerId, id);
    const updated = this.getLiveServerRegistryEntry(id);
    if (!updated) throw new Error('Live-server registry entry not found after update');
    return updated;
  }

  /**
   * Removes a live server from the routing registry.
   *
   * @param id - Stable global live-server id.
   */
  deleteLiveServerRegistryEntry(id: number): void {
    this.getDb().prepare('DELETE FROM live_server_registry WHERE id = ?').run(id);
  }

  /**
   * Returns the next insertion order for live-server registry entries.
   *
   * @returns Next zero-based sort order.
   */
  private nextLiveServerRegistrySortOrder(): number {
    const row = this.getDb()
      .prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM live_server_registry')
      .get() as { max_order: number };
    return row.max_order + 1;
  }

  /**
   * Lists live-page registry entries in stable display order.
   *
   * @returns Registry entries with provider routing metadata.
   */
  listLivePageRegistry(): LivePageRegistryEntry[] {
    const rows = this.getDb()
      .prepare(
        'SELECT id, name, uuid, connection_id, provider_live_page_id, created_at FROM live_page_registry ORDER BY sort_order ASC, name ASC'
      )
      .all() as Record<string, unknown>[];
    return rows.map(rowToLivePageRegistryEntry);
  }

  /**
   * Looks up a live-page registry entry by global id.
   *
   * @param id - Stable global live-page id.
   * @returns The entry when found, otherwise undefined.
   */
  getLivePageRegistryEntry(id: number): LivePageRegistryEntry | undefined {
    const row = this.getDb()
      .prepare(
        'SELECT id, name, uuid, connection_id, provider_live_page_id, created_at FROM live_page_registry WHERE id = ?'
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToLivePageRegistryEntry(row) : undefined;
  }

  /**
   * Registers a live page with its provider routing metadata.
   *
   * @param input - Registry fields, optionally including a preserved global id.
   * @returns The persisted registry entry.
   */
  addLivePageRegistryEntry(input: AddLivePageRegistryEntryInput): LivePageRegistryEntry {
    const sortOrder = this.nextLivePageRegistrySortOrder();
    const uuid = input.uuid?.trim() ?? '';
    if (input.id != null) {
      this.getDb()
        .prepare(
          'INSERT INTO live_page_registry (id, name, uuid, connection_id, provider_live_page_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(
          input.id,
          input.name.trim(),
          uuid,
          input.connectionId,
          input.providerLivePageId,
          sortOrder
        );
      const entry = this.getLivePageRegistryEntry(input.id);
      if (!entry) throw new Error('Live-page registry entry not found after insert');
      return entry;
    }

    const result = this.getDb()
      .prepare(
        'INSERT INTO live_page_registry (name, uuid, connection_id, provider_live_page_id, sort_order) VALUES (?, ?, ?, ?, ?)'
      )
      .run(input.name.trim(), uuid, input.connectionId, input.providerLivePageId, sortOrder);
    const entry = this.getLivePageRegistryEntry(Number(result.lastInsertRowid));
    if (!entry) throw new Error('Live-page registry entry not found after insert');
    return entry;
  }

  /**
   * Updates live-page registry routing metadata.
   *
   * @param id - Stable global live-page id.
   * @param fields - Partial registry fields to merge.
   * @returns The updated registry entry.
   */
  updateLivePageRegistryEntry(
    id: number,
    fields: UpdateLivePageRegistryEntryInput
  ): LivePageRegistryEntry {
    const current = this.getLivePageRegistryEntry(id);
    if (!current) throw new Error('Live-page registry entry not found');
    const next = { ...current, ...fields };
    this.getDb()
      .prepare(
        'UPDATE live_page_registry SET name = ?, uuid = ?, connection_id = ?, provider_live_page_id = ? WHERE id = ?'
      )
      .run(next.name.trim(), next.uuid, next.connectionId, next.providerLivePageId, id);
    const updated = this.getLivePageRegistryEntry(id);
    if (!updated) throw new Error('Live-page registry entry not found after update');
    return updated;
  }

  /**
   * Removes a live page from the routing registry.
   *
   * @param id - Stable global live-page id.
   */
  deleteLivePageRegistryEntry(id: number): void {
    this.getDb().prepare('DELETE FROM live_page_registry WHERE id = ?').run(id);
  }

  /**
   * Returns the next insertion order for live-page registry entries.
   *
   * @returns Next zero-based sort order.
   */
  private nextLivePageRegistrySortOrder(): number {
    const row = this.getDb()
      .prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM live_page_registry')
      .get() as { max_order: number };
    return row.max_order + 1;
  }

  /**
   * Reads the machine-local last path opened for a live server.
   *
   * @param uuid - Portable live-server uuid.
   * @returns The saved path, or null when no local path is stored.
   */
  getLiveServerLocalLastOpenedPath(uuid: string): string | null {
    const row = this.getDb()
      .prepare('SELECT last_opened_path FROM live_server_local_state WHERE uuid = ?')
      .get(uuid) as { last_opened_path: string | null } | undefined;
    return row?.last_opened_path ?? null;
  }

  /**
   * Stores or clears the machine-local last path opened for a live server.
   *
   * @param uuid - Portable live-server uuid.
   * @param path - Last opened path, or null to clear local state.
   */
  setLiveServerLocalLastOpenedPath(uuid: string, path: string | null): void {
    if (path == null) {
      this.getDb().prepare('DELETE FROM live_server_local_state WHERE uuid = ?').run(uuid);
      return;
    }
    this.getDb()
      .prepare(
        `INSERT INTO live_server_local_state (uuid, last_opened_path) VALUES (?, ?)
         ON CONFLICT(uuid) DO UPDATE SET last_opened_path = excluded.last_opened_path`
      )
      .run(uuid, path);
  }

  /**
   * Lists all environments ordered for sidebar display.
   *
   * @returns All environments in the database.
   */
  listEnvironments(): Environment[] {
    const rows = this.getDb()
      .prepare(`SELECT ${ENVIRONMENT_COLUMNS} FROM environments ORDER BY sort_order ASC, name ASC`)
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
      .prepare(`SELECT ${ENVIRONMENT_COLUMNS} FROM environments WHERE uuid = ?`)
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
      .prepare(`SELECT ${ENVIRONMENT_COLUMNS} FROM environments WHERE id = ?`)
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
        'INSERT INTO environments (id, uuid, name, variables, sort_order, created_at, marker, parent_uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        environment.id,
        environmentUuid,
        environment.name.trim(),
        JSON.stringify(environment.variables),
        sortOrder,
        environment.created_at,
        serializeSidebarMarker(environment.marker),
        environment.parentUuid?.trim() || null
      );

    const row = this.getDb()
      .prepare(`SELECT ${ENVIRONMENT_COLUMNS} FROM environments WHERE id = ?`)
      .get(environment.id) as Record<string, unknown>;

    return rowToEnvironment(row);
  }

  /**
   * Updates an environment's name, variables, and optional parent link.
   *
   * @param id - Environment ID to update.
   * @param name - New display name.
   * @param variables - Environment-scoped variables.
   * @param parentUuid - Parent environment uuid; `null` clears; omit to leave unchanged.
   * @returns The updated environment.
   */
  updateEnvironment(
    id: number,
    name: string,
    variables: Variable[],
    parentUuid?: string | null
  ): Environment {
    const trimmedName = trimRequiredName(name, 'Environment name');
    if (parentUuid === undefined) {
      this.getDb()
        .prepare('UPDATE environments SET name = ?, variables = ? WHERE id = ?')
        .run(trimmedName, JSON.stringify(variables), id);
    } else {
      const normalizedParent = parentUuid?.trim() || null;
      if (normalizedParent) {
        const parent = this.findEnvironmentByUuid(normalizedParent);
        if (!parent) {
          throw new Error(`Parent environment not found: ${normalizedParent}`);
        }
        if (parent.id === id) {
          throw new Error('An environment cannot inherit from itself');
        }
        const current = this.listEnvironments().find((environment) => environment.id === id);
        if (!current) {
          throw new Error('Environment not found');
        }
        if (
          wouldCreateEnvironmentInheritanceCycle(
            current.uuid,
            normalizedParent,
            this.listEnvironments()
          )
        ) {
          throw new Error('Environment inheritance cycle detected');
        }
      }
      this.getDb()
        .prepare('UPDATE environments SET name = ?, variables = ?, parent_uuid = ? WHERE id = ?')
        .run(trimmedName, JSON.stringify(variables), normalizedParent, id);
    }

    const row = this.getDb()
      .prepare(`SELECT ${ENVIRONMENT_COLUMNS} FROM environments WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;

    if (!row) throw new Error('Environment not found');
    return rowToEnvironment(row);
  }

  /**
   * Updates an environment's sidebar marker.
   *
   * @param id - Environment ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated environment.
   */
  setEnvironmentMarker(id: number, marker: string | null): Environment {
    this.getDb()
      .prepare('UPDATE environments SET marker = ? WHERE id = ?')
      .run(serializeSidebarMarker(marker), id);

    const row = this.getDb()
      .prepare(`SELECT ${ENVIRONMENT_COLUMNS} FROM environments WHERE id = ?`)
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
      source.variables.map((variable) => ({ ...variable })),
      source.parentUuid ?? null
    );
  }

  /**
   * Deletes an environment and orphans any direct children (clears their parent_uuid).
   *
   * @param id - Environment ID to delete.
   */
  deleteEnvironment(id: number): void {
    const source = this.listEnvironments().find((environment) => environment.id === id);
    const deleteRow = this.getDb().transaction(() => {
      if (source?.uuid) {
        this.getDb()
          .prepare('UPDATE environments SET parent_uuid = NULL WHERE parent_uuid = ?')
          .run(source.uuid);
      }
      this.getDb().prepare('DELETE FROM environments WHERE id = ?').run(id);
    });
    deleteRow();
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
      .prepare(
        `SELECT c.id, c.title, c.model, c.updated_at,
          (SELECT COUNT(*) FROM chat_messages m WHERE m.chat_id = c.id) AS message_count
         FROM chats c
         ORDER BY c.updated_at DESC, c.id DESC`
      )
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
        'SELECT id, chat_id, role, content, model, reference_snapshots, created_at FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC, id ASC'
      )
      .all(id) as Record<string, unknown>[];

    return rowToChat(summaryRow, messageRows);
  }

  /**
   * Appends a message to a chat and updates the chat timestamp.
   *
   * @param input - Chat id, role, content, optional model, and optional reference snapshots.
   * @returns The persisted message.
   */
  addChatMessage(input: {
    chatId: number;
    role: ChatRole;
    content: string;
    model?: string;
    referenceSnapshots?: ChatMessage['referenceSnapshots'];
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

    const referenceSnapshotsJson =
      input.referenceSnapshots != null && Object.keys(input.referenceSnapshots).length > 0
        ? JSON.stringify(input.referenceSnapshots)
        : null;

    const result = this.getDb()
      .prepare(
        'INSERT INTO chat_messages (chat_id, role, content, model, reference_snapshots) VALUES (?, ?, ?, ?, ?)'
      )
      .run(input.chatId, input.role, content, input.model ?? null, referenceSnapshotsJson);

    this.getDb()
      .prepare("UPDATE chats SET updated_at = datetime('now') WHERE id = ?")
      .run(input.chatId);

    const row = this.getDb()
      .prepare(
        'SELECT id, chat_id, role, content, model, reference_snapshots, created_at FROM chat_messages WHERE id = ?'
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
   * Loads persisted MCP server log entries, oldest first for terminal display.
   *
   * @param cap - Maximum number of entries to return.
   * @returns MCP server log entries ordered oldest-first.
   */
  listMcpServerLogs(cap = MCP_SERVER_LOG_CAP): McpServerLogEntry[] {
    const rows = this.getDb()
      .prepare(
        `SELECT id, ts, direction, kind, method, path, rpc_method, tool_name, status_code, ok,
                duration_ms, session_id, error
         FROM mcp_server_logs
         ORDER BY ts DESC, id DESC
         LIMIT ?`
      )
      .all(cap) as McpServerLogRow[];

    return rows.map(rowToMcpServerLogEntry).reverse();
  }

  /**
   * Inserts a sanitized MCP server log entry and prunes older rows beyond the cap.
   *
   * @param entry - Log fields to persist (id assigned by SQLite).
   * @param cap - Maximum number of entries to retain.
   * @returns The inserted row including its assigned id.
   */
  appendMcpServerLog(entry: McpServerLogInput, cap = MCP_SERVER_LOG_CAP): McpServerLogEntry {
    const db = this.getDb();
    const insert = db.prepare(
      `INSERT INTO mcp_server_logs
        (ts, direction, kind, method, path, rpc_method, tool_name, status_code, ok, duration_ms,
         session_id, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const prune = db.prepare(
      `DELETE FROM mcp_server_logs
       WHERE id NOT IN (
         SELECT id FROM mcp_server_logs ORDER BY ts DESC, id DESC LIMIT ?
       )`
    );

    let insertedId = 0;
    const transaction = db.transaction(() => {
      const result = insert.run(
        entry.timestamp,
        entry.direction,
        entry.kind,
        entry.method ?? null,
        entry.path ?? null,
        entry.rpcMethod ?? null,
        entry.toolName ?? null,
        entry.statusCode ?? null,
        entry.ok == null ? null : entry.ok ? 1 : 0,
        entry.durationMs ?? null,
        entry.sessionId ?? null,
        entry.error ?? null
      );
      insertedId = Number(result.lastInsertRowid);
      prune.run(cap);
    });

    transaction();
    return {
      ...entry,
      id: insertedId
    };
  }

  /**
   * Loads persisted request history entries, newest first.
   *
   * @param cap - Maximum number of entries to return.
   * @returns Request history entries ordered newest-first.
   */
  listRequestHistory(cap = REQUEST_HISTORY_CAP): RequestHistoryEntry[] {
    const rows = this.getDb()
      .prepare(
        `SELECT id, method, url, status, status_text, ts, saved_request_id, name, headers, params, body, body_type,
                response_headers, response_body, kind, run_collection_id, run_folder_id, run_request_id
         FROM request_history
         ORDER BY ts DESC
         LIMIT ?`
      )
      .all(cap) as RequestHistoryRow[];

    return rows.map(rowToRequestHistoryEntry);
  }

  /**
   * Inserts a request history entry and prunes older rows beyond the cap.
   *
   * @param entry - Captured request to persist.
   * @param cap - Maximum number of entries to retain.
   * @returns Updated request history list ordered newest-first.
   */
  addRequestHistory(entry: RequestHistoryEntry, cap = REQUEST_HISTORY_CAP): RequestHistoryEntry[] {
    const db = this.getDb();
    const insert = db.prepare(
      `INSERT OR REPLACE INTO request_history
        (id, method, url, status, status_text, ts, saved_request_id, name, headers, params, body, body_type,
         response_headers, response_body, kind, run_collection_id, run_folder_id, run_request_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const prune = db.prepare(
      `DELETE FROM request_history
       WHERE id NOT IN (
         SELECT id FROM request_history ORDER BY ts DESC LIMIT ?
       )`
    );

    const transaction = db.transaction(() => {
      insert.run(
        entry.id,
        entry.method,
        entry.url,
        entry.status,
        entry.statusText,
        entry.ts,
        entry.savedRequestId ?? null,
        entry.name ?? null,
        JSON.stringify(entry.headers ?? {}),
        JSON.stringify(entry.params ?? []),
        entry.body ?? null,
        entry.bodyType ?? null,
        entry.responseHeaders != null ? JSON.stringify(entry.responseHeaders) : null,
        entry.responseBody ?? null,
        entry.kind ?? null,
        entry.runCollectionId ?? null,
        entry.runFolderId ?? null,
        entry.runRequestId ?? null
      );
      prune.run(cap);
    });

    transaction();
    return this.listRequestHistory(cap);
  }

  /**
   * Removes all persisted request history entries.
   */
  clearRequestHistory(): void {
    this.getDb().prepare('DELETE FROM request_history').run();
  }

  /**
   * Removes one persisted request history entry by id.
   *
   * @param id - History entry id to delete.
   * @param cap - Maximum number of entries to return after deletion.
   * @returns Updated request history list ordered newest-first.
   */
  deleteRequestHistory(id: number, cap = REQUEST_HISTORY_CAP): RequestHistoryEntry[] {
    this.getDb().prepare('DELETE FROM request_history WHERE id = ?').run(id);
    return this.listRequestHistory(cap);
  }

  /**
   * Loads one persisted request history entry by id.
   *
   * @param id - History entry id to load.
   * @returns The history entry when found, otherwise null.
   */
  getRequestHistoryEntry(id: number): RequestHistoryEntry | null {
    const row = this.getDb()
      .prepare(
        `SELECT id, method, url, status, status_text, ts, saved_request_id, name, headers, params, body, body_type,
                response_headers, response_body, kind, run_collection_id, run_folder_id, run_request_id
         FROM request_history
         WHERE id = ?`
      )
      .get(id) as RequestHistoryRow | undefined;

    return row ? rowToRequestHistoryEntry(row) : null;
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

  /**
   * Loads all workspaces with their saved request members.
   *
   * @returns Workspaces ordered by sort order then name.
   */
  listWorkspaces(): Workspace[] {
    const workspaceRows = this.getDb()
      .prepare(`SELECT ${WORKSPACE_COLUMNS} FROM workspaces ORDER BY sort_order ASC, name ASC`)
      .all() as Array<{
      id: number;
      name: string;
      created_at: number;
      updated_at: number;
      marker: string | null;
      layout: string | null;
    }>;

    const requestRows = this.getDb()
      .prepare(
        `SELECT workspace_id, request_uuid, collection_id, request_name
         FROM workspace_requests
         ORDER BY sort_order ASC, request_uuid ASC`
      )
      .all() as Array<{
      workspace_id: number;
      request_uuid: string;
      collection_id: number | null;
      request_name: string | null;
    }>;

    const requestsByWorkspace = new Map<number, WorkspaceRequest[]>();
    for (const row of requestRows) {
      const members = requestsByWorkspace.get(row.workspace_id) ?? [];
      members.push({
        requestUuid: row.request_uuid,
        collectionId: row.collection_id ?? undefined,
        requestName: row.request_name ?? undefined
      });
      requestsByWorkspace.set(row.workspace_id, members);
    }

    return workspaceRows.map((row) => ({
      id: row.id,
      name: row.name,
      requests: requestsByWorkspace.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      marker: readSidebarMarker(row.marker),
      layout: normalizeWorkspaceLayout(row.layout)
    }));
  }

  /**
   * Returns the next sort order for a new workspace.
   */
  private nextWorkspaceSortOrder(): number {
    const row = this.getDb()
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM workspaces')
      .get() as { next_order: number };
    return row.next_order;
  }

  /**
   * Inserts request members for one workspace.
   *
   * @param workspaceId - Parent workspace id.
   * @param requests - Ordered saved request references.
   */
  private insertWorkspaceRequests(workspaceId: number, requests: WorkspaceRequest[]): void {
    const insert = this.getDb().prepare(
      `INSERT INTO workspace_requests (workspace_id, request_uuid, collection_id, request_name, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    );

    requests.forEach((request, index) => {
      insert.run(
        workspaceId,
        request.requestUuid,
        request.collectionId ?? null,
        request.requestName ?? null,
        index
      );
    });
  }

  /**
   * Creates a workspace and returns the refreshed list.
   *
   * @param input - Workspace name and ordered request members.
   * @returns Updated workspace list.
   */
  createWorkspace(input: CreateWorkspaceInput): Workspace[] {
    const trimmedName = trimRequiredName(input.name, 'Workspace name');
    const now = Date.now();
    const sortOrder = this.nextWorkspaceSortOrder();
    const db = this.getDb();
    const layoutJson = serializeWorkspaceLayout(input.layout);

    const transaction = db.transaction(() => {
      const result = db
        .prepare(
          'INSERT INTO workspaces (name, sort_order, created_at, updated_at, marker, layout) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(trimmedName, sortOrder, now, now, serializeSidebarMarker(input.marker), layoutJson);
      const workspaceId = Number(result.lastInsertRowid);
      this.insertWorkspaceRequests(workspaceId, input.requests);
    });

    transaction();
    return this.listWorkspaces();
  }

  /**
   * Replaces the saved requests and optional layout in a workspace and returns the refreshed list.
   *
   * @param id - Workspace id.
   * @param requests - Ordered saved request members.
   * @param layout - Optional UI layout snapshot to persist; omit to leave the stored layout unchanged.
   * @returns Updated workspace list.
   */
  updateWorkspace(
    id: number,
    requests: WorkspaceRequest[],
    layout?: WorkspaceLayout | null
  ): Workspace[] {
    const source = this.listWorkspaces().find((workspace) => workspace.id === id);
    if (!source) {
      throw new Error(`Workspace ${id} not found`);
    }

    const db = this.getDb();
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM workspace_requests WHERE workspace_id = ?').run(id);
      this.insertWorkspaceRequests(id, requests);
      if (layout !== undefined) {
        db.prepare('UPDATE workspaces SET updated_at = ?, layout = ? WHERE id = ?').run(
          Date.now(),
          serializeWorkspaceLayout(layout),
          id
        );
      } else {
        db.prepare('UPDATE workspaces SET updated_at = ? WHERE id = ?').run(Date.now(), id);
      }
    });

    transaction();
    return this.listWorkspaces();
  }

  /**
   * Updates a workspace's sidebar marker and returns the refreshed list.
   *
   * @param id - Workspace id.
   * @param marker - CSS marker string, or null to clear.
   * @returns Updated workspace list.
   */
  setWorkspaceMarker(id: number, marker: string | null): Workspace[] {
    this.getDb()
      .prepare('UPDATE workspaces SET marker = ?, updated_at = ? WHERE id = ?')
      .run(serializeSidebarMarker(marker), Date.now(), id);
    return this.listWorkspaces();
  }

  /**
   * Renames a workspace and returns the refreshed list.
   *
   * @param id - Workspace id.
   * @param name - New display name.
   * @returns Updated workspace list.
   */
  renameWorkspace(id: number, name: string): Workspace[] {
    const trimmedName = trimRequiredName(name, 'Workspace name');
    this.getDb()
      .prepare('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?')
      .run(trimmedName, Date.now(), id);
    return this.listWorkspaces();
  }

  /**
   * Clones a workspace under a new name and returns the refreshed list.
   *
   * @param id - Source workspace id.
   * @param name - Name for the cloned workspace.
   * @returns Updated workspace list.
   */
  cloneWorkspace(id: number, name: string): Workspace[] {
    const source = this.listWorkspaces().find((workspace) => workspace.id === id);
    if (!source) {
      throw new Error(`Workspace ${id} not found`);
    }

    return this.createWorkspace({
      name,
      requests: source.requests.map((request) => ({ ...request })),
      marker: source.marker ?? null,
      layout: source.layout ?? null
    });
  }

  /**
   * Deletes a workspace and returns the refreshed list.
   *
   * @param id - Workspace id.
   * @returns Updated workspace list.
   */
  deleteWorkspace(id: number): Workspace[] {
    this.getDb().prepare('DELETE FROM workspaces WHERE id = ?').run(id);
    return this.listWorkspaces();
  }

  /**
   * Parses a workflow payload JSON string into variables and actions.
   *
   * Legacy actions without a uuid receive a freshly minted one so callers always
   * see a stable per-action identifier (persisted on the next save).
   *
   * @param raw - JSON text from the workflows.payload column.
   * @returns Normalized payload fields.
   */
  private parseWorkflowPayload(raw: string): WorkflowPayloadJson {
    try {
      const parsed = JSON.parse(raw) as Partial<WorkflowPayloadJson>;
      return {
        variables:
          parsed.variables &&
          typeof parsed.variables === 'object' &&
          !Array.isArray(parsed.variables)
            ? Object.fromEntries(
                Object.entries(parsed.variables).filter(
                  (entry): entry is [string, string] => typeof entry[1] === 'string'
                )
              )
            : {},
        actions: Array.isArray(parsed.actions)
          ? parsed.actions.flatMap((action): WorkflowAction[] => {
              if (typeof action !== 'object' || action == null) {
                return [];
              }
              const candidate = action as Partial<WorkflowAction>;
              if (typeof candidate.type !== 'string') {
                return [];
              }
              const existingUuid = typeof candidate.uuid === 'string' ? candidate.uuid.trim() : '';
              return [
                {
                  uuid: existingUuid.length > 0 ? existingUuid : generateDocumentUuid(),
                  type: candidate.type,
                  ...(typeof candidate.at === 'number' ? { at: candidate.at } : {}),
                  payload: candidate.payload
                }
              ];
            })
          : [],
        delayMs: normalizeWorkflowDelayMs(parsed.delayMs)
      };
    } catch {
      return { variables: {}, actions: [], delayMs: 0 };
    }
  }

  /**
   * Loads all workflows from the local registry.
   *
   * @returns Workflows ordered by sort order then name.
   */
  listWorkflows(): Workflow[] {
    const rows = this.getDb()
      .prepare(`SELECT ${WORKFLOW_COLUMNS} FROM workflows ORDER BY sort_order ASC, name ASC`)
      .all() as Array<{
      id: number;
      uuid: string;
      name: string;
      payload: string;
      duration_ms: number;
      sort_order: number;
      created_at: number;
      updated_at: number;
      archived: number;
    }>;

    return rows.map((row) => {
      const payload = this.parseWorkflowPayload(row.payload);
      return {
        id: row.id,
        uuid: row.uuid,
        name: row.name,
        durationMs: row.duration_ms,
        delayMs: payload.delayMs ?? 0,
        variables: payload.variables,
        actions: payload.actions,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        archived: Boolean(row.archived)
      };
    });
  }

  /**
   * Returns the next sort order for a new workflow.
   *
   * @returns Next sort order index.
   */
  private nextWorkflowSortOrder(): number {
    const row = this.getDb()
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM workflows')
      .get() as { next_order: number };
    return row.next_order;
  }

  /**
   * Creates a workflow and returns the refreshed list.
   *
   * @param input - Workflow name, actions, and duration.
   * @returns Updated workflow list.
   */
  createWorkflow(input: CreateWorkflowInput): Workflow[] {
    const trimmedName = trimRequiredName(input.name, 'Workflow name');
    const now = Date.now();
    const uuid = input.uuid?.trim() ? input.uuid.trim() : generateDocumentUuid();
    const delayMs = normalizeWorkflowDelayMs(input.delayMs);
    const payload = JSON.stringify({
      variables: input.variables ?? {},
      actions: input.actions,
      delayMs
    } satisfies WorkflowPayloadJson);

    this.getDb()
      .prepare(
        `INSERT INTO workflows (uuid, name, payload, duration_ms, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        uuid,
        trimmedName,
        payload,
        Math.max(0, Math.floor(input.durationMs)),
        this.nextWorkflowSortOrder(),
        now,
        now
      );

    return this.listWorkflows();
  }

  /**
   * Renames a workflow and returns the refreshed list.
   *
   * @param id - Workflow id.
   * @param name - New display name.
   * @returns Updated workflow list.
   */
  renameWorkflow(id: number, name: string): Workflow[] {
    const trimmedName = trimRequiredName(name, 'Workflow name');
    this.getDb()
      .prepare('UPDATE workflows SET name = ?, updated_at = ? WHERE id = ?')
      .run(trimmedName, Date.now(), id);
    return this.listWorkflows();
  }

  /**
   * Updates a workflow's actions, duration, and delay and returns the refreshed list.
   *
   * @param id - Workflow id.
   * @param input - New actions, duration, and delay (variables and name are preserved).
   * @returns Updated workflow list.
   * @throws When the workflow id does not exist.
   */
  updateWorkflow(
    id: number,
    input: { actions: WorkflowAction[]; durationMs: number; delayMs?: number }
  ): Workflow[] {
    const existing = this.listWorkflows().find((workflow) => workflow.id === id);
    if (!existing) {
      throw new Error(`Workflow not found: ${id}`);
    }

    const now = Date.now();
    const delayMs =
      input.delayMs === undefined ? existing.delayMs : normalizeWorkflowDelayMs(input.delayMs);
    const payload = JSON.stringify({
      variables: existing.variables,
      actions: input.actions,
      delayMs
    } satisfies WorkflowPayloadJson);

    this.getDb()
      .prepare(`UPDATE workflows SET payload = ?, duration_ms = ?, updated_at = ? WHERE id = ?`)
      .run(payload, Math.max(0, Math.floor(input.durationMs)), now, id);

    return this.listWorkflows();
  }

  /**
   * Deletes a workflow and returns the refreshed list.
   *
   * @param id - Workflow id.
   * @returns Updated workflow list.
   */
  deleteWorkflow(id: number): Workflow[] {
    this.getDb().prepare('DELETE FROM workflows WHERE id = ?').run(id);
    return this.listWorkflows();
  }

  /**
   * Marks or unmarks a workflow as archived and returns the refreshed list.
   *
   * @param id - Workflow id.
   * @param archived - When true, hide the workflow from the Workflows list.
   * @returns Updated workflow list.
   */
  setWorkflowArchived(id: number, archived: boolean): Workflow[] {
    this.getDb()
      .prepare('UPDATE workflows SET archived = ?, updated_at = ? WHERE id = ?')
      .run(archived ? 1 : 0, Date.now(), id);
    return this.listWorkflows();
  }

  /**
   * Parses a website payload JSON string from the registry database.
   *
   * @param raw - Serialized payload column.
   * @returns Normalized website payload fields.
   */
  private parseWebsitePayload(raw: string): WebsitePayloadJson {
    try {
      const parsed = JSON.parse(raw) as Partial<WebsitePayloadJson>;
      return {
        url: typeof parsed.url === 'string' ? parsed.url : 'about:blank',
        homeUrl: typeof parsed.homeUrl === 'string' ? parsed.homeUrl : 'about:blank',
        faviconDataUrl:
          typeof parsed.faviconDataUrl === 'string' && parsed.faviconDataUrl.length > 0
            ? parsed.faviconDataUrl
            : null,
        scripts: Array.isArray(parsed.scripts)
          ? parsed.scripts.flatMap((script): WebsiteInjectionScript[] => {
              if (!script || typeof script !== 'object') {
                return [];
              }
              const candidate = script as Partial<WebsiteInjectionScript>;
              if (
                typeof candidate.id !== 'string' ||
                candidate.id.length === 0 ||
                typeof candidate.name !== 'string' ||
                typeof candidate.source !== 'string' ||
                (candidate.runAt !== 'document-start' &&
                  candidate.runAt !== 'dom-ready' &&
                  candidate.runAt !== 'did-finish-load')
              ) {
                return [];
              }
              return [
                {
                  id: candidate.id,
                  name: candidate.name,
                  enabled: candidate.enabled !== false,
                  runAt: candidate.runAt,
                  source: candidate.source
                }
              ];
            })
          : [],
        preRequestScripts: Array.isArray(parsed.preRequestScripts)
          ? (parsed.preRequestScripts as ScriptRef[])
          : [],
        postRequestScripts: Array.isArray(parsed.postRequestScripts)
          ? (parsed.postRequestScripts as ScriptRef[])
          : [],
        variables: Array.isArray(parsed.variables)
          ? parsed.variables.map((row) => normalizeVariable((row ?? {}) as Partial<Variable>))
          : [],
        headers: Array.isArray(parsed.headers)
          ? parsed.headers.flatMap((row): KeyValue[] => {
              const normalized = normalizeWebsiteKeyValue(row);
              return normalized ? [normalized] : [];
            })
          : [],
        userAgent: typeof parsed.userAgent === 'string' ? parsed.userAgent : '',
        auth: normalizeAuth(parsed.auth ?? defaultAuth())
      };
    } catch {
      return emptyWebsitePayload();
    }
  }

  /**
   * Loads all websites from the local registry.
   *
   * @returns Websites ordered by sort order then name.
   */
  listWebsites(): Website[] {
    const rows = this.getDb()
      .prepare(`SELECT ${WEBSITE_COLUMNS} FROM websites ORDER BY sort_order ASC, name ASC`)
      .all() as Array<{
      id: number;
      uuid: string;
      name: string;
      payload: string;
      sort_order: number;
      created_at: number;
      updated_at: number;
    }>;

    return rows.map((row) => {
      const payload = this.parseWebsitePayload(row.payload);
      return {
        id: row.id,
        uuid: row.uuid,
        name: row.name,
        url: payload.url,
        homeUrl: payload.homeUrl,
        faviconDataUrl: payload.faviconDataUrl,
        scripts: payload.scripts,
        preRequestScripts: payload.preRequestScripts,
        postRequestScripts: payload.postRequestScripts,
        variables: payload.variables,
        headers: payload.headers,
        userAgent: payload.userAgent,
        auth: payload.auth,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
  }

  /**
   * Returns the next sort order for a new website.
   *
   * @returns Next sort order index.
   */
  private nextWebsiteSortOrder(): number {
    const row = this.getDb()
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM websites')
      .get() as { next_order: number };
    return row.next_order;
  }

  /**
   * Creates a website and returns the refreshed list.
   *
   * @param input - Website name, URL, and scripts.
   * @returns Updated website list.
   */
  createWebsite(input: CreateWebsiteInput): Website[] {
    const trimmedName = trimRequiredName(input.name, 'Website name');
    const now = Date.now();
    const uuid = input.uuid?.trim() ? input.uuid.trim() : generateDocumentUuid();
    const payload = JSON.stringify({
      url: input.url,
      homeUrl: input.homeUrl,
      faviconDataUrl: input.faviconDataUrl ?? null,
      scripts: input.scripts ?? [],
      preRequestScripts: input.preRequestScripts ?? [],
      postRequestScripts: input.postRequestScripts ?? [],
      variables: input.variables ?? [],
      headers: input.headers ?? [],
      userAgent: input.userAgent ?? '',
      auth: normalizeAuth(input.auth ?? defaultAuth())
    } satisfies WebsitePayloadJson);

    this.getDb()
      .prepare(
        `INSERT INTO websites (uuid, name, payload, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(uuid, trimmedName, payload, this.nextWebsiteSortOrder(), now, now);

    return this.listWebsites();
  }

  /**
   * Updates a website and returns the refreshed list.
   *
   * @param input - Website id and fields to persist.
   * @returns Updated website list.
   * @throws When the website id does not exist.
   */
  updateWebsite(input: UpdateWebsiteInput): Website[] {
    const existing = this.listWebsites().find((website) => website.id === input.id);
    if (!existing) {
      throw new Error(`Website not found: ${input.id}`);
    }

    const trimmedName = trimRequiredName(input.name, 'Website name');
    const now = Date.now();
    const payload = JSON.stringify({
      url: input.url,
      homeUrl: input.homeUrl,
      faviconDataUrl: input.faviconDataUrl ?? null,
      scripts: input.scripts,
      preRequestScripts: input.preRequestScripts,
      postRequestScripts: input.postRequestScripts,
      variables: input.variables,
      headers: input.headers,
      userAgent: input.userAgent,
      auth: normalizeAuth(input.auth)
    } satisfies WebsitePayloadJson);

    this.getDb()
      .prepare(`UPDATE websites SET name = ?, payload = ?, updated_at = ? WHERE id = ?`)
      .run(trimmedName, payload, now, input.id);

    return this.listWebsites();
  }

  /**
   * Deletes a website and returns the refreshed list.
   *
   * @param id - Website id.
   * @returns Updated website list.
   */
  deleteWebsite(id: number): Website[] {
    this.getDb().prepare('DELETE FROM websites WHERE id = ?').run(id);
    return this.listWebsites();
  }

  /**
   * Parses a live-server payload JSON string from the registry database.
   *
   * @param raw - Serialized payload column.
   * @returns Normalized live-server payload fields.
   */
  private parseLiveServerPayload(raw: string): LiveServerPayloadJson {
    try {
      const parsed = JSON.parse(raw) as Partial<LiveServerPayloadJson>;
      const aliases = Array.isArray(parsed.aliases)
        ? parsed.aliases.flatMap((alias): LiveServerAlias[] => {
            if (!alias || typeof alias !== 'object') {
              return [];
            }
            const candidate = alias as Partial<LiveServerAlias>;
            if (typeof candidate.path !== 'string' || typeof candidate.target !== 'string') {
              return [];
            }
            const path = candidate.path.trim();
            const target = candidate.target.trim();
            if (path === '' || target === '') {
              return [];
            }
            return [{ path, target }];
          })
        : [];
      const port =
        typeof parsed.port === 'number' && Number.isInteger(parsed.port) && parsed.port > 0
          ? parsed.port
          : null;
      const fields = normalizeLiveServerConfigFields(parsed);
      return {
        root: typeof parsed.root === 'string' ? parsed.root : '',
        port,
        aliases,
        watch: parsed.watch !== false,
        cors: normalizeLiveServerCorsSettings(parsed.cors),
        ...fields
      };
    } catch {
      return emptyLiveServerPayload();
    }
  }

  /**
   * Loads all saved live servers from the local registry.
   *
   * @returns Live servers ordered by sort order then name.
   */
  listLiveServers(): LiveServer[] {
    const rows = this.getDb()
      .prepare(`SELECT ${LIVE_SERVER_COLUMNS} FROM live_servers ORDER BY sort_order ASC, name ASC`)
      .all() as Array<{
      id: number;
      uuid: string;
      name: string;
      payload: string;
      sort_order: number;
      created_at: number;
      updated_at: number;
    }>;

    return rows.map((row) => {
      const payload = this.parseLiveServerPayload(row.payload);
      return {
        id: row.id,
        uuid: row.uuid,
        name: row.name,
        root: payload.root,
        port: payload.port,
        aliases: payload.aliases,
        watch: payload.watch,
        cors: payload.cors,
        openPath: payload.openPath,
        openPathOnStartup: payload.openPathOnStartup,
        rememberLastUrl: payload.rememberLastUrl,
        lastOpenedPath: payload.lastOpenedPath,
        indexFiles: payload.indexFiles,
        host: payload.host,
        headers: payload.headers,
        routes: payload.routes,
        errorPages: payload.errorPages,
        proxies: payload.proxies,
        ssl: payload.ssl,
        runCommand: payload.runCommand,
        runtimeId: payload.runtimeId,
        runCommandEnabled: payload.runCommandEnabled,
        runCommandEnv: payload.runCommandEnv,
        restartOnCrash: payload.restartOnCrash,
        urlVariable: payload.urlVariable,
        preRequestScripts: payload.preRequestScripts,
        postRequestScripts: payload.postRequestScripts,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
  }

  /**
   * Returns the next sort order for a new live server.
   *
   * @returns Next sort order index.
   */
  private nextLiveServerSortOrder(): number {
    const row = this.getDb()
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM live_servers')
      .get() as { next_order: number };
    return row.next_order;
  }

  /**
   * Creates a saved live server and returns the refreshed list.
   *
   * @param input - Live server name, root, and options.
   * @returns Updated live server list.
   */
  createLiveServer(input: CreateLiveServerInput): LiveServer[] {
    const trimmedName = trimRequiredName(input.name, 'Live server name');
    const root = input.root.trim();
    if (!root) {
      throw new Error('Root directory is required');
    }
    const now = Date.now();
    const uuid = input.uuid?.trim() ? input.uuid.trim() : generateDocumentUuid();
    const fields = normalizeLiveServerConfigFields(input);
    const payload = JSON.stringify({
      root,
      port:
        typeof input.port === 'number' && Number.isInteger(input.port) && input.port > 0
          ? input.port
          : null,
      aliases: (input.aliases ?? [])
        .map((alias) => ({
          path: alias.path.trim(),
          target: alias.target.trim()
        }))
        .filter((alias) => alias.path !== '' && alias.target !== ''),
      watch: input.watch !== false,
      cors: normalizeLiveServerCorsSettings(input.cors),
      ...fields
    } satisfies LiveServerPayloadJson);

    this.getDb()
      .prepare(
        `INSERT INTO live_servers (uuid, name, payload, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(uuid, trimmedName, payload, this.nextLiveServerSortOrder(), now, now);

    return this.listLiveServers();
  }

  /**
   * Updates a saved live server and returns the refreshed list.
   *
   * @param input - Live server id and fields to persist.
   * @returns Updated live server list.
   * @throws When the live server id does not exist.
   */
  updateLiveServer(input: UpdateLiveServerInput): LiveServer[] {
    const existing = this.listLiveServers().find((server) => server.id === input.id);
    if (!existing) {
      throw new Error(`Live server not found: ${input.id}`);
    }

    const trimmedName = trimRequiredName(input.name, 'Live server name');
    const root = input.root.trim();
    if (!root) {
      throw new Error('Root directory is required');
    }
    const now = Date.now();
    const fields = normalizeLiveServerConfigFields(input);
    const payload = JSON.stringify({
      root,
      port:
        typeof input.port === 'number' && Number.isInteger(input.port) && input.port > 0
          ? input.port
          : null,
      aliases: (input.aliases ?? [])
        .map((alias) => ({
          path: alias.path.trim(),
          target: alias.target.trim()
        }))
        .filter((alias) => alias.path !== '' && alias.target !== ''),
      watch: input.watch !== false,
      cors: normalizeLiveServerCorsSettings(input.cors),
      ...fields
    } satisfies LiveServerPayloadJson);

    this.getDb()
      .prepare(`UPDATE live_servers SET name = ?, payload = ?, updated_at = ? WHERE id = ?`)
      .run(trimmedName, payload, now, input.id);

    return this.listLiveServers();
  }

  /**
   * Deletes a saved live server and returns the refreshed list.
   *
   * @param id - Live server id.
   * @returns Updated live server list.
   */
  deleteLiveServer(id: number): LiveServer[] {
    this.getDb().prepare('DELETE FROM live_servers WHERE id = ?').run(id);
    return this.listLiveServers();
  }

  /**
   * Loads persisted workflow run history entries, newest first.
   *
   * @param cap - Maximum number of entries to return.
   * @returns Workflow run history entries ordered newest-first.
   */
  listWorkflowRunHistory(cap = WORKFLOW_RUN_HISTORY_CAP): WorkflowRunHistoryEntry[] {
    const rows = this.getDb()
      .prepare(
        `SELECT id, workflow_uuid, name, environment, date_created, ts, payload
         FROM workflow_run_history
         ORDER BY ts DESC
         LIMIT ?`
      )
      .all(cap) as Array<{
      id: number;
      workflow_uuid: string;
      name: string;
      environment: string;
      date_created: string;
      ts: number;
      payload: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      workflowUuid: row.workflow_uuid,
      name: row.name,
      environment: row.environment,
      dateCreated: row.date_created,
      ts: row.ts,
      payload: JSON.parse(row.payload) as WorkflowRunHistoryPayload
    }));
  }

  /**
   * Inserts a workflow run history entry and prunes older rows beyond the cap.
   *
   * @param entry - Captured run to persist (id is assigned by the database when omitted).
   * @param cap - Maximum number of entries to retain.
   * @returns Updated workflow run history list ordered newest-first.
   */
  addWorkflowRunHistory(
    entry: Omit<WorkflowRunHistoryEntry, 'id'> & { id?: number },
    cap = WORKFLOW_RUN_HISTORY_CAP
  ): WorkflowRunHistoryEntry[] {
    const db = this.getDb();
    const insert = db.prepare(
      `INSERT INTO workflow_run_history
        (workflow_uuid, name, environment, date_created, ts, payload)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const prune = db.prepare(
      `DELETE FROM workflow_run_history
       WHERE id NOT IN (
         SELECT id FROM workflow_run_history ORDER BY ts DESC LIMIT ?
       )`
    );

    const transaction = db.transaction(() => {
      insert.run(
        entry.workflowUuid,
        entry.name,
        entry.environment,
        entry.dateCreated,
        entry.ts,
        JSON.stringify(entry.payload)
      );
      prune.run(cap);
    });

    transaction();
    return this.listWorkflowRunHistory(cap);
  }

  /**
   * Removes all persisted workflow run history entries.
   */
  clearWorkflowRunHistory(): void {
    this.getDb().prepare('DELETE FROM workflow_run_history').run();
  }

  /**
   * Removes one persisted workflow run history entry by id.
   *
   * @param id - History entry id to delete.
   * @param cap - Maximum number of entries to return after deletion.
   * @returns Updated workflow run history list ordered newest-first.
   */
  deleteWorkflowRunHistory(id: number, cap = WORKFLOW_RUN_HISTORY_CAP): WorkflowRunHistoryEntry[] {
    this.getDb().prepare('DELETE FROM workflow_run_history WHERE id = ?').run(id);
    return this.listWorkflowRunHistory(cap);
  }

  /**
   * Persists a new sidebar order for workspaces and returns the refreshed list.
   *
   * @param orderedIds - Workspace ids in desired order.
   * @returns Updated workspace list.
   */
  reorderWorkspaces(orderedIds: number[]): Workspace[] {
    const reorder = this.getDb().transaction((ids: number[]) => {
      const stmt = this.getDb().prepare('UPDATE workspaces SET sort_order = ? WHERE id = ?');
      ids.forEach((id, index) => {
        stmt.run(index, id);
      });
    });
    reorder(orderedIds);
    return this.listWorkspaces();
  }

  /**
   * Lists trash snapshot rows ordered newest-first.
   *
   * @returns Trash items for the sidebar Trash section.
   */
  listTrashItems(): TrashItem[] {
    const rows = this.getDb()
      .prepare(
        `SELECT id, entity_type, label, connection_id, original_ids, payload, deleted_at
         FROM trash_items
         ORDER BY deleted_at DESC, id DESC`
      )
      .all() as TrashItemRow[];

    return rows.map(rowToTrashItem);
  }

  /**
   * Loads one trash snapshot row by id.
   *
   * @param id - Trash row id.
   * @returns The trash item when found, otherwise null.
   */
  getTrashItem(id: number): TrashItem | null {
    const row = this.getDb()
      .prepare(
        `SELECT id, entity_type, label, connection_id, original_ids, payload, deleted_at
         FROM trash_items
         WHERE id = ?`
      )
      .get(id) as TrashItemRow | undefined;

    return row ? rowToTrashItem(row) : null;
  }

  /**
   * Inserts a trash snapshot row.
   *
   * @param input - Trash snapshot metadata and payload.
   * @returns The newly inserted trash item.
   */
  insertTrashItem(input: InsertTrashItemInput): TrashItem {
    const result = this.getDb()
      .prepare(
        `INSERT INTO trash_items (entity_type, label, connection_id, original_ids, payload)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        input.entityType,
        input.label,
        input.connectionId ?? null,
        JSON.stringify(input.originalIds),
        JSON.stringify(input.payload)
      );

    const inserted = this.getTrashItem(Number(result.lastInsertRowid));
    if (!inserted) {
      throw new Error('Failed to insert trash item');
    }

    return inserted;
  }

  /**
   * Permanently deletes one trash snapshot row.
   *
   * @param id - Trash row id.
   */
  deleteTrashItem(id: number): void {
    this.getDb().prepare('DELETE FROM trash_items WHERE id = ?').run(id);
  }

  /**
   * Permanently deletes every trash snapshot row.
   */
  clearTrash(): void {
    this.getDb().prepare('DELETE FROM trash_items').run();
  }
}
