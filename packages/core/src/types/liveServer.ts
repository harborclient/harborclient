import { z } from 'zod';
import { normalizeScriptRefs } from '../scriptRefs';
import type { ScriptRef } from './script';

/**
 * Default path-match pattern for a newly added live-server script row.
 */
export const DEFAULT_LIVE_SERVER_SCRIPT_MATCH_PATH = 'index.html';

/**
 * One pre/post request script on a live server, keyed by a path-match pattern.
 *
 * Extends {@link ScriptRef} so the shared script list editor and snippet flows
 * can reuse the same row model. `stage` is always coerced to `main` — the
 * Before/Main/After axis is unused for live servers.
 */
export interface LiveServerScriptRef extends ScriptRef {
  /**
   * Glob matched against the request path; only matching requests run the script.
   *
   * Examples: `index.html`, `/api/*`, `*.png`, `*`.
   */
  matchPath: string;
}

/**
 * Normalizes a path-match pattern for a live-server script row.
 *
 * Empty or non-string values fall back to {@link DEFAULT_LIVE_SERVER_SCRIPT_MATCH_PATH}.
 *
 * @param value - Raw match path from storage or the editor.
 * @returns Trimmed match path, or the default when blank.
 */
export function normalizeLiveServerScriptMatchPath(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_LIVE_SERVER_SCRIPT_MATCH_PATH;
  }
  const trimmed = value.trim();
  return trimmed === '' ? DEFAULT_LIVE_SERVER_SCRIPT_MATCH_PATH : trimmed;
}

/**
 * Normalizes live-server pre/post script rows from storage or IPC.
 *
 * Coerces each row through {@link normalizeScriptRefs}, forces `stage` to `main`,
 * and defaults blank `matchPath` values to {@link DEFAULT_LIVE_SERVER_SCRIPT_MATCH_PATH}.
 *
 * @param value - Raw script array from storage, IPC, or create/update input.
 * @returns Normalized {@link LiveServerScriptRef} list (empty when missing/invalid).
 */
export function normalizeLiveServerScriptRefs(value: unknown): LiveServerScriptRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return normalizeScriptRefs(value as ScriptRef[]).map((ref, index) => {
    const raw = value[index] as { matchPath?: unknown } | undefined;
    return {
      ...ref,
      stage: 'main',
      matchPath: normalizeLiveServerScriptMatchPath(raw?.matchPath)
    };
  });
}

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
 * One custom error-page mapping for a live server (status code → HTML file).
 *
 * When the server would return status ≥ 400, the first matching enabled page
 * (exact → decade `40x` → class `4xx`) is served instead of the plaintext body.
 */
export interface LiveServerErrorPage {
  /**
   * Status pattern: exact (`404`), decade (`40x`), or class (`4xx`).
   * The letter `x` is case-insensitive.
   */
  code: string;

  /**
   * HTML file path, absolute or relative to the server root.
   */
  path: string;

  /**
   * When false, the mapping is ignored. Defaults to true when omitted.
   */
  enabled?: boolean;
}

/**
 * Regex for a valid live-server error-page code pattern.
 *
 * Accepts exact three-digit codes (`404`), decade wildcards (`40x`), and class
 * wildcards (`4xx`). The letter `x` is case-insensitive. Only 1xx–5xx ranges.
 */
export const LIVE_SERVER_ERROR_PAGE_CODE_PATTERN = /^(?:[1-5]\d{2}|[1-5]\d[xX]|[1-5][xX]{2})$/;

/**
 * Returns whether a string is a valid live-server error-page code pattern.
 *
 * @param value - Candidate code from the editor or storage.
 * @returns True when the value matches exact / decade / class formats.
 */
export function isValidLiveServerErrorPageCode(value: string): boolean {
  return LIVE_SERVER_ERROR_PAGE_CODE_PATTERN.test(value.trim());
}

/**
 * Returns how specifically an error-page code matches a status (higher wins).
 *
 * Exact three-digit codes score 3, decade patterns (`40x`) score 2, class
 * patterns (`4xx`) score 1. Non-matching or disabled patterns score 0.
 *
 * @param code - Normalized error-page code pattern.
 * @param status - HTTP status code (typically ≥ 400).
 * @returns Specificity score, or 0 when the pattern does not match.
 */
export function liveServerErrorPageCodeSpecificity(code: string, status: number): number {
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    return 0;
  }
  const normalized = code.trim().toLowerCase();
  if (!isValidLiveServerErrorPageCode(normalized)) {
    return 0;
  }
  const statusText = String(status);
  if (normalized.length === 3 && !normalized.includes('x')) {
    return normalized === statusText ? 3 : 0;
  }
  if (normalized.length === 3 && normalized.endsWith('x') && normalized[1] !== 'x') {
    return normalized[0] === statusText[0] && normalized[1] === statusText[1] ? 2 : 0;
  }
  if (normalized.length === 3 && normalized.endsWith('xx')) {
    return normalized[0] === statusText[0] ? 1 : 0;
  }
  return 0;
}

