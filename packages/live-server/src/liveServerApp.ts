import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import type { CorsOptions } from 'cors';
import type {
  LiveServerAlias,
  LiveServerCorsSettings,
  LiveServerErrorPage,
  LiveServerProxy,
  LiveServerResponseHeader,
  LiveServerRoute
} from '@harborclient/core/types';
import {
  defaultLiveServerCorsSettings,
  defaultLiveServerIndexFiles,
  isSafeLiveServerRouteMatch,
  matchLiveServerErrorPage,
  normalizeLiveServerErrorPages,
  normalizeLiveServerIndexFiles,
  normalizeLiveServerProxies,
  normalizeLiveServerRoutes
} from '@harborclient/core/types';
import {
  mountLiveServerScriptsMiddleware,
  type LiveServerScriptAwareRequest,
  type MountLiveServerScriptsOptions
} from './liveServerScripts.js';

/**
 * Access-log fields emitted when a live-server HTTP response finishes.
 *
 * Identity (`id` / `savedId`) is attached by the host; the middleware only
 * reports request timing and outcome.
 */
export interface LiveServerAccessLogFields {
  /**
   * Unix timestamp (ms) when the request was received.
   */
  timestamp: number;

  /**
   * HTTP method.
   */
  method: string;

  /**
   * Request URL path including query string.
   */
  url: string;

  /**
   * HTTP response status code.
   */
  statusCode: number;

  /**
   * Elapsed time until response finish/close, in milliseconds.
   */
  durationMs: number;

  /**
   * Response `Content-Length` when present and numeric; otherwise null.
   */
  contentLength: number | null;
}

/**
 * Callback invoked after each completed HTTP response on a live server.
 */
export type LiveServerRequestLogCallback = (fields: LiveServerAccessLogFields) => void;

/**
 * Options for {@link createLiveServerApp} beyond the required document root.
 */
export interface CreateLiveServerAppOptions {
  /**
   * Path aliases mounted before the document root.
   */
  aliases?: LiveServerAlias[];

  /**
   * CORS middleware settings; defaults to permissive enabled.
   */
  corsSettings?: LiveServerCorsSettings;

  /**
   * Directory index filenames for `express.static` (root and aliases).
   * Empty or invalid lists fall back to `['index.html']`.
   */
  indexFiles?: string[];

  /**
   * Custom response headers applied after CORS and before static, including 404.
   */
  headers?: LiveServerResponseHeader[];

  /**
   * Reverse-proxy rules applied after headers and before aliases/static.
   */
  proxies?: LiveServerProxy[];

  /**
   * Path routing rules applied after static miss (SPA / soft rewrite).
   */
  routes?: LiveServerRoute[];

  /**
   * Status-code → HTML file mappings for custom error responses (≥ 400).
   */
  errorPages?: LiveServerErrorPage[];

  /**
   * Optional callback for completed request access lines.
   */
  onRequestLog?: LiveServerRequestLogCallback;

  /**
   * Optional pre/post request script middleware options.
   *
   * When set, scripts mount after the access log and before CORS/proxy/static
   * so pre scripts finish before the Run command companion sees traffic.
   */
  scripts?: MountLiveServerScriptsOptions;
}

/**
 * Splits a comma-separated CORS list field into trimmed non-empty tokens.
 *
 * @param value - Raw comma-separated string from settings.
 * @returns Trimmed tokens, or an empty array when blank.
 */
function splitCorsList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/**
 * Maps persisted live-server CORS settings to Express `cors` options.
 *
 * Empty `exposedHeaders` / `maxAge` are omitted so the `cors` package defaults
 * apply. Invalid non-empty `maxAge` values are also omitted.
 *
 * @param settings - Normalized CORS settings from the live-server config.
 * @returns Options passed to the `cors` middleware.
 */
