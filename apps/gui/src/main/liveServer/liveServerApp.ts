import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { CorsOptions } from 'cors';
import type { LiveServerAlias, LiveServerCorsSettings } from '@harborclient/core/types';
import { defaultLiveServerCorsSettings } from '@harborclient/core/types';

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

  return {
    origin,
    methods,
    allowedHeaders,
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
 * Builds an Express app that serves a document root with optional path aliases.
 *
 * Aliases are mounted before the root static middleware so they take precedence.
 * Dotfiles are ignored and `index.html` is used as the directory index.
 * When CORS is enabled, middleware is mounted before static handlers so headers
 * apply to successful responses and the catch-all 404.
 * When `onRequestLog` is provided, access logging runs first so every response
 * (including 404) is recorded.
 *
 * @param root - Absolute document-root directory.
 * @param aliases - Path aliases to mount before the root.
 * @param corsSettings - CORS middleware settings; defaults to permissive enabled.
 * @param onRequestLog - Optional callback for completed request access lines.
 * @returns Configured Express application (not yet listening).
 */
export function createLiveServerApp(
  root: string,
  aliases: LiveServerAlias[] = [],
  corsSettings: LiveServerCorsSettings = defaultLiveServerCorsSettings(),
  onRequestLog?: LiveServerRequestLogCallback
): Express {
  const resolvedRoot = path.resolve(root);
  assertDirectoryRoot(resolvedRoot);

  const app = express();
  app.disable('x-powered-by');

  if (onRequestLog != null) {
    mountRequestLogMiddleware(app, onRequestLog);
  }

  if (corsSettings.enabled) {
    app.use(cors(toCorsOptions(corsSettings)));
  }

  for (const alias of aliases) {
    const mountPath = normalizeAliasPath(alias.path);
    if (mountPath === '/') {
      continue;
    }
    const target = resolveAliasTarget(resolvedRoot, alias.target);
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      continue;
    }
    app.use(
      mountPath,
      express.static(target, {
        index: ['index.html'],
        dotfiles: 'ignore',
        fallthrough: true
      })
    );
  }

  app.use(
    express.static(resolvedRoot, {
      index: ['index.html'],
      dotfiles: 'ignore',
      fallthrough: true
    })
  );

  app.use((_req, res) => {
    res.status(404).type('text/plain').send('Not found');
  });

  return app;
}