/**
 * Picks the best enabled error page for an HTTP status code.
 *
 * Only statuses ≥ 400 are considered. Among matching enabled rows, the most
 * specific code wins (exact → `40x` → `4xx`); ties keep the first list entry.
 *
 * @param status - HTTP status about to be returned.
 * @param pages - Normalized error-page rows.
 * @returns Matching page, or `null` when none apply.
 */
export function matchLiveServerErrorPage(
  status: number,
  pages: LiveServerErrorPage[]
): LiveServerErrorPage | null {
  if (!Number.isInteger(status) || status < 400) {
    return null;
  }
  let best: LiveServerErrorPage | null = null;
  let bestScore = 0;
  for (const page of pages) {
    if (page.enabled === false) {
      continue;
    }
    const score = liveServerErrorPageCodeSpecificity(page.code, status);
    if (score > bestScore) {
      best = page;
      bestScore = score;
    }
  }
  return best;
}

/**
 * One reverse-proxy rule for a live server (path prefix → HTTP/HTTPS upstream).
 *
 * Rules mount before aliases and document-root static. First matching enabled
 * prefix wins. WebSocket upgrades are not forwarded in v1.
 */
export interface LiveServerProxy {
  /**
   * URL path prefix, e.g. `/api`. Use `/` or `*` for a catch-all (stored as `/`).
   */
  path: string;

  /**
   * Upstream absolute URL origin, optionally with a base path, e.g.
   * `http://127.0.0.1:3000` or `http://127.0.0.1:3000/v1`.
   */
  target: string;

  /**
   * When true (default), strip the matched prefix before appending to the
   * upstream URL path.
   */
  stripPath?: boolean;

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
 * Normalizes the optional companion process command string.
 *
 * Non-strings become `''`. Whitespace is trimmed; empty means no command.
 *
 * @param value - Raw command from storage or the editor.
 * @returns Trimmed command string, or empty when unset.
 */
export function normalizeLiveServerRunCommand(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

/**
 * Normalizes the optional global-variable name that receives the server origin URL.
 *
 * Non-strings become `''`. Whitespace is trimmed; empty means do not set a variable.
 *
 * @param value - Raw variable name from storage or the editor.
 * @returns Trimmed variable key, or empty when unset.
 */
export function normalizeLiveServerUrlVariable(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
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
 * Default error-page mappings for a new live server (none).
 *
 * @returns A fresh empty error-page list.
 */
export function defaultLiveServerErrorPages(): LiveServerErrorPage[] {
  return [];
}

/**
 * Normalizes an error-page list from storage or IPC.
 *
 * Corrupt entries, invalid codes, and rows with an empty path are dropped.
 * Codes are trimmed and lowercased for the `x` wildcard. `enabled` defaults to
 * true when omitted. Order is preserved for same-specificity ties.
 *
 * @param value - Array of error-page rows, or unknown legacy payload.
 * @returns Normalized error-page rows (may be empty).
 */
export function normalizeLiveServerErrorPages(value: unknown): LiveServerErrorPage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const pages: LiveServerErrorPage[] = [];
  for (const entry of value) {
    if (entry == null || typeof entry !== 'object') {
      continue;
    }
    const row = entry as Partial<LiveServerErrorPage>;
    const code = typeof row.code === 'string' ? row.code.trim().toLowerCase() : '';
    const filePath = typeof row.path === 'string' ? row.path.trim() : '';
    if (code === '' || filePath === '' || !isValidLiveServerErrorPageCode(code)) {
      continue;
    }
    pages.push({
      code,
      path: filePath,
      enabled: row.enabled !== false
    });
  }
  return pages;
}

/**
 * Default reverse-proxy rules for a new live server (none).
 *
 * @returns A fresh empty proxy list.
 */
export function defaultLiveServerProxies(): LiveServerProxy[] {
  return [];
}

/**
 * Normalizes a proxy path prefix: leading `/`, no trailing `/`.
 *
 * Empty strings are invalid. `/` and `*` are catch-alls and canonicalize to `/`.
 *
 * @param value - Raw path from storage or the editor.
 * @returns Normalized prefix, or `null` when invalid.
 */
export function normalizeLiveServerProxyPath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  if (trimmed === '/' || trimmed === '*') {
    return '/';
  }
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const withoutTrailing = withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
  return withoutTrailing === '' ? null : withoutTrailing;
}

/**
 * Returns whether a proxy target string is a usable http(s) absolute URL.
 *
 * @param value - Trimmed target URL string.
 * @returns True when the URL has an http or https scheme and a host.
 */
export function isValidLiveServerProxyTarget(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname !== '';
  } catch {
    return false;
  }
}