export function toCorsOptions(settings: LiveServerCorsSettings): CorsOptions {
  const originRaw = settings.origin.trim();
  let origin: CorsOptions['origin'] = '*';
  if (originRaw === '*') {
    origin = '*';
  } else {
    const origins = splitCorsList(originRaw);
    if (origins.length === 0) {
      origin = '*';
    } else if (origins.length === 1) {
      origin = origins[0];
    } else {
      origin = origins;
    }
  }

  const methodsRaw = settings.methods.trim();
  const methods =
    methodsRaw === '' || methodsRaw === '*' ? methodsRaw || '*' : splitCorsList(methodsRaw);

  const headersRaw = settings.allowedHeaders.trim();
  // Empty or `*` lets the cors package reflect Access-Control-Request-Headers.
  const allowedHeaders =
    headersRaw === '' || headersRaw === '*' ? undefined : splitCorsList(headersRaw);

  const exposedRaw = settings.exposedHeaders.trim();
  let exposedHeaders: CorsOptions['exposedHeaders'];
  if (exposedRaw === '') {
    exposedHeaders = undefined;
  } else if (exposedRaw === '*') {
    exposedHeaders = '*';
  } else {
    const list = splitCorsList(exposedRaw);
    exposedHeaders = list.length > 0 ? list : undefined;
  }

  const maxAgeRaw = settings.maxAge.trim();
  let maxAge: CorsOptions['maxAge'];
  if (maxAgeRaw === '' || !/^\d+$/.test(maxAgeRaw)) {
    maxAge = undefined;
  } else {
    const parsed = Number.parseInt(maxAgeRaw, 10);
    maxAge = Number.isFinite(parsed) ? parsed : undefined;
  }

  return {
    origin,
    methods,
    allowedHeaders,
    exposedHeaders,
    maxAge,
    credentials: settings.credentials
  };
}

/**
 * Resolves an alias target against the document root.
 *
 * Absolute targets are returned as-is; relative targets are joined to `root`.
 *
 * @param root - Absolute document-root directory.
 * @param target - Alias filesystem target.
 * @returns Absolute filesystem path for the alias.
 */
export function resolveAliasTarget(root: string, target: string): string {
  if (path.isAbsolute(target)) {
    return path.resolve(target);
  }
  return path.resolve(root, target);
}

/**
 * Normalizes an alias URL path so Express mounts it correctly.
 *
 * Ensures a leading slash and strips a trailing slash (except for `/`).
 *
 * @param aliasPath - Raw alias path from config.
 * @returns Normalized mount path.
 */
export function normalizeAliasPath(aliasPath: string): string {
  const trimmed = aliasPath.trim();
  if (trimmed === '' || trimmed === '/') {
    return '/';
  }
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}

/**
 * Validates that a directory exists and is readable as a document root.
 *
 * @param root - Absolute path to validate.
 * @throws When the path is missing or not a directory.
 */
export function assertDirectoryRoot(root: string): void {
  let stats: fs.Stats;
  try {
    stats = fs.statSync(root);
  } catch {
    throw new Error(`Root directory does not exist: ${root}`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`Root path is not a directory: ${root}`);
  }
}

/**
 * Parses a response Content-Length header into a finite number when possible.
 *
 * @param value - Header value from `res.getHeader('content-length')`.
 * @returns Parsed length, or null when missing/invalid.
 */
function parseContentLength(value: number | string | string[] | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Mounts middleware that emits one access-log line when each response finishes.
 *
 * Uses `finish` and `close` so aborted connections are still recorded once.
 *
 * @param app - Express app to instrument.
 * @param onRequestLog - Callback that receives timing and status fields.
 */
function mountRequestLogMiddleware(app: Express, onRequestLog: LiveServerRequestLogCallback): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const timestamp = Date.now();
    let logged = false;

    /**
     * Emits a single access-log entry for this request.
     */
    const emitLog = (): void => {
      if (logged) {
        return;
      }
      logged = true;
      const scriptReq = req as LiveServerScriptAwareRequest;
      onRequestLog({
        timestamp,
        method: req.method,
        url: scriptReq.hcInboundUrl ?? (req.originalUrl || req.url),
        statusCode: res.statusCode,
        durationMs: Date.now() - timestamp,
        contentLength: parseContentLength(res.getHeader('content-length'))
      });
    };

    res.on('finish', emitLog);
    res.on('close', emitLog);
    next();
  });
}

