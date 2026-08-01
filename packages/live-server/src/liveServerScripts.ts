import type { NextFunction, Request, Response } from 'express';
import type {
  HttpMethod,
  KeyValue,
  LiveServerScriptLogEntry,
  LiveServerScriptRef,
  ScriptPhase,
  ScriptRequestContext,
  ScriptRunInput,
  ScriptRunResult,
  SendResult,
  Snippet
} from '@harborclient/core/types';
import { buildScriptRunInfo } from '@harborclient/core/types/script';
import { resolveScriptSourceCode } from '@harborclient/core/scriptRefs';
import { variableKeyIsCleared } from '@harborclient/core/scripting/variableClearMatch';
import { pathMatchesLiveServerScript } from './liveServerScriptMatch';

/**
 * Maximum response body bytes captured for post-request scripts.
 *
 * Larger responses still stream to the client; the teed body is truncated.
 */
export const LIVE_SERVER_SCRIPT_RESPONSE_BODY_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Mutable holder for live-server scripts so Save can hot-apply without restart.
 */
export interface LiveServerScriptsHolder {
  /**
   * Pre-request scripts from the saved/running config.
   */
  preRequestScripts: LiveServerScriptRef[];

  /**
   * Post-request scripts from the saved/running config.
   */
  postRequestScripts: LiveServerScriptRef[];
}

/**
 * Callback that emits a script console/test/error line into the live-server log.
 */
export type LiveServerScriptLogCallback = (
  entry: Omit<LiveServerScriptLogEntry, 'id' | 'savedId'>
) => void;

/**
 * Options for {@link mountLiveServerScriptsMiddleware}.
 */
export interface MountLiveServerScriptsOptions {
  /**
   * Returns the current scripts (read on every request for hot-apply).
   */
  getScripts: () => LiveServerScriptsHolder;

  /**
   * Saved live_servers.id when started from a saved config; used for hc.info.liveserverId.
   */
  savedId: number | null;

  /**
   * Runtime instance id (for log identity on the host side).
   */
  runtimeId: string;

  /**
   * Returns the listening origin (e.g. `http://127.0.0.1:5500`) for absolute request URLs.
   *
   * Read on each request so the host can fill it in after `listen`.
   */
  getOrigin: () => string;

  /**
   * Executes pre/post request scripts (injected by the host — Electron SES or Node).
   */
  runScript: (input: ScriptRunInput) => Promise<ScriptRunResult>;

  /**
   * Snippet list provider used to resolve `kind: 'snippet'` rows.
   */
  listSnippets: () => Snippet[];

  /**
   * Global variable map provider seeded into each script run.
   */
  getVariables: () => Record<string, string>;

  /**
   * Emits script log lines into the live-server log buffer.
   */
  onScriptLog?: LiveServerScriptLogCallback;
}

/**
 * Express request augmented with the inbound URL before pre-script rewrites.
 */
export type LiveServerScriptAwareRequest = Request & {
  /**
   * Client-requested URL (path + query) captured before pre-script mutation.
   */
  hcInboundUrl?: string;
};

/**
 * HTTP methods accepted by {@link ScriptRequestContext}.
 */
const SCRIPT_HTTP_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
]);

/**
 * Converts Express request headers into KeyValue rows for the script sandbox.
 *
 * @param headers - Express inbound headers.
 * @returns Flat key/value rows (multi-value headers joined with commas).
 */
function headersToKeyValues(headers: Request['headers']): KeyValue[] {
  const rows: KeyValue[] = [];
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) {
      continue;
    }
    rows.push({
      key,
      value: Array.isArray(value) ? value.join(', ') : String(value),
      enabled: true
    });
  }
  return rows;
}

/**
 * Converts a query object into KeyValue param rows.
 *
 * @param query - Express `req.query`.
 * @returns Param rows for the script sandbox.
 */