/**
 * Normalizes a reverse-proxy rule list from storage or IPC.
 *
 * Corrupt entries and rows with an invalid path prefix or non-http(s) target
 * are dropped. `stripPath` and `enabled` default to true when omitted. Order
 * is preserved (first match wins at runtime).
 *
 * @param value - Array of proxy rows, or unknown legacy payload.
 * @returns Normalized proxy rows (may be empty).
 */
export function normalizeLiveServerProxies(value: unknown): LiveServerProxy[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const proxies: LiveServerProxy[] = [];
  for (const entry of value) {
    if (entry == null || typeof entry !== 'object') {
      continue;
    }
    const row = entry as Partial<LiveServerProxy>;
    const path = normalizeLiveServerProxyPath(row.path);
    const target = typeof row.target === 'string' ? row.target.trim() : '';
    if (path == null || target === '' || !isValidLiveServerProxyTarget(target)) {
      continue;
    }
    proxies.push({
      path,
      target,
      stripPath: row.stripPath !== false,
      enabled: row.enabled !== false
    });
  }
  return proxies;
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
   * When true, open a Live Page at the start path when the server starts.
   */
  openPathOnStartup?: unknown;

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
   * Status-code → HTML file mappings for custom error pages.
   */
  errorPages?: unknown;

  /**
   * Reverse-proxy rules (path prefix → upstream).
   */
  proxies?: unknown;

  /**
   * TLS certificate settings.
   */
  ssl?: unknown;

  /**
   * Optional companion process command (absolute binary + args).
   */
  runCommand?: unknown;

  /**
   * When true, restart the companion process after an unexpected crash.
   */
  restartOnCrash?: unknown;

  /**
   * Global variable name set to the server origin URL on start.
   */
  urlVariable?: unknown;

  /**
   * Pre-request scripts keyed by path-match patterns.
   */
  preRequestScripts?: unknown;

  /**
   * Post-request scripts keyed by path-match patterns.
   */
  postRequestScripts?: unknown;
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
   * When true, open a Live Page at {@link openPath} (or the remembered path)
   * when the server starts.
   */
  openPathOnStartup: boolean;

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
   * Status-code → HTML file mappings for custom error responses.
   */
  errorPages: LiveServerErrorPage[];

  /**
   * Ordered reverse-proxy rules applied before static (first match wins).
   */
  proxies: LiveServerProxy[];

  /**
   * TLS settings for HTTPS listen.
   */
  ssl: LiveServerSslSettings;

  /**
   * Companion process command template (absolute binary + args). Empty means
   * none. May include `{{variables}}` resolved from globals at Start/restart.
   */
  runCommand: string;

  /**
   * When true, restart the companion process after an unexpected non-zero exit
   * or signal (not on intentional Stop or clean exit 0).
   */
  restartOnCrash: boolean;

  /**
   * Global variable name set to the server origin URL when the server starts.
   * Empty means do not write a variable.
   */
  urlVariable: string;

  /**
   * Pre-request scripts that run before proxy/static for matching paths.
   */
  preRequestScripts: LiveServerScriptRef[];

  /**
   * Post-request scripts that run after the response finishes for matching paths.
   */
  postRequestScripts: LiveServerScriptRef[];
}