/**
 * Filters response-header rows that should be applied to outgoing responses.
 *
 * Skips rows with an empty name or `enabled === false`.
 *
 * @param headers - Configured response headers (may include disabled/empty rows).
 * @returns Headers that will be set on every response.
 */
function activeResponseHeaders(headers: LiveServerResponseHeader[]): LiveServerResponseHeader[] {
  return headers.filter((header) => header.enabled !== false && header.name.trim() !== '');
}

/**
 * Mounts middleware that sets configured custom response headers on every reply.
 *
 * Runs after CORS and before static so headers apply to 200s and the catch-all
 * 404 alike. No-op when there are no active header rows.
 *
 * @param app - Express app to instrument.
 * @param headers - Configured response headers from the live-server config.
 */
function mountResponseHeaderMiddleware(app: Express, headers: LiveServerResponseHeader[]): void {
  const active = activeResponseHeaders(headers);
  if (active.length === 0) {
    return;
  }

  app.use((_req: Request, res: Response, next: NextFunction) => {
    for (const header of active) {
      res.setHeader(header.name.trim(), header.value);
    }
    next();
  });
}

/**
 * Hop-by-hop headers that must not be forwarded by a reverse proxy (RFC 7230).
 *
 * `host` is also stripped from the inbound request so the upstream Host can be
 * set to the target host (changeOrigin-equivalent).
 */
const LIVE_SERVER_PROXY_HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host'
]);

/**
 * Returns whether a request pathname matches a reverse-proxy path prefix.
 *
 * `/` is a catch-all and matches every pathname. Otherwise matches the prefix
 * exactly or as a directory prefix (`/api` matches `/api` and `/api/users`,
 * but not `/apiv2`).
 *
 * @param pathname - Express `req.path` (pathname only).
 * @param prefix - Normalized proxy path prefix (`/` catch-all, or leading `/`
 *   with no trailing `/`).
 * @returns True when the path is under the prefix.
 */
export function pathMatchesLiveServerProxyPrefix(pathname: string, prefix: string): boolean {
  if (prefix === '/') {
    return true;
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Joins an upstream base pathname with a request path suffix.
 *
 * @param basePath - Upstream URL pathname (may be `/` or `/v1`).
 * @param suffix - Remaining request path after optional prefix strip.
 * @returns Combined pathname (always starts with `/` when non-empty).
 */
function joinProxyUrlPaths(basePath: string, suffix: string): string {
  const base = basePath === '/' ? '' : basePath.replace(/\/$/, '');
  if (suffix === '' || suffix === '/') {
    return base === '' ? '/' : base;
  }
  const rest = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return `${base}${rest}`;
}

/**
 * Builds the absolute upstream URL for a matched reverse-proxy rule.
 *
 * When `stripPath` is true (default), the matched prefix is removed from the
 * request pathname before appending to the upstream base path. Catch-all
 * proxies (`path: '/'`) always forward the full pathname — strip is a no-op.
 * The inbound query string is preserved.
 *
 * @param requestPath - Express request pathname (e.g. `/api/users`).
 * @param requestUrl - Express `originalUrl` or `url` (may include `?query`).
 * @param proxy - Matched proxy rule (path + target + stripPath).
 * @returns Absolute upstream URL including path and search.
 * @throws When `proxy.target` is not a valid absolute URL.
 */
export function buildLiveServerProxiedUpstreamUrl(
  requestPath: string,
  requestUrl: string,
  proxy: LiveServerProxy
): URL {
  const target = new URL(proxy.target);
  const stripPath = proxy.stripPath !== false && proxy.path !== '/';
  const suffix = stripPath
    ? requestPath === proxy.path
      ? ''
      : requestPath.slice(proxy.path.length)
    : requestPath;
  const pathname = joinProxyUrlPaths(target.pathname || '/', suffix);
  const queryIndex = requestUrl.indexOf('?');
  const search = queryIndex >= 0 ? requestUrl.slice(queryIndex) : '';
  const upstream = new URL(target.origin);
  upstream.pathname = pathname;
  if (search !== '') {
    upstream.search = search.startsWith('?') ? search.slice(1) : search;
  }
  return upstream;
}

/**
 * Copies inbound request headers into an outbound header map, skipping hop-by-hop
 * names so the proxy can set a fresh `Host`.
 *
 * @param inbound - Express request headers.
 * @param upstreamHost - Host header value for the upstream (hostname[:port]).
 * @returns Headers suitable for `http.request` / `https.request`.
 */
function buildLiveServerProxyRequestHeaders(
  inbound: Request['headers'],
  upstreamHost: string
): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(inbound)) {
    if (value == null) {
      continue;
    }
    if (LIVE_SERVER_PROXY_HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue;
    }
    headers[name] = value;
  }
  headers.host = upstreamHost;
  return headers;
}

