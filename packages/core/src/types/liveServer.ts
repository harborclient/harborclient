/**
 * URL-path-to-filesystem alias for a live server.
 */
export interface LiveServerAlias {
  /**
   * URL path prefix, e.g. `/assets`.
   */
  path: string;

  /**
   * Filesystem target, absolute or relative to the server root.
   */
  target: string;
}

/**
 * CORS middleware settings for a live server.
 */
export interface LiveServerCorsSettings {
  /**
   * When true, the Express `cors` middleware is mounted.
   */
  enabled: boolean;

  /**
   * Allowed origin(s): `*` or a comma-separated list of origins.
   */
  origin: string;

  /**
   * Allowed methods: `*` or a comma-separated list (e.g. `GET,POST`).
   */
  methods: string;

  /**
   * Allowed request headers: `*`, empty (reflect request), or comma-separated names.
   */
  allowedHeaders: string;

  /**
   * When true, responses include `Access-Control-Allow-Credentials`.
   * Incompatible with `origin: '*'` per the CORS spec.
   */
  credentials: boolean;
}

/**
 * Most-permissive CORS defaults matching the Express `cors()` package defaults.
 *
 * Credentials stay false because `credentials: true` cannot be paired with
 * `origin: '*'`.
 *
 * @returns A fresh default CORS settings object.
 */
export function defaultLiveServerCorsSettings(): LiveServerCorsSettings {
  return {
    enabled: true,
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: '*',
    credentials: false
  };
}

/**
 * Normalizes partial or legacy CORS settings into a complete object.
 *
 * Missing or invalid fields fall back to {@link defaultLiveServerCorsSettings}.
 *
 * @param value - Partial CORS settings from storage or IPC, or undefined.
 * @returns Normalized CORS settings.
 */
export function normalizeLiveServerCorsSettings(
  value: Partial<LiveServerCorsSettings> | null | undefined
): LiveServerCorsSettings {
  const defaults = defaultLiveServerCorsSettings();
  if (value == null || typeof value !== 'object') {
    return defaults;
  }
  return {
    enabled: value.enabled !== false,
    origin:
      typeof value.origin === 'string' && value.origin.trim() !== ''
        ? value.origin.trim()
        : defaults.origin,
    methods:
      typeof value.methods === 'string' && value.methods.trim() !== ''
        ? value.methods.trim()
        : defaults.methods,
    allowedHeaders:
      typeof value.allowedHeaders === 'string'
        ? value.allowedHeaders.trim()
        : defaults.allowedHeaders,
    credentials: value.credentials === true
  };
}

/**
 * Configuration shared by saved and running live servers.
 */
export interface LiveServerConfig {
  /**
   * Display name shown in the sidebar and modal.
   */
  name: string;

  /**
   * Absolute path to the directory served as the document root.
   */
  root: string;

  /**
   * Explicit listen port, or null to auto-select from 5500 upward.
   */
  port: number | null;

  /**
   * Path aliases mounted before the document root static middleware.
   */
  aliases: LiveServerAlias[];

  /**
   * When true, the main process watches the root (and alias targets) and
   * notifies the renderer to reload matching browser tabs on change.
   */
  watch: boolean;

  /**
   * CORS middleware settings applied when the server starts.
   */
  cors: LiveServerCorsSettings;
}

/**
 * A saved live server config in the local registry.
 */
export interface LiveServer {
  /**
   * Database primary key.
   */
  id: number;

  /**
   * Stable portable identifier.
   */
  uuid: string;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * Absolute path to the directory served as the document root.
   */
  root: string;

  /**
   * Explicit listen port, or null to auto-select from 5500 upward.
   */
  port: number | null;

  /**
   * Path aliases mounted before the document root static middleware.
   */
  aliases: LiveServerAlias[];

  /**
   * When true, file watching is enabled when this server is started.
   */
  watch: boolean;

  /**
   * CORS middleware settings applied when the server starts.
   */
  cors: LiveServerCorsSettings;