/**
 * Normalizes the expanded live-server config fields added for open path, index
 * files, bind host, response headers, routing rules, error pages, reverse proxies, SSL,
 * optional companion run command, URL variable, and pre/post request scripts.
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
      openPathOnStartup: true,
      rememberLastUrl: false,
      lastOpenedPath: null,
      indexFiles: defaultLiveServerIndexFiles(),
      host: normalizeLiveServerHost(undefined),
      headers: [],
      routes: defaultLiveServerRoutes(),
      errorPages: defaultLiveServerErrorPages(),
      proxies: defaultLiveServerProxies(),
      ssl: defaultLiveServerSslSettings(),
      runCommand: normalizeLiveServerRunCommand(undefined),
      restartOnCrash: false,
      urlVariable: normalizeLiveServerUrlVariable(undefined),
      preRequestScripts: [],
      postRequestScripts: []
    };
  }
  return {
    openPath: normalizeLiveServerOpenPath(value.openPath),
    openPathOnStartup: value.openPathOnStartup !== false,
    rememberLastUrl: value.rememberLastUrl === true,
    lastOpenedPath: normalizeLiveServerLastOpenedPath(value.lastOpenedPath),
    indexFiles: normalizeLiveServerIndexFiles(value.indexFiles),
    host: normalizeLiveServerHost(value.host),
    headers: normalizeLiveServerHeaders(value.headers),
    routes: normalizeLiveServerRoutes(value.routes),
    errorPages: normalizeLiveServerErrorPages(value.errorPages),
    proxies: normalizeLiveServerProxies(value.proxies),
    ssl: normalizeLiveServerSslSettings(
      value.ssl != null && typeof value.ssl === 'object'
        ? (value.ssl as Partial<LiveServerSslSettings>)
        : undefined
    ),
    runCommand: normalizeLiveServerRunCommand(value.runCommand),
    restartOnCrash: value.restartOnCrash === true,
    urlVariable: normalizeLiveServerUrlVariable(value.urlVariable),
    preRequestScripts: normalizeLiveServerScriptRefs(value.preRequestScripts),
    postRequestScripts: normalizeLiveServerScriptRefs(value.postRequestScripts)
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
   * When true, open a Live Page at the start path when the server starts.
   */
  openPathOnStartup: boolean;

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
   * Status-code → HTML file mappings for custom error responses.
   */
  errorPages: LiveServerErrorPage[];

  /**
   * Ordered reverse-proxy rules applied before static (first match wins).
   */
  proxies: LiveServerProxy[];

  /**
   * TLS settings for HTTPS listen.
   */
  ssl: LiveServerSslSettings;

  /**
   * Companion process command (absolute binary + args). Empty means none.
   */
  runCommand: string;

  /**
   * When true, restart the companion process after an unexpected crash.
   */
  restartOnCrash: boolean;

  /**
   * Global variable name set to the server origin URL when the server starts.
   * Empty means do not write a variable.
   */
  urlVariable: string;

  /**
   * Pre-request scripts that run before proxy/static for matching paths.
   */
  preRequestScripts: LiveServerScriptRef[];

  /**
   * Post-request scripts that run after the response finishes for matching paths.
   */
  postRequestScripts: LiveServerScriptRef[];
}

/**
 * Input accepted by {@link toLiveServerConfig}.
 *
 * Mirrors saved live-server rows and editor drafts. Expanded fields may be
 * omitted; {@link normalizeLiveServerConfigFields} fills defaults.
 */
export interface ToLiveServerConfigInput {
  name: string;
  root: string;
  port: number | null;
  aliases: LiveServerConfig['aliases'];
  watch: boolean;
  cors?: LiveServerCorsSettings;
  openPath?: string;
  openPathOnStartup?: boolean;
  rememberLastUrl?: boolean;
  lastOpenedPath?: string | null;
  /**
   * Directory index filenames as an array or comma-separated editor string.
   */
  indexFiles?: string | string[];
  host?: string;
  headers?: LiveServerConfig['headers'];
  routes?: LiveServerConfig['routes'];
  errorPages?: LiveServerConfig['errorPages'];
  proxies?: LiveServerConfig['proxies'];
  ssl?: LiveServerConfig['ssl'];
  runCommand?: string;
  restartOnCrash?: boolean;
  urlVariable?: string;
  preRequestScripts?: LiveServerConfig['preRequestScripts'];
  postRequestScripts?: LiveServerConfig['postRequestScripts'];
}

/**
 * Builds a {@link LiveServerConfig} from saved or editor fields.
 *
 * Expanded fields (`openPath`, `host`, `headers`, `ssl`, …) are optional on
 * the input and filled via {@link normalizeLiveServerConfigFields} so callers
 * that predate those settings still produce a complete config. `indexFiles`
 * may be a `string[]` or a comma-separated editor string.
 *
 * Pure and browser-safe — keep this in core so the renderer never imports the
 * Node/Express live-server host package.
 *
 * @param input - Partial config fields.
 * @returns Normalized config suitable for start/save.
 */
