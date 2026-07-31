import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { CorsOptions } from 'cors';
import type {
  LiveServerAlias,
  LiveServerCorsSettings,
  LiveServerResponseHeader,
  LiveServerRoute
} from '@harborclient/core/types';
import {
  defaultLiveServerCorsSettings,
  defaultLiveServerIndexFiles,
  normalizeLiveServerIndexFiles,
  normalizeLiveServerRoutes
} from '@harborclient/core/types';

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
   * Path routing rules applied after static miss (SPA / soft rewrite).
   */
  routes?: LiveServerRoute[];

  /**
   * Optional callback for completed request access lines.
   */
  onRequestLog?: LiveServerRequestLogCallback;
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
      onRequestLog({
        timestamp,
        method: req.method,
        url: req.originalUrl || req.url,
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
 * `*` matches every path. Other values are compiled as `RegExp`; invalid
 * patterns never match (caller should skip the rule).
 *
 * @param pathname - Express `req.path` (pathname only).
 * @param match - Route match string (`*` or regex source).
 * @returns True when the path matches.
 */
export function pathMatchesLiveServerRoute(pathname: string, match: string): boolean {
  const trimmed = match.trim();
  if (trimmed === '') {
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
 * match that can serve a file wins. Otherwise a plaintext 404 is sent.
 *
 * @param app - Express app to instrument.
 * @param root - Absolute document root.
 * @param routes - Normalized routing rules.
 * @param indexFiles - Index filenames for directory targets.
 */
function mountLiveServerRouteMiddleware(
  app: Express,
  root: string,
  routes: LiveServerRoute[],
  indexFiles: string[]
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
    res.status(404).type('text/plain').send('Not found');
  });
}

/**
 * Builds an Express app that serves a document root with optional path aliases.
 *
 * Aliases are mounted before the root static middleware so they take precedence.
 * Directory indexes use the configured `indexFiles` list (default `index.html`).
 * When CORS is enabled, middleware is mounted before static handlers so headers
 * apply to successful responses and the catch-all 404. Custom response headers
 * mount after CORS and before static for the same reason.
 * Routing rules run after static miss (history-api-fallback style).
 * When `onRequestLog` is provided, access logging runs first so every response
 * (including 404) is recorded.
 *
 * @param root - Absolute document-root directory.
 * @param options - Aliases, CORS, index files, headers, routes, and access log.
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
    routes: routesInput,
    onRequestLog
  } = options;

  const resolvedRoot = path.resolve(root);
  assertDirectoryRoot(resolvedRoot);

  const indexFiles =
    indexFilesInput != null
      ? normalizeLiveServerIndexFiles(indexFilesInput)
      : defaultLiveServerIndexFiles();

  const routes =
    routesInput != null ? normalizeLiveServerRoutes(routesInput) : normalizeLiveServerRoutes([]);

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

  if (corsSettings.enabled) {
    app.use(cors(toCorsOptions(corsSettings)));
  }

  mountResponseHeaderMiddleware(app, headers);

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

  mountLiveServerRouteMiddleware(app, resolvedRoot, routes, indexFiles);

  return app;
}