/**
 * Resolves an error-page file path against the document root.
 *
 * Absolute paths are used as-is; relative paths join under `root`. Returns null
 * when the path does not exist or is not a regular file.
 *
 * @param root - Absolute document root.
 * @param filePath - Configured error-page path (absolute or root-relative).
 * @returns Absolute file path, or null when unusable.
 */
export function resolveLiveServerErrorPageFile(root: string, filePath: string): string | null {
  const trimmed = filePath.trim();
  if (trimmed === '') {
    return null;
  }
  const resolved = resolveAliasTarget(root, trimmed);
  try {
    if (fs.statSync(resolved).isFile()) {
      return resolved;
    }
  } catch {
    // Missing or inaccessible.
  }
  return null;
}

/**
 * Attempts to send a configured HTML error page for the given status.
 *
 * @param res - Outgoing Express response.
 * @param root - Absolute document root.
 * @param status - HTTP status about to be returned (≥ 400).
 * @param pages - Normalized error-page rows.
 * @returns True when an error-page file was sent.
 */
function trySendLiveServerErrorPage(
  res: Response,
  root: string,
  status: number,
  pages: LiveServerErrorPage[]
): boolean {
  if (res.headersSent) {
    return false;
  }
  const page = matchLiveServerErrorPage(status, pages);
  if (page == null) {
    return false;
  }
  const filePath = resolveLiveServerErrorPageFile(root, page.path);
  if (filePath == null) {
    return false;
  }
  res.status(status).type('text/html').sendFile(filePath);
  return true;
}

/**
 * Writes an error response, preferring a configured HTML error page.
 *
 * Falls back to plaintext when no page matches or the file is missing. Destroys
 * the socket when headers were already sent.
 *
 * @param res - Outgoing Express response.
 * @param root - Absolute document root.
 * @param status - HTTP status to return.
 * @param pages - Normalized error-page rows.
 * @param fallbackPlaintext - Body when no error page applies.
 */
function sendLiveServerErrorResponse(
  res: Response,
  root: string,
  status: number,
  pages: LiveServerErrorPage[],
  fallbackPlaintext: string
): void {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  if (trySendLiveServerErrorPage(res, root, status, pages)) {
    return;
  }
  res.status(status).type('text/plain').send(fallbackPlaintext);
}

/**
 * Writes a 502 response when the upstream cannot be reached or the target URL
 * is invalid, using a configured error page when available.
 *
 * @param res - Outgoing Express response.
 * @param root - Absolute document root.
 * @param errorPages - Normalized error-page rows.
 */
function sendLiveServerBadGateway(
  res: Response,
  root: string,
  errorPages: LiveServerErrorPage[]
): void {
  sendLiveServerErrorResponse(res, root, 502, errorPages, 'Bad gateway');
}