export function toLiveServerConfig(input: ToLiveServerConfigInput): LiveServerConfig {
  const fields = normalizeLiveServerConfigFields(input);
  return {
    name: input.name.trim() || 'Live Server',
    root: input.root.trim(),
    port: input.port,
    aliases: input.aliases,
    watch: input.watch,
    cors: normalizeLiveServerCorsSettings(input.cors),
    ...fields
  };
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
   * When true, open a Live Page at the start path when the server starts.
   */
  openPathOnStartup: boolean;

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
   * Status-code → HTML file mappings for custom error responses.
   */
  errorPages: LiveServerErrorPage[];

  /**
   * Ordered reverse-proxy rules applied before static (first match wins).
   */
  proxies: LiveServerProxy[];

  /**
   * TLS settings for HTTPS listen.
   */
  ssl: LiveServerSslSettings;

  /**
   * Companion process command (absolute binary + args). Empty means none.
   */
  runCommand: string;

  /**
   * When true, restart the companion process after an unexpected crash.
   */
  restartOnCrash: boolean;

  /**
   * Global variable name set to the server origin URL when the server starts.
   * Empty means do not write a variable.
   */
  urlVariable: string;

  /**
   * Pre-request scripts that run before proxy/static for matching paths.
   */
  preRequestScripts: LiveServerScriptRef[];

  /**
   * Post-request scripts that run after the response finishes for matching paths.
   */
  postRequestScripts: LiveServerScriptRef[];

  /**
   * Sort order within the Live Servers sidebar section.
   */
  sortOrder: number;

  /**
   * Id of the storage connection that stores this live server.
   *
   * Omitted for provider-local records before RoutingStorage merges registry metadata.
   */
  connectionId?: string;

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
   * Optional portable uuid; generated when omitted.
   */
  uuid?: string;

  /**
   * Optional storage connection id; defaults to the active data provider when omitted.
   */
  connectionId?: string;

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
   * Whether to open a Live Page on start. Defaults to true.
   */
  openPathOnStartup?: boolean;

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
   * Custom error-page mappings. Defaults to `[]`.
   */
  errorPages?: LiveServerErrorPage[];

  /**
   * Reverse-proxy rules. Defaults to `[]`.
   */
  proxies?: LiveServerProxy[];

  /**
   * TLS settings. Defaults to {@link defaultLiveServerSslSettings}.
   */
  ssl?: LiveServerSslSettings;

  /**
   * Companion process command. Defaults to `''` (none).
   */
  runCommand?: string;

  /**
   * Whether to restart the companion on crash. Defaults to false.
   */
  restartOnCrash?: boolean;

  /**
   * Global variable name set to the server origin URL on start. Defaults to `''`.
   */
  urlVariable?: string;

  /**
   * Pre-request scripts. Defaults to `[]`.
   */
  preRequestScripts?: LiveServerScriptRef[];

  /**
   * Post-request scripts. Defaults to `[]`.
   */
  postRequestScripts?: LiveServerScriptRef[];
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
   * Whether to open a Live Page on start.
   */
  openPathOnStartup: boolean;

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
   * Custom error-page mappings.
   */
  errorPages: LiveServerErrorPage[];

  /**
   * Reverse-proxy rules.
   */
  proxies: LiveServerProxy[];

  /**
   * TLS settings.
   */
  ssl: LiveServerSslSettings;

  /**
   * Companion process command (absolute binary + args). Empty means none.
   */
  runCommand: string;

  /**
   * When true, restart the companion process after an unexpected crash.
   */
  restartOnCrash: boolean;

  /**
   * Global variable name set to the server origin URL when the server starts.
   * Empty means do not write a variable.
   */
  urlVariable: string;

  /**
   * Pre-request scripts that run before proxy/static for matching paths.
   */
  preRequestScripts: LiveServerScriptRef[];

  /**
   * Post-request scripts that run after the response finishes for matching paths.
   */
  postRequestScripts: LiveServerScriptRef[];
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

  /**
   * Lifecycle status of the optional companion `runCommand` process.
   */
  runCommandStatus?: LiveServerRunCommandStatus;

  /**
   * Short error message when the companion process failed to start or exhausted
   * restart attempts; omitted when healthy.
   */
  runCommandError?: string;
}

/**
 * Companion process lifecycle for a running live server.
 */
export type LiveServerRunCommandStatus = 'running' | 'exited' | 'restarting' | 'failed';

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
   * Discriminator for mixed log buffers; omitted on legacy access-only entries.
   */
  kind?: 'access';

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
 * One script console / test / error line from a live-server pre or post script.
 */
export interface LiveServerScriptLogEntry {
  /**
   * Discriminator for mixed log buffers.
   */
  kind: 'script';

  /**
   * Runtime instance id of the server that ran the script.
   */
  id: string;

  /**
   * Saved `live_servers.id` when the instance was started from a saved config.
   */
  savedId: number | null;

  /**
   * Unix timestamp (ms) when the line was emitted.
   */
  timestamp: number;

  /**
   * Script phase that produced the line.
   */
  phase: 'pre' | 'post';

  /**
   * Request pathname the script was matched against.
   */
  url: string;

  /**
   * Display label of the script row (match path or name).
   */
  scriptLabel: string;

