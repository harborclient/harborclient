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
 * One path-routing rule for a live server (SPA fallback / soft rewrite).
 *
 * Rules run after alias and document-root static miss. First matching enabled
 * rule wins. Use `match: '*'` to catch every remaining path (typical SPA
 * `index.html` fallback).
 */
export interface LiveServerRoute {
  /**
   * `*` for all paths, or a regex source matched against the URL pathname.
   */
  match: string;

  /**
   * File or directory path, absolute or relative to the server root.
   */
  target: string;

  /**
   * When false, the rule is ignored. Defaults to true when omitted.
   */
  enabled?: boolean;
}

/**
 * One custom response header applied by a live server.
 */
export interface LiveServerResponseHeader {
  /**
   * Header name, e.g. `Cache-Control`.
   */
  name: string;

  /**
   * Header value, e.g. `no-store`.
   */
  value: string;

  /**
   * When false, the header is not applied. Defaults to true when omitted.
   */
  enabled?: boolean;
}

/**
 * TLS certificate settings for serving a live server over HTTPS.
 */
export interface LiveServerSslSettings {
  /**
   * When true, the live server listens with HTTPS using the configured cert/key.
   */
  enabled: boolean;

  /**
   * Absolute path to a PEM (or compatible) certificate file.
   */
  certPath: string;

  /**
   * Absolute path to a PEM (or compatible) private key file.
   */
  keyPath: string;
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
   * Headers browsers may read from the response: `*`, empty (omit / package
   * default), or a comma-separated list of names.
   */
  exposedHeaders: string;