function queryToParams(query: Request['query']): KeyValue[] {
  const rows: KeyValue[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value == null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        rows.push({ key, value: String(entry), enabled: true });
      }
      continue;
    }
    if (typeof value === 'object') {
      continue;
    }
    rows.push({ key, value: String(value), enabled: true });
  }
  return rows;
}

/**
 * Builds a {@link ScriptRequestContext} from an Express request.
 *
 * Body is left empty so the request stream is never consumed (v1 limitation).
 *
 * @param req - Incoming Express request.
 * @param origin - Live server origin for absolute URLs.
 * @returns Request context for the SES sandbox.
 */
export function buildLiveServerScriptRequest(req: Request, origin: string): ScriptRequestContext {
  const methodUpper = req.method.toUpperCase();
  const method: HttpMethod = SCRIPT_HTTP_METHODS.has(methodUpper as HttpMethod)
    ? (methodUpper as HttpMethod)
    : 'GET';
  const pathAndQuery = req.originalUrl || req.url || '/';
  const absoluteUrl = `${origin.replace(/\/$/, '')}${pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`}`;
  return {
    method,
    url: absoluteUrl,
    headers: headersToKeyValues(req.headers),
    userAgent: '',
    params: queryToParams(req.query),
    body: '',
    bodyType: 'none',
    tags: '',
    comment: ''
  };
}

/**
 * Applies script request mutations back onto the Express request.
 *
 * Updates both `req.url` and `req.originalUrl` so reverse-proxy upstream URL
 * construction stays consistent with Express `req.path` and query string.
 *
 * @param req - Express request to mutate.
 * @param scriptRequest - Mutated request from the sandbox.
 * @param origin - Live server origin used to strip absolute URLs back to path+query.
 */
export function applyLiveServerScriptRequestMutations(
  req: LiveServerScriptAwareRequest,
  scriptRequest: ScriptRequestContext,
  origin: string
): void {
  const originBase = origin.replace(/\/$/, '');
  let pathAndQuery = scriptRequest.url.trim();
  if (pathAndQuery.startsWith(originBase)) {
    pathAndQuery = pathAndQuery.slice(originBase.length) || '/';
  } else {
    try {
      const parsed = new URL(pathAndQuery);
      pathAndQuery = `${parsed.pathname}${parsed.search}`;
    } catch {
      if (!pathAndQuery.startsWith('/')) {
        pathAndQuery = `/${pathAndQuery}`;
      }
    }
  }
  if (!pathAndQuery.startsWith('/')) {
    pathAndQuery = `/${pathAndQuery}`;
  }
  req.url = pathAndQuery;
  req.originalUrl = pathAndQuery;

  for (const header of scriptRequest.headers) {
    if (!header.enabled || header.key.trim() === '') {
      continue;
    }
    req.headers[header.key.toLowerCase()] = header.value;
  }
}

/**
 * Filters enabled scripts whose matchPath matches the request pathname.
 *
 * @param scripts - Configured script rows.
 * @param pathname - Express `req.path`.
 * @returns Matching enabled scripts in list order.
 */
export function filterMatchingLiveServerScripts(
  scripts: LiveServerScriptRef[],
  pathname: string
): LiveServerScriptRef[] {
  return scripts.filter(
    (script) => script.enabled !== false && pathMatchesLiveServerScript(pathname, script.matchPath)
  );
}

/**
 * Resolves display label for a script row in log lines.
 *
 * @param script - Script reference.
 * @returns Match path (preferred) or name fallback.
 */
function scriptLogLabel(script: LiveServerScriptRef): string {
  const match = script.matchPath.trim();
  if (match !== '') {
    return match;
  }
  return script.name?.trim() || 'script';
}

/**
 * Emits console, test, and error lines from one script run into the live-server log.
 *
 * @param options - Phase, URL, script label, result, and log callback.
 */
function emitScriptRunLogs(options: {
  phase: ScriptPhase;
  url: string;
  scriptLabel: string;
  result: ScriptRunResult;
  onScriptLog?: LiveServerScriptLogCallback;
}): void {
  const { phase, url, scriptLabel, result, onScriptLog } = options;
  if (onScriptLog == null) {
    return;
  }
  const timestamp = Date.now();
  for (const line of result.logs ?? []) {
    onScriptLog({
      kind: 'script',
      timestamp,
      phase,
      url,
      scriptLabel,
      level: line.level === 'warn' ? 'warn' : line.level === 'error' ? 'error' : 'log',
      message: line.message
    });
  }
  for (const test of result.tests ?? []) {
    onScriptLog({
      kind: 'script',
      timestamp,
      phase,
      url,
      scriptLabel,
      level: 'test',
      message: test.name,
      passed: test.passed
    });
  }
  if (result.error) {
    onScriptLog({
      kind: 'script',
      timestamp,
      phase,
      url,
      scriptLabel,
      level: 'script-error',
      message: result.error
    });
  }
}

/**
 * Applies variable sets/clears from one script onto a working map.
 *
 * @param runtimeVars - Current working variables.
 * @param result - Script run result.
 * @returns Updated map for the next script.
 */
function applyVariableResult(
  runtimeVars: Record<string, string>,
  result: ScriptRunResult
): Record<string, string> {
  const clears = [...(result.variableClears ?? []), ...(result.globalVariableClears ?? [])];
  const next = { ...runtimeVars };
  if (clears.length > 0) {
    for (const key of Object.keys(next)) {
      if (variableKeyIsCleared(key, clears)) {
        delete next[key];
      }
    }
  }
  for (const [key, value] of Object.entries(result.variableSets ?? {})) {
    next[key] = value;
  }
  for (const [key, value] of Object.entries(result.globalVariableSets ?? {})) {
    next[key] = value;
  }
  return next;
}

/**
 * Runs matching pre-request scripts, awaiting each before continuing.
 *
 * Fail-open: script errors and timeouts are logged and the pipeline continues.
 * Intentional short-circuits: `responseOverride` (hc.send body/status) or
 * `skipRequest` (204).
 *
 * @param req - Incoming request.
 * @param res - Outgoing response.
 * @param options - Scripts holder, identity, and runners.
 * @returns True when the request was short-circuited; false to continue.
 */
async function runPreRequestScripts(
  req: LiveServerScriptAwareRequest,
  res: Response,
  options: MountLiveServerScriptsOptions
): Promise<boolean> {
  const scripts = filterMatchingLiveServerScripts(options.getScripts().preRequestScripts, req.path);
  if (scripts.length === 0) {
    return false;
  }

  const runScript = options.runScript;
  const snippets = options.listSnippets();
  const origin = options.getOrigin();
  let request = buildLiveServerScriptRequest(req, origin);
  let runtimeVars = { ...options.getVariables() };
  let scriptData: Record<string, unknown> = {};
  const inboundUrl = req.originalUrl || req.url || '/';

  for (const script of scripts) {
    const source = resolveScriptSourceCode(script, snippets);
    if (!source.trim()) {
      continue;
    }
    const input: ScriptRunInput = {
      phase: 'pre',
      script: source,
      request,
      variables: runtimeVars,
      info: buildScriptRunInfo('pre', {
        requestName: options.runtimeId,
        liveserverId: options.savedId
      }),
      data: scriptData
    };
    let result: ScriptRunResult;
    try {
      result = await runScript(input);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      options.onScriptLog?.({
        kind: 'script',
        timestamp: Date.now(),
        phase: 'pre',
        url: inboundUrl,
        scriptLabel: scriptLogLabel(script),
        level: 'script-error',
        message
      });
      continue;
    }
    emitScriptRunLogs({
      phase: 'pre',
      url: inboundUrl,
      scriptLabel: scriptLogLabel(script),
      result,
      onScriptLog: options.onScriptLog
    });
    request = result.request;
    runtimeVars = applyVariableResult(runtimeVars, result);
    scriptData = result.data ?? scriptData;
    if (result.responseOverride) {
      applyLiveServerScriptRequestMutations(req, request, origin);
      if (!res.headersSent) {
        const override = result.responseOverride;
        res.status(override.status);
        for (const [name, value] of Object.entries(override.headers)) {
          res.setHeader(name, value);
        }
        res.send(override.body);
      }
      return true;
    }
    if (result.skipRequest) {
      applyLiveServerScriptRequestMutations(req, request, origin);
      if (!res.headersSent) {
        res.status(204).end();
      }
      return true;
    }
  }

  applyLiveServerScriptRequestMutations(req, request, origin);
  return false;
}

/**
 * Collects response chunks for post-request scripts while still streaming to the client.
 *
 * @param res - Express response to tee.
 * @returns Capture state mutated as chunks are written.
 */
function installResponseTee(res: Response): {
  chunks: Buffer[];
  truncated: boolean;
  size: number;
} {
  const state = { chunks: [] as Buffer[], truncated: false, size: 0 };
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  /**
   * Appends a chunk to the capture buffer when under the size cap.
   *
   * @param chunk - Written chunk, or null/undefined when none.
   */
  const capture = (chunk: unknown): void => {
    if (chunk == null || state.truncated) {
      return;
    }
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : typeof chunk === 'string'
        ? Buffer.from(chunk)
        : null;
    if (buf == null) {
      return;
    }
    if (state.size + buf.length > LIVE_SERVER_SCRIPT_RESPONSE_BODY_MAX_BYTES) {
      state.truncated = true;
      return;
    }
    state.chunks.push(buf);
    state.size += buf.length;
  };

  res.write = ((
    chunk: unknown,
    encodingOrCb?: BufferEncoding | ((error: Error | null | undefined) => void),
    cb?: (error: Error | null | undefined) => void
  ): boolean => {
    capture(chunk);
    if (typeof encodingOrCb === 'function') {
      return originalWrite(chunk as never, encodingOrCb);
    }
    return originalWrite(chunk as never, encodingOrCb as BufferEncoding, cb);
  }) as typeof res.write;

  res.end = ((
    chunkOrCb?: unknown,
    encodingOrCb?: BufferEncoding | (() => void),
    cb?: () => void
  ): Response => {
    if (typeof chunkOrCb !== 'function') {
      capture(chunkOrCb);
    }
    if (typeof chunkOrCb === 'function') {
      return originalEnd(chunkOrCb);
    }
    if (typeof encodingOrCb === 'function') {
      return originalEnd(chunkOrCb as never, encodingOrCb);
    }
    return originalEnd(chunkOrCb as never, encodingOrCb as BufferEncoding, cb);
  }) as typeof res.end;

  return state;
}

/**
 * Builds a {@link SendResult} from a finished Express response and teed body.
 *
 * @param res - Finished response.
 * @param body - Captured body text (possibly truncated).
 * @param timeMs - Elapsed request time.
 * @returns Snapshot for post-request scripts.
 */
function buildLiveServerSendResult(res: Response, body: string, timeMs: number): SendResult {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(res.getHeaders())) {
    if (value == null) {
      continue;
    }
    headers[name] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return {
    status: res.statusCode,
    statusText: res.statusMessage || '',
    headers,
    body,
    timeMs,
    sizeBytes: Buffer.byteLength(body)
  };
}

/**
 * Runs matching post-request scripts after the response has finished streaming.
 *
 * @param req - Original request (post-rewrite path).
 * @param res - Finished response.
 * @param tee - Captured body state.
 * @param startedAt - Request start timestamp.
 * @param options - Scripts holder and runners.
 */
async function runPostRequestScripts(
  req: LiveServerScriptAwareRequest,
  res: Response,
  tee: { chunks: Buffer[]; truncated: boolean },
  startedAt: number,
  options: MountLiveServerScriptsOptions
): Promise<void> {
  const pathname = req.path;
  const scripts = filterMatchingLiveServerScripts(
    options.getScripts().postRequestScripts,
    pathname
  );
  if (scripts.length === 0) {
    return;
  }

  const runScript = options.runScript;
  const snippets = options.listSnippets();
  const request = buildLiveServerScriptRequest(req, options.getOrigin());
  let runtimeVars = { ...options.getVariables() };
  let scriptData: Record<string, unknown> = {};
  let body = Buffer.concat(tee.chunks).toString('utf8');
  if (tee.truncated) {
    body = `${body}\n/* [HarborClient] response body truncated for post-request scripts */`;
  }
  const response = buildLiveServerSendResult(res, body, Date.now() - startedAt);
  const logUrl = req.hcInboundUrl ?? req.originalUrl ?? req.url ?? '/';

  for (const script of scripts) {
    const source = resolveScriptSourceCode(script, snippets);
    if (!source.trim()) {
      continue;
    }
    const input: ScriptRunInput = {
      phase: 'post',
      script: source,
      request,
      response,
      variables: runtimeVars,
      info: buildScriptRunInfo('post', {
        requestName: options.runtimeId,
        liveserverId: options.savedId
      }),
      data: scriptData
    };
    let result: ScriptRunResult;
    try {
      result = await runScript(input);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      options.onScriptLog?.({
        kind: 'script',
        timestamp: Date.now(),
        phase: 'post',
        url: logUrl,
        scriptLabel: scriptLogLabel(script),
        level: 'script-error',
        message
      });
      continue;
    }
    emitScriptRunLogs({
      phase: 'post',
      url: logUrl,
      scriptLabel: scriptLogLabel(script),
      result,
      onScriptLog: options.onScriptLog
    });
    if (result.responseOverride) {
      options.onScriptLog?.({
        kind: 'script',
        timestamp: Date.now(),
        phase: 'post',
        url: logUrl,
        scriptLabel: scriptLogLabel(script),
        level: 'warn',
        message:
          'hc.send / hc.sendJSON is ignored in live-server post-request scripts because the response has already been sent to the client'
      });
    }
    runtimeVars = applyVariableResult(runtimeVars, result);
    scriptData = result.data ?? scriptData;
  }
}

/**
 * Mounts live-server pre/post request script middleware.
 *
 * Must be mounted after the access-log middleware and before CORS/proxy/static
 * so every matching pre script finishes before the Run command companion (via
 * reverse proxy) or static handlers see the request.
 *
 * @param app - Express app to instrument.
 * @param options - Scripts holder, identity, and optional test doubles.
 */
export function mountLiveServerScriptsMiddleware(
  app: { use: (handler: (req: Request, res: Response, next: NextFunction) => void) => void },
  options: MountLiveServerScriptsOptions
): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const scriptReq = req as LiveServerScriptAwareRequest;
    scriptReq.hcInboundUrl = scriptReq.originalUrl || scriptReq.url || '/';
    const startedAt = Date.now();
    const tee = installResponseTee(res);

    /**
     * Runs post scripts once when the response finishes or closes.
     */
    let postStarted = false;
    const onFinished = (): void => {
      if (postStarted) {
        return;
      }
      postStarted = true;
      void runPostRequestScripts(scriptReq, res, tee, startedAt, options);
    };
    res.on('finish', onFinished);
    res.on('close', onFinished);

    void runPreRequestScripts(scriptReq, res, options)
      .then((skipped) => {
        if (!skipped) {
          next();
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        options.onScriptLog?.({
          kind: 'script',
          timestamp: Date.now(),
          phase: 'pre',
          url: scriptReq.hcInboundUrl ?? '/',
          scriptLabel: 'pre',
          level: 'script-error',
          message
        });
        next();
      });
  });
}