  /**
   * Sort order within the Live Servers sidebar section.
   */
  sortOrder: number;

  /**
   * Unix timestamp (ms) when the row was created.
   */
  createdAt: number;

  /**
   * Unix timestamp (ms) when the row was last updated.
   */
  updatedAt: number;
}

/**
 * Input for creating a saved live server in the local registry.
 */
export interface CreateLiveServerInput {
  /**
   * Display name for the saved server.
   */
  name: string;

  /**
   * Absolute path to the directory served as the document root.
   */
  root: string;

  /**
   * Explicit listen port, or null to auto-select.
   */
  port?: number | null;

  /**
   * Path aliases to persist.
   */
  aliases?: LiveServerAlias[];

  /**
   * Whether file watching is enabled when started. Defaults to true.
   */
  watch?: boolean;

  /**
   * CORS settings to persist. Defaults to {@link defaultLiveServerCorsSettings}.
   */
  cors?: LiveServerCorsSettings;
}

/**
 * Input for updating a saved live server in the local registry.
 */
export interface UpdateLiveServerInput {
  /**
   * Database primary key of the server to update.
   */
  id: number;

  /**
   * Display name for the saved server.
   */
  name: string;

  /**
   * Absolute path to the directory served as the document root.
   */
  root: string;

  /**
   * Explicit listen port, or null to auto-select.
   */
  port: number | null;

  /**
   * Path aliases to persist.
   */
  aliases: LiveServerAlias[];

  /**
   * Whether file watching is enabled when started.
   */
  watch: boolean;

  /**
   * CORS settings to persist.
   */
  cors: LiveServerCorsSettings;
}

/**
 * Input for starting a live server instance in the main process.
 */
export interface StartLiveServerInput {
  /**
   * Optional runtime instance id; generated when omitted.
   */
  id?: string;

  /**
   * Saved `live_servers.id` when starting from a persisted config.
   */
  savedId?: number | null;

  /**
   * Server configuration applied for this run.
   */
  config: LiveServerConfig;
}

/**
 * A currently running live server instance.
 */
export interface RunningLiveServer {
  /**
   * Runtime instance id (uuid), distinct from a saved server id.
   */
  id: string;

  /**
   * Saved `live_servers.id` when started from a saved config.
   */
  savedId: number | null;

  /**
   * Configuration used for this run.
   */
  config: LiveServerConfig;

  /**
   * Assigned listen port after the server is accepting connections.
   */
  port: number;

  /**
   * Origin string such as `http://127.0.0.1:5500`.
   */
  origin: string;

  /**
   * Unix timestamp (ms) when the instance started.
   */
  startedAt: number;

  /**
   * When true, file watching was requested but could not be started.
   */
  watchUnavailable?: boolean;
}

/**
 * Payload pushed when a watched live server detects a file change.
 */
export interface LiveServerFileChangedEvent {
  /**
   * Runtime instance id of the server that changed.
   */
  id: string;

  /**
   * Origin of the running server (for matching browser tabs).
   */
  origin: string;
}

/**
 * One Express access-log line from a running live server.
 */
export interface LiveServerRequestLogEntry {
  /**
   * Runtime instance id of the server that handled the request.
   */
  id: string;

  /**
   * Saved `live_servers.id` when the instance was started from a saved config.
   */
  savedId: number | null;

  /**
   * Unix timestamp (ms) when the request was received.
   */
  timestamp: number;

  /**
   * HTTP method (e.g. `GET`).
   */
  method: string;

  /**
   * Request URL path including query string (`req.originalUrl`).
   */
  url: string;

  /**
   * HTTP response status code.
   */
  statusCode: number;

  /**
   * Time from request start to response finish/close, in milliseconds.
   */
  durationMs: number;

  /**
   * Response `Content-Length` when present and numeric; otherwise null.
   */
  contentLength: number | null;
}

/**
 * Query used to read or clear buffered request logs for one running instance.
 */
export type LiveServerLogsQuery = { savedId: number } | { id: string };