  /**
   * Preflight cache duration in seconds as a string (e.g. `600`). Empty means
   * omit `Access-Control-Max-Age` / use the package default.
   */
  maxAge: string;

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
 * `origin: '*'`. Exposed headers and max-age stay empty so the package
 * defaults apply until the user configures them.
 *
 * @returns A fresh default CORS settings object.
 */
export function defaultLiveServerCorsSettings(): LiveServerCorsSettings {
  return {
    enabled: true,
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: '*',
    exposedHeaders: '',
    maxAge: '',
    credentials: false
  };
}

/**
 * Normalizes partial or legacy CORS settings into a complete object.
 *
 * Missing or invalid fields fall back to {@link defaultLiveServerCorsSettings}.
 * Legacy payloads without `exposedHeaders` / `maxAge` receive empty strings.
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
    exposedHeaders:
      typeof value.exposedHeaders === 'string'
        ? value.exposedHeaders.trim()
        : defaults.exposedHeaders,
    maxAge: typeof value.maxAge === 'string' ? value.maxAge.trim() : defaults.maxAge,
    credentials: value.credentials === true
  };
}

/**
 * Default SSL settings: HTTPS off with empty cert/key paths.
 *
 * @returns A fresh default SSL settings object.
 */
export function defaultLiveServerSslSettings(): LiveServerSslSettings {
  return {
    enabled: false,
    certPath: '',
    keyPath: ''
  };
}

/**
 * Normalizes partial or legacy SSL settings into a complete object.
 *
 * @param value - Partial SSL settings from storage or IPC, or undefined.
 * @returns Normalized SSL settings.
 */
export function normalizeLiveServerSslSettings(
  value: Partial<LiveServerSslSettings> | null | undefined
): LiveServerSslSettings {
  const defaults = defaultLiveServerSslSettings();
  if (value == null || typeof value !== 'object') {
    return defaults;
  }
  return {
    enabled: value.enabled === true,
    certPath: typeof value.certPath === 'string' ? value.certPath.trim() : defaults.certPath,
    keyPath: typeof value.keyPath === 'string' ? value.keyPath.trim() : defaults.keyPath
  };
}

/**
 * Default directory index filenames used by Express static.
 *
 * @returns A fresh default index-file list.
 */
export function defaultLiveServerIndexFiles(): string[] {
  return ['index.html'];
}

/**
 * Normalizes an index-file list from an array or comma-separated string.
 *
 * Trims entries, drops empties, and falls back to
 * {@link defaultLiveServerIndexFiles} when nothing remains.
 *
 * @param value - Array, comma-separated string, or unknown legacy payload.
 * @returns A non-empty list of index filenames.
 */
export function normalizeLiveServerIndexFiles(value: unknown): string[] {
  const defaults = defaultLiveServerIndexFiles();
  let raw: string[] = [];
  if (typeof value === 'string') {
    raw = value.split(',');
  } else if (Array.isArray(value)) {
    raw = value.filter((entry): entry is string => typeof entry === 'string');
  } else {
    return defaults;
  }
  const normalized = raw.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : defaults;
}

/**
 * Normalizes the Live Page entry path relative to the server origin.
 *
 * Empty or non-string values become `/`. Paths without a leading slash get one.
 *
 * @param value - Path or file relative to the server origin.
 * @returns A path that always starts with `/`.
 */
export function normalizeLiveServerOpenPath(value: unknown): string {
  if (typeof value !== 'string') {
    return '/';
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return '/';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Normalizes the remembered last-opened path (pathname + search + hash only).
 *
 * Empty or invalid values become `null`. Non-empty paths get a leading `/`.
 *
 * @param value - Path fragment from storage or navigation, or null/undefined.
 * @returns Normalized path+search+hash, or null when unset.
 */
export function normalizeLiveServerLastOpenedPath(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Normalizes the listen bind host.
 *
 * Empty or non-string values become `127.0.0.1`.
 *
 * @param value - Hostname or IP to bind.
 * @returns A non-empty bind host string.
 */
export function normalizeLiveServerHost(value: unknown): string {
  if (typeof value !== 'string') {
    return '127.0.0.1';
  }
  const trimmed = value.trim();
  return trimmed === '' ? '127.0.0.1' : trimmed;
}

/**
 * Normalizes a response-header list from storage or IPC.
 *
 * Corrupt entries are skipped. Names and values are coerced to trimmed strings;
 * `enabled` defaults to true when omitted.
 *
 * @param value - Array of header rows, or unknown legacy payload.
 * @returns Normalized header rows (may be empty).
 */
export function normalizeLiveServerHeaders(value: unknown): LiveServerResponseHeader[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const headers: LiveServerResponseHeader[] = [];
  for (const entry of value) {
    if (entry == null || typeof entry !== 'object') {
      continue;
    }
    const row = entry as Partial<LiveServerResponseHeader>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const headerValue = typeof row.value === 'string' ? row.value : '';
    headers.push({
      name,
      value: headerValue,
      enabled: row.enabled !== false
    });
  }
  return headers;
}

/**
 * Default routing rules for a new live server (none — static-only behavior).
 *
 * @returns A fresh empty route list.
 */
export function defaultLiveServerRoutes(): LiveServerRoute[] {
  return [];
}

/**
 * Normalizes a routing-rule list from storage or IPC.
 *
 * Corrupt entries and rows with empty `match` or `target` are dropped.
 * `enabled` defaults to true when omitted. Order is preserved (first match
 * wins at runtime).
 *
 * @param value - Array of route rows, or unknown legacy payload.
 * @returns Normalized route rows (may be empty).
 */
export function normalizeLiveServerRoutes(value: unknown): LiveServerRoute[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const routes: LiveServerRoute[] = [];
  for (const entry of value) {
    if (entry == null || typeof entry !== 'object') {
      continue;
    }
    const row = entry as Partial<LiveServerRoute>;
    const match = typeof row.match === 'string' ? row.match.trim() : '';
    const target = typeof row.target === 'string' ? row.target.trim() : '';
    if (match === '' || target === '') {
      continue;
    }
    routes.push({
      match,
      target,
      enabled: row.enabled !== false
    });
  }
  return routes;
}

/**
 * Returns whether a bind host is loopback-only (safe for local-only exposure).
 *
 * `localhost` comparison is case-insensitive; IPv4/IPv6 loopback literals are
 * exact matches after trim.
 *
 * @param host - Bind host string (already normalized preferred).
 * @returns True when the host is loopback.
 */
export function isLiveServerLoopbackHost(host: string): boolean {
  const trimmed = host.trim();
  if (trimmed === '127.0.0.1' || trimmed === '::1') {
    return true;
  }
  return trimmed.toLowerCase() === 'localhost';
}

/**
 * Joins a live-server origin with a path that already starts with `/`.
 *
 * Strips a trailing slash from `origin` so `http://127.0.0.1:5500/` + `/docs`
 * does not produce a double slash before the path.
 *
 * @param origin - Server origin such as `http://127.0.0.1:5500`.
 * @param path - Path+search+hash that starts with `/`.
 * @returns Absolute URL for the Live Page.
 */
export function joinLiveServerOriginPath(origin: string, path: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Resolves the URL to open when starting or opening a Live Page for a server.
 *
 * When `rememberLastUrl` is true and `lastOpenedPath` is set, returns
 * `origin + lastOpenedPath`. Otherwise returns `origin + openPath`.
 *
 * @param origin - Running server origin (scheme + host + port).
 * @param config - Open-path / remember-last-URL fields from the server config.
 * @returns Absolute URL to load in the browser tab.
 */
export function resolveLiveServerOpenUrl(
  origin: string,
  config: Pick<LiveServerConfig, 'openPath' | 'rememberLastUrl' | 'lastOpenedPath'>
): string {
  if (config.rememberLastUrl) {
    const remembered = normalizeLiveServerLastOpenedPath(config.lastOpenedPath);
    if (remembered != null) {
      return joinLiveServerOriginPath(origin, remembered);
    }
  }
  return joinLiveServerOriginPath(origin, normalizeLiveServerOpenPath(config.openPath));
}

/**
 * Builds the Live Page “home” URL from the configured entry path (not the
 * remembered deep link).
 *
 * @param origin - Running server origin.
 * @param openPath - Configured entry path (normalized if needed).
 * @returns Absolute home URL (`origin + openPath`).
 */
export function resolveLiveServerHomeUrl(origin: string, openPath: string): string {
  return joinLiveServerOriginPath(origin, normalizeLiveServerOpenPath(openPath));
}

/**
 * Extracts pathname+search+hash from a navigation URL when it matches a live
 * server origin; otherwise returns null.
 *
 * @param url - Full browser tab URL after navigation.
 * @param origin - Running live server origin to match.
 * @returns Normalized path fragment for {@link lastOpenedPath}, or null.
 */
export function liveServerOpenedPathFromUrl(url: string, origin: string): string | null {
  try {
    const parsed = new URL(url);
    const originUrl = new URL(origin);
    if (parsed.origin !== originUrl.origin) {
      return null;
    }
    return normalizeLiveServerLastOpenedPath(parsed.pathname + parsed.search + parsed.hash);
  } catch {
    return null;
  }
}

/**
 * Partial shape accepted when normalizing the expanded live-server config
 * fields from storage, IPC, or create/update inputs.
 *
 * Omitted fields receive defaults. Used by persistence (Step 2+) so legacy
 * `live_servers` rows load without the new payload keys.
 */
export interface LiveServerConfigFieldInput {
  /**
   * Entry / open path relative to the server origin.
   */
  openPath?: unknown;

  /**
   * When true, persist and reuse the last opened path within the origin.
   */
  rememberLastUrl?: unknown;

  /**
   * Last opened path+search+hash within the origin, or null.
   */
  lastOpenedPath?: unknown;

  /**
   * Directory index filenames (array or comma-separated string).
   */
  indexFiles?: unknown;

  /**
   * Listen bind host.
   */
  host?: unknown;

  /**
   * Custom response headers.
   */
  headers?: unknown;

  /**
   * Path routing / SPA fallback rules.
   */
  routes?: unknown;

  /**
   * TLS certificate settings.
   */
  ssl?: unknown;
}

/**
 * Normalized expanded live-server config fields shared by saved and running configs.
 */
export interface LiveServerConfigFields {
  /**
   * Path or file opened when the Live Page starts (always leading `/`).
   */
  openPath: string;

  /**
   * When true, navigations within the origin update {@link lastOpenedPath}.
   */
  rememberLastUrl: boolean;

  /**
   * Last opened path+search+hash within the origin; null when never recorded.
   */
  lastOpenedPath: string | null;

  /**
   * Ordered directory index filenames for Express static.
   */
  indexFiles: string[];

  /**
   * Listen bind host (e.g. `127.0.0.1` or `0.0.0.0`).
   */
  host: string;

  /**
   * Custom response headers applied after CORS and before static.
   */
  headers: LiveServerResponseHeader[];

  /**
   * Ordered path routing rules applied after static miss (first match wins).
   */
  routes: LiveServerRoute[];

  /**
   * TLS settings for HTTPS listen.
   */
  ssl: LiveServerSslSettings;
}

/**
 * Normalizes the expanded live-server config fields added for open path, index
 * files, bind host, response headers, routing rules, and SSL.
 *
 * Pure and dependency-free so storage, IPC, and UI can share one code path.
 * Callers still merge these onto name/root/port/aliases/watch/cors separately.
 *
 * @param value - Partial fields from storage, IPC, or create input.
 * @returns Fully populated expanded fields with defaults applied.
 */
export function normalizeLiveServerConfigFields(
  value: LiveServerConfigFieldInput | null | undefined
): LiveServerConfigFields {
  if (value == null || typeof value !== 'object') {
    return {
      openPath: normalizeLiveServerOpenPath(undefined),
      rememberLastUrl: false,
      lastOpenedPath: null,
      indexFiles: defaultLiveServerIndexFiles(),
      host: normalizeLiveServerHost(undefined),
      headers: [],
      routes: defaultLiveServerRoutes(),
      ssl: defaultLiveServerSslSettings()
    };
  }
  return {
    openPath: normalizeLiveServerOpenPath(value.openPath),
    rememberLastUrl: value.rememberLastUrl === true,
    lastOpenedPath: normalizeLiveServerLastOpenedPath(value.lastOpenedPath),
    indexFiles: normalizeLiveServerIndexFiles(value.indexFiles),
    host: normalizeLiveServerHost(value.host),
    headers: normalizeLiveServerHeaders(value.headers),
    routes: normalizeLiveServerRoutes(value.routes),
    ssl: normalizeLiveServerSslSettings(
      value.ssl != null && typeof value.ssl === 'object'
        ? (value.ssl as Partial<LiveServerSslSettings>)
        : undefined
    )
  };
}

/**
 * Configuration shared by saved and running live servers.
 *
 * New fields (`openPath`, `host`, `headers`, `ssl`, …) are required here.
 * Call {@link normalizeLiveServerConfigFields} (and CORS helpers) when loading
 * legacy payloads so callers always produce a complete config. Step 2 updates
 * SQLite/IPC to round-trip these fields.
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

  /**
   * Path or file opened when the Live Page starts (always leading `/`).
   */
  openPath: string;

  /**
   * When true, navigations within the origin update {@link lastOpenedPath}.
   */
  rememberLastUrl: boolean;

  /**
   * Last opened path+search+hash within the origin; null when never recorded.
   */
  lastOpenedPath: string | null;

  /**
   * Ordered directory index filenames for Express static.
   */
  indexFiles: string[];

  /**
   * Listen bind host (e.g. `127.0.0.1` or `0.0.0.0`).
   */
  host: string;

  /**
   * Custom response headers applied after CORS and before static.
   */
  headers: LiveServerResponseHeader[];

  /**
   * Ordered path routing rules applied after static miss (first match wins).
   */
  routes: LiveServerRoute[];

  /**
   * TLS settings for HTTPS listen.
   */
  ssl: LiveServerSslSettings;
}

/**
 * A saved live server config in the local registry.
 *
 * Same expanded fields as {@link LiveServerConfig}; legacy rows must be
 * normalized via {@link normalizeLiveServerConfigFields} when listed.
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
   * Path or file opened when the Live Page starts (always leading `/`).
   */
  openPath: string;

  /**
   * When true, navigations within the origin update {@link lastOpenedPath}.
   */
  rememberLastUrl: boolean;

  /**
   * Last opened path+search+hash within the origin; null when never recorded.
   */
  lastOpenedPath: string | null;

  /**
   * Ordered directory index filenames for Express static.
   */
  indexFiles: string[];

  /**
   * Listen bind host (e.g. `127.0.0.1` or `0.0.0.0`).
   */
  host: string;

  /**
   * Custom response headers applied after CORS and before static.
   */
  headers: LiveServerResponseHeader[];

  /**
   * Ordered path routing rules applied after static miss (first match wins).
   */
  routes: LiveServerRoute[];

  /**
   * TLS settings for HTTPS listen.
   */
  ssl: LiveServerSslSettings;

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
 *
 * Expanded fields are optional; persistence fills defaults via the normalize
 * helpers when omitted.
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

  /**
   * Entry / open path. Defaults to `/`.
   */
  openPath?: string;

  /**
   * Whether to remember the last opened URL. Defaults to false.
   */
  rememberLastUrl?: boolean;

  /**
   * Last opened path+search+hash, or null. Defaults to null.
   */
  lastOpenedPath?: string | null;

  /**
   * Directory index filenames. Defaults to `['index.html']`.
   */
  indexFiles?: string[];

  /**
   * Listen bind host. Defaults to `127.0.0.1`.
   */
  host?: string;

  /**
   * Custom response headers. Defaults to `[]`.
   */
  headers?: LiveServerResponseHeader[];

  /**
   * Path routing rules. Defaults to `[]`.
   */
  routes?: LiveServerRoute[];

  /**
   * TLS settings. Defaults to {@link defaultLiveServerSslSettings}.
   */
  ssl?: LiveServerSslSettings;
}

/**
 * Input for updating a saved live server in the local registry.
 *
 * Expanded fields are required (same pattern as `watch` / `cors`) so updates
 * do not silently drop persisted values.
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

  /**
   * Entry / open path relative to the server origin.
   */
  openPath: string;

  /**
   * Whether to remember the last opened URL.
   */
  rememberLastUrl: boolean;

  /**
   * Last opened path+search+hash within the origin, or null.
   */
  lastOpenedPath: string | null;

  /**
   * Directory index filenames.
   */
  indexFiles: string[];

  /**
   * Listen bind host.
   */
  host: string;

  /**
   * Custom response headers.
   */
  headers: LiveServerResponseHeader[];

  /**
   * Path routing rules.
   */
  routes: LiveServerRoute[];

  /**
   * TLS settings.
   */
  ssl: LiveServerSslSettings;
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