/**
 * Forwards one matched request to an upstream HTTP/HTTPS origin.
 *
 * Streams the request body and response body. Overwrites response headers with
 * upstream values (after hop-by-hop filtering) so the backend controls
 * Content-Type and similar. When the upstream status is ≥ 400 and a matching
 * error page exists, the upstream body is discarded and the HTML page is sent
 * instead. Aborts the upstream request when the client disconnects.
 *
 * @param req - Incoming Express request.
 * @param res - Outgoing Express response.
 * @param proxy - Matched proxy rule.
 * @param root - Absolute document root (for error-page resolution).
 * @param errorPages - Normalized error-page rows.
 */
function forwardLiveServerProxyRequest(
  req: Request,
  res: Response,
  proxy: LiveServerProxy,
  root: string,
  errorPages: LiveServerErrorPage[]
): void {
  let upstreamUrl: URL;
  try {
    upstreamUrl = buildLiveServerProxiedUpstreamUrl(req.path, req.originalUrl || req.url, proxy);
  } catch {
    sendLiveServerBadGateway(res, root, errorPages);
    return;
  }

  const isHttps = upstreamUrl.protocol === 'https:';
  const transport = isHttps ? https : http;
  const headers = buildLiveServerProxyRequestHeaders(req.headers, upstreamUrl.host);

  const upstreamReq = transport.request(
    {
      protocol: upstreamUrl.protocol,
      hostname: upstreamUrl.hostname,
      port: upstreamUrl.port || (isHttps ? 443 : 80),
      path: `${upstreamUrl.pathname}${upstreamUrl.search}`,
      method: req.method,
      headers
    },
    (upstreamRes) => {
      const status = upstreamRes.statusCode ?? 502;
      if (status >= 400 && trySendLiveServerErrorPage(res, root, status, errorPages)) {
        upstreamRes.resume();
        return;
      }
      res.statusCode = status;
      for (const [name, value] of Object.entries(upstreamRes.headers)) {
        if (value == null) {
          continue;
        }
        if (LIVE_SERVER_PROXY_HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
          continue;
        }
        res.setHeader(name, value);
      }
      upstreamRes.pipe(res);
    }
  );

  upstreamReq.on('error', () => {
    sendLiveServerBadGateway(res, root, errorPages);
  });

  /**
   * Aborts the upstream request when the client goes away mid-transfer.
   */
  const abortUpstream = (): void => {
    upstreamReq.destroy();
  };

  req.on('aborted', abortUpstream);
  res.on('close', () => {
    if (!res.writableFinished) {
      abortUpstream();
    }
  });

  req.pipe(upstreamReq);
}

/**
 * Mounts reverse-proxy middleware for configured path-prefix rules.
 *
 * Runs after CORS/custom headers and before aliases/static. Enabled rules are
 * tried in order; the first matching prefix is forwarded. Unmatched requests
 * fall through to static serving. Upstream failures respond with 502 (or a
 * matching error page when configured).
 *
 * @param app - Express app to instrument.
 * @param proxies - Normalized proxy rules.
 * @param root - Absolute document root.
 * @param errorPages - Normalized error-page rows.
 */
function mountLiveServerProxyMiddleware(
  app: Express,
  proxies: LiveServerProxy[],
  root: string,
  errorPages: LiveServerErrorPage[]
): void {
  const active = proxies.filter((proxy) => proxy.enabled !== false);
  if (active.length === 0) {
    return;
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    for (const proxy of active) {
      if (pathMatchesLiveServerProxyPrefix(req.path, proxy.path)) {
        forwardLiveServerProxyRequest(req, res, proxy, root, errorPages);
        return;
      }
    }
    next();
  });
}

/**
 * Returns whether `candidate` is the same as or nested under `rootDir`.
 *
 * @param candidate - Absolute filesystem path to check.
 * @param rootDir - Absolute directory that must contain `candidate`.
 * @returns True when `candidate` is inside `rootDir` (or equal to it).
 */