  /**
   * Line kind within the script run.
   */
  level: 'log' | 'info' | 'warn' | 'error' | 'test' | 'script-error';

  /**
   * Human-readable message (console args joined, test name, or error text).
   */
  message: string;

  /**
   * For `test` lines: whether the assertion passed.
   */
  passed?: boolean;
}

/**
 * One companion run-command stdout, stderr, or lifecycle line.
 */
export interface LiveServerProcessLogEntry {
  /**
   * Discriminator for mixed log buffers.
   */
  kind: 'process';

  /**
   * Runtime instance id of the server that owns the companion process.
   */
  id: string;

  /**
   * Saved `live_servers.id` when the instance was started from a saved config.
   */
  savedId: number | null;

  /**
   * Unix timestamp (ms) when the line was emitted.
   */
  timestamp: number;

  /**
   * Child stdout/stderr, or `system` for lifecycle messages (start/exit/fail).
   */
  stream: 'stdout' | 'stderr' | 'system';

  /**
   * One logical line of process output or a short lifecycle message.
   */
  message: string;
}

/**
 * One line in a live server's mixed access + script + process log buffer.
 */
export type LiveServerLogEntry =
  | LiveServerRequestLogEntry
  | LiveServerScriptLogEntry
  | LiveServerProcessLogEntry;

/**
 * One retained log session created when a live server starts.
 *
 * Sessions outlive the running instance so the Server Logs sidebar can show
 * stopped runs until the user clears them. Metadata only — log lines are not
 * included in list payloads.
 */
export interface LiveServerLogSession {
  /**
   * Runtime instance id (uuid) for this start; also used as the session key.
   */
  id: string;

  /**
   * Saved `live_servers.id` when started from a saved config.
   */
  savedId: number | null;

  /**
   * Display name of the server at start time.
   */
  serverName: string;

  /**
   * Listen origin while running, or the last origin after stop.
   */
  origin: string;

  /**
   * Unix timestamp (ms) when the instance started.
   */
  startedAt: number;

  /**
   * Unix timestamp (ms) when the instance stopped, or null while still active.
   */
  stoppedAt: number | null;

  /**
   * True while the runtime instance is still accepting requests and appending logs.
   */
  active: boolean;
}

/**
 * Query used to read or clear buffered request logs for one session.
 *
 * `{ id }` matches a session by runtime id (active or stopped). `{ savedId }`
 * resolves to the active session for that saved server, else the latest session.
 */
export type LiveServerLogsQuery = { savedId: number } | { id: string };

/**
 * Returns whether a log entry is a script console/test/error line.
 *
 * @param entry - Mixed log buffer entry.
 * @returns True when the entry is a {@link LiveServerScriptLogEntry}.
 */
export function isLiveServerScriptLogEntry(
  entry: LiveServerLogEntry
): entry is LiveServerScriptLogEntry {
  return entry.kind === 'script';
}

/**
 * Returns whether a log entry is a companion run-command process line.
 *
 * @param entry - Mixed log buffer entry.
 * @returns True when the entry is a {@link LiveServerProcessLogEntry}.
 */
export function isLiveServerProcessLogEntry(
  entry: LiveServerLogEntry
): entry is LiveServerProcessLogEntry {
  return entry.kind === 'process';
}

/**
 * Portable HarborClient live-server export envelope.
 */
export interface LiveServerExport {
  /**
   * HarborClient export schema version.
   */
  harborclientVersion: 1;

  /**
   * Discriminator identifying this file as a live-server export.
   */
  harborclientExport: 'server';

  /**
   * Stable portable identifier.
   */
  uuid: string;

  /**
   * Display name for the live server.
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
   * Path aliases mounted before the document root static middleware.
   */
  aliases?: LiveServerAlias[];

  /**
   * When true, file watching is enabled when this server is started.
   */
  watch?: boolean;

  /**
   * CORS middleware settings.
   */
  cors?: LiveServerCorsSettings;

  /**
   * Path or file opened when the Live Page starts.
   */
  openPath?: string;

  /**
   * When true, open a Live Page at the start path when the server starts.
   */
  openPathOnStartup?: boolean;

  /**
   * When true, navigations within the origin update {@link lastOpenedPath}.
   */
  rememberLastUrl?: boolean;

  /**
   * Last opened path+search+hash within the origin; null when never recorded.
   */
  lastOpenedPath?: string | null;

  /**
   * Ordered directory index filenames.
   */
  indexFiles?: string[];

  /**
   * Listen bind host.
   */
  host?: string;

  /**
   * Custom response headers.
   */
  headers?: LiveServerResponseHeader[];

  /**
   * Path routing / SPA fallback rules.
   */
  routes?: LiveServerRoute[];

  /**
   * Custom error-page mappings (status code → HTML file).
   */
  errorPages?: LiveServerErrorPage[];

  /**
   * Reverse-proxy rules.
   */
  proxies?: LiveServerProxy[];

  /**
   * TLS certificate settings.
   */
  ssl?: LiveServerSslSettings;

  /**
   * Companion process command.
   */
  runCommand?: string;

  /**
   * When true, restart the companion process after an unexpected crash.
   */
  restartOnCrash?: boolean;

  /**
   * Global variable name set to the server origin URL on start.
   */
  urlVariable?: string;

  /**
   * Pre-request scripts keyed by path-match patterns.
   */
  pre_request_scripts?: LiveServerScriptRef[];

  /**
   * Post-request scripts keyed by path-match patterns.
   */
  post_request_scripts?: LiveServerScriptRef[];
}

const liveServerAliasExportSchema = z.object({
  path: z.string(),
  target: z.string()
}) satisfies z.ZodType<LiveServerAlias>;

const liveServerResponseHeaderExportSchema = z.object({
  name: z.string(),
  value: z.string(),
  enabled: z.boolean().optional()
}) satisfies z.ZodType<LiveServerResponseHeader>;

const liveServerRouteExportSchema = z.object({
  match: z.string(),
  target: z.string(),
  enabled: z.boolean().optional()
}) satisfies z.ZodType<LiveServerRoute>;

const liveServerErrorPageExportSchema = z.object({
  code: z.string(),
  path: z.string(),
  enabled: z.boolean().optional()
}) satisfies z.ZodType<LiveServerErrorPage>;

const liveServerProxyExportSchema = z.object({
  path: z.string(),
  target: z.string(),
  stripPath: z.boolean().optional(),
  enabled: z.boolean().optional()
}) satisfies z.ZodType<LiveServerProxy>;

const liveServerSslExportSchema = z.object({
  enabled: z.boolean(),
  certPath: z.string(),
  keyPath: z.string()
}) satisfies z.ZodType<LiveServerSslSettings>;

const liveServerCorsExportSchema = z.object({
  enabled: z.boolean(),
  origin: z.string(),
  methods: z.string(),
  allowedHeaders: z.string(),
  exposedHeaders: z.string(),
  maxAge: z.string(),
  credentials: z.boolean()
}) satisfies z.ZodType<LiveServerCorsSettings>;

const scriptStageSchema = z.enum(['before-all', 'before-each', 'main', 'after-each', 'after-all']);

const liveServerScriptRefExportSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    enabled: z.boolean(),
    kind: z.literal('inline'),
    name: z.string().optional(),
    code: z.string().optional(),
    expanded: z.boolean().optional(),
    stage: scriptStageSchema.optional(),
    matchPath: z.string()
  }),
  z.object({
    id: z.string().min(1),
    enabled: z.boolean(),
    kind: z.literal('snippet'),
    name: z.string().optional(),
    snippetUuid: z.string().min(1),
    expanded: z.boolean().optional(),
    stage: scriptStageSchema.optional(),
    matchPath: z.string()
  })
]) satisfies z.ZodType<LiveServerScriptRef>;

/**
 * Zod schema for validating live-server export files.
 */
export const liveServerExportSchema = z.object({
  harborclientVersion: z.literal(1),
  harborclientExport: z.literal('server'),
  uuid: z.string().trim().min(1),
  name: z.string().trim().min(1),
  root: z.string().trim().min(1),
  port: z.number().int().positive().max(65535).nullable(),
  aliases: z.array(liveServerAliasExportSchema).optional(),
  watch: z.boolean().optional(),
  cors: liveServerCorsExportSchema.optional(),
  openPath: z.string().optional(),
  openPathOnStartup: z.boolean().optional(),
  rememberLastUrl: z.boolean().optional(),
  lastOpenedPath: z.union([z.string(), z.null()]).optional(),
  indexFiles: z.array(z.string()).optional(),
  host: z.string().optional(),
  headers: z.array(liveServerResponseHeaderExportSchema).optional(),
  routes: z.array(liveServerRouteExportSchema).optional(),
  errorPages: z.array(liveServerErrorPageExportSchema).optional(),
  proxies: z.array(liveServerProxyExportSchema).optional(),
  ssl: liveServerSslExportSchema.optional(),
  runCommand: z.string().optional(),
  restartOnCrash: z.boolean().optional(),
  urlVariable: z.string().optional(),
  pre_request_scripts: z.array(liveServerScriptRefExportSchema).optional(),
  post_request_scripts: z.array(liveServerScriptRefExportSchema).optional()
}) satisfies z.ZodType<LiveServerExport>;