export function isPathInsideDirectory(candidate: string, rootDir: string): boolean {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(rootDir);
  if (resolvedCandidate === resolvedRoot) {
    return true;
  }
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  return resolvedCandidate.startsWith(prefix);
}

/**
 * Tests whether a request pathname matches a routing rule's `match` pattern.
 *
 * `*` matches every path. Other values are compiled as `RegExp` only when
 * {@link isSafeLiveServerRouteMatch} accepts them (length and nested-quantifier
 * caps). Unsafe or invalid patterns never match (caller should skip the rule).
 *
 * @param pathname - Express `req.path` (pathname only).
 * @param match - Route match string (`*` or regex source).
 * @returns True when the path matches.
 */
export function pathMatchesLiveServerRoute(pathname: string, match: string): boolean {
  const trimmed = match.trim();
  if (!isSafeLiveServerRouteMatch(trimmed)) {
    return false;
  }
  if (trimmed === '*') {
    return true;
  }
  try {
    return new RegExp(trimmed).test(pathname);
  } catch {
    return false;
  }
}

/**
 * Resolves a file to send for a directory route target and request path.
 *
 * Joins `req.path` under `directory`, rejects traversal outside that directory,
 * and when the result is a directory, tries the configured index filenames.
 *
 * @param directory - Absolute directory for this route target.
 * @param requestPath - Express request pathname (e.g. `/about`).
 * @param indexFiles - Directory index filenames to try when the path is a dir.
 * @returns Absolute file path to send, or null when nothing is found/safe.
 */
function resolveDirectoryRouteFile(
  directory: string,
  requestPath: string,
  indexFiles: string[]
): string | null {
  const relative = requestPath.replace(/^\/+/, '');
  const candidate = path.resolve(directory, relative);
  if (!isPathInsideDirectory(candidate, directory)) {
    return null;
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(candidate);
  } catch {
    return null;
  }

  if (stats.isFile()) {
    return candidate;
  }

  if (!stats.isDirectory()) {
    return null;
  }

  for (const indexName of indexFiles) {
    const indexPath = path.resolve(candidate, indexName);
    if (!isPathInsideDirectory(indexPath, directory)) {
      continue;
    }
    try {
      if (fs.statSync(indexPath).isFile()) {
        return indexPath;
      }
    } catch {
      // Try the next index name.
    }
  }
  return null;
}

/**
 * Attempts to satisfy a missed static request with one routing rule.
 *
 * @param root - Absolute document root (for resolving relative targets).
 * @param route - Single routing rule.
 * @param req - Incoming request.
 * @param res - Outgoing response.
 * @param indexFiles - Index filenames when the target is a directory.
 * @returns True when a response was sent; false to try the next rule.
 */
function tryServeLiveServerRoute(
  root: string,
  route: LiveServerRoute,
  req: Request,
  res: Response,
  indexFiles: string[]
): boolean {
  if (route.enabled === false) {
    return false;
  }
  if (!pathMatchesLiveServerRoute(req.path, route.match)) {
    return false;
  }

  const resolvedTarget = resolveAliasTarget(root, route.target);
  let stats: fs.Stats;
  try {
    stats = fs.statSync(resolvedTarget);
  } catch {
    return false;
  }

  if (stats.isFile()) {
    res.sendFile(resolvedTarget);
    return true;
  }

  if (!stats.isDirectory()) {
    return false;
  }

  const filePath = resolveDirectoryRouteFile(resolvedTarget, req.path, indexFiles);
  if (filePath == null) {
    return false;
  }
  res.sendFile(filePath);
  return true;
}

/**
 * Mounts post-static routing middleware (SPA fallback / soft rewrites).
 *
 * Only GET/HEAD are considered. Enabled rules are tried in order; the first
 * match that can serve a file wins. Otherwise a 404 is sent (HTML error page
 * when configured, else plaintext).
 *
 * @param app - Express app to instrument.
 * @param root - Absolute document root.
 * @param routes - Normalized routing rules.
 * @param indexFiles - Index filenames for directory targets.
 * @param errorPages - Normalized error-page rows.
 */
function mountLiveServerRouteMiddleware(
  app: Express,
  root: string,
  routes: LiveServerRoute[],
  indexFiles: string[],
  errorPages: LiveServerErrorPage[]
): void {
  const activeRoutes = routes.filter((route) => route.enabled !== false);

  app.use((req: Request, res: Response) => {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD') {
      for (const route of activeRoutes) {
        if (tryServeLiveServerRoute(root, route, req, res, indexFiles)) {
          return;
        }
      }
    }
    sendLiveServerErrorResponse(res, root, 404, errorPages, 'Not found');
  });
}

/**
 * Builds an Express app that serves a document root with optional path aliases.
 *
 * Aliases are mounted before the root static middleware so they take precedence.
 * Directory indexes use the configured `indexFiles` list (default `index.html`).
 * When CORS is enabled, middleware is mounted before static handlers so headers
 * apply to successful responses and the catch-all 404. Custom response headers
 * mount after CORS and before reverse proxies / static for the same reason.
 * Reverse-proxy rules run after headers and before aliases/static (Vite-style).
 * Routing rules run after static miss (history-api-fallback style).
 * When `onRequestLog` is provided, access logging runs first so every response
 * (including 404) is recorded.
 *
 * @param root - Absolute document-root directory.
 * @param options - Aliases, CORS, index files, headers, proxies, routes, and access log.
 * @returns Configured Express application (not yet listening).
 */
export function createLiveServerApp(
  root: string,
  options: CreateLiveServerAppOptions = {}
): Express {
  const {
    aliases = [],
    corsSettings = defaultLiveServerCorsSettings(),
    indexFiles: indexFilesInput,
    headers = [],
    proxies: proxiesInput,
    routes: routesInput,
    errorPages: errorPagesInput,
    onRequestLog,
    scripts
  } = options;

  const resolvedRoot = path.resolve(root);
  assertDirectoryRoot(resolvedRoot);

  const indexFiles =
    indexFilesInput != null
      ? normalizeLiveServerIndexFiles(indexFilesInput)
      : defaultLiveServerIndexFiles();

  const proxies =
    proxiesInput != null
      ? normalizeLiveServerProxies(proxiesInput)
      : normalizeLiveServerProxies([]);

  const routes =
    routesInput != null ? normalizeLiveServerRoutes(routesInput) : normalizeLiveServerRoutes([]);

  const errorPages =
    errorPagesInput != null
      ? normalizeLiveServerErrorPages(errorPagesInput)
      : normalizeLiveServerErrorPages([]);

  const staticOptions = {
    index: indexFiles,
    dotfiles: 'ignore' as const,
    fallthrough: true
  };

  const app = express();
  app.disable('x-powered-by');

  if (onRequestLog != null) {
    mountRequestLogMiddleware(app, onRequestLog);
  }

  if (scripts != null) {
    mountLiveServerScriptsMiddleware(app, scripts);
  }

  if (corsSettings.enabled) {
    app.use(cors(toCorsOptions(corsSettings)));
  }

  mountResponseHeaderMiddleware(app, headers);
  mountLiveServerProxyMiddleware(app, proxies, resolvedRoot, errorPages);

  for (const alias of aliases) {
    const mountPath = normalizeAliasPath(alias.path);
    if (mountPath === '/') {
      continue;
    }
    const target = resolveAliasTarget(resolvedRoot, alias.target);
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      continue;
    }
    app.use(mountPath, express.static(target, staticOptions));
  }

  app.use(express.static(resolvedRoot, staticOptions));

  mountLiveServerRouteMiddleware(app, resolvedRoot, routes, indexFiles, errorPages);

  return app;
}