/**
 * Validates a parsed live-server export payload.
 *
 * @param data - Unknown parsed JSON.
 * @returns Normalized live-server export.
 * @throws When validation fails.
 */
export function validateLiveServerExport(data: unknown): LiveServerExport {
  return liveServerExportSchema.parse(data);
}

/**
 * Input fields for {@link buildLiveServerExport}.
 */
export interface BuildLiveServerExportInput {
  /**
   * Stable portable identifier.
   */
  uuid: string;

  /**
   * Display name for the live server.
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
   * Path aliases.
   */
  aliases?: LiveServerAlias[];

  /**
   * Whether file watching is enabled when started.
   */
  watch?: boolean;

  /**
   * CORS middleware settings.
   */
  cors?: LiveServerCorsSettings;

  /**
   * Entry / open path.
   */
  openPath?: string;

  /**
   * Whether to open a Live Page on start.
   */
  openPathOnStartup?: boolean;

  /**
   * Whether to remember the last opened URL.
   */
  rememberLastUrl?: boolean;

  /**
   * Last opened path+search+hash, or null.
   */
  lastOpenedPath?: string | null;

  /**
   * Directory index filenames.
   */
  indexFiles?: string[];

  /**
   * Listen bind host.
   */
  host?: string;

  /**
   * Custom response headers.
   */
  headers?: LiveServerResponseHeader[];

  /**
   * Path routing rules.
   */
  routes?: LiveServerRoute[];

  /**
   * Custom error-page mappings.
   */
  errorPages?: LiveServerErrorPage[];

  /**
   * Reverse-proxy rules.
   */
  proxies?: LiveServerProxy[];

  /**
   * TLS settings.
   */
  ssl?: LiveServerSslSettings;

  /**
   * Companion process command.
   */
  runCommand?: string;

  /**
   * Whether to restart the companion on crash.
   */
  restartOnCrash?: boolean;

  /**
   * Global variable name set to the server origin URL on start.
   */
  urlVariable?: string;

  /**
   * Pre-request scripts.
   */
  preRequestScripts?: LiveServerScriptRef[];

  /**
   * Post-request scripts.
   */
  postRequestScripts?: LiveServerScriptRef[];
}

/**
 * Builds a portable live-server export envelope.
 *
 * @param input - Live server fields to serialize.
 * @returns Live-server export object.
 */
export function buildLiveServerExport(input: BuildLiveServerExportInput): LiveServerExport {
  return {
    harborclientVersion: 1,
    harborclientExport: 'server',
    uuid: input.uuid,
    name: input.name,
    root: input.root,
    port: input.port,
    ...(input.aliases != null && input.aliases.length > 0 ? { aliases: input.aliases } : {}),
    ...(input.watch != null ? { watch: input.watch } : {}),
    ...(input.cors != null ? { cors: input.cors } : {}),
    ...(input.openPath != null && input.openPath !== '' ? { openPath: input.openPath } : {}),
    ...(input.openPathOnStartup != null ? { openPathOnStartup: input.openPathOnStartup } : {}),
    ...(input.rememberLastUrl != null ? { rememberLastUrl: input.rememberLastUrl } : {}),
    ...(input.lastOpenedPath !== undefined ? { lastOpenedPath: input.lastOpenedPath } : {}),
    ...(input.indexFiles != null && input.indexFiles.length > 0
      ? { indexFiles: input.indexFiles }
      : {}),
    ...(input.host != null && input.host !== '' ? { host: input.host } : {}),
    ...(input.headers != null && input.headers.length > 0 ? { headers: input.headers } : {}),
    ...(input.routes != null && input.routes.length > 0 ? { routes: input.routes } : {}),
    ...(input.errorPages != null && input.errorPages.length > 0
      ? { errorPages: input.errorPages }
      : {}),
    ...(input.proxies != null && input.proxies.length > 0 ? { proxies: input.proxies } : {}),
    ...(input.ssl != null ? { ssl: input.ssl } : {}),
    ...(input.runCommand != null && input.runCommand !== ''
      ? { runCommand: input.runCommand }
      : {}),
    ...(input.restartOnCrash != null ? { restartOnCrash: input.restartOnCrash } : {}),
    ...(input.urlVariable != null && input.urlVariable !== ''
      ? { urlVariable: input.urlVariable }
      : {}),
    ...(input.preRequestScripts != null && input.preRequestScripts.length > 0
      ? { pre_request_scripts: input.preRequestScripts }
      : {}),
    ...(input.postRequestScripts != null && input.postRequestScripts.length > 0
      ? { post_request_scripts: input.postRequestScripts }
      : {})
  };
}
