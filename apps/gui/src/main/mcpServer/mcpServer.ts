import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { Express, NextFunction, Request, Response } from 'express';
import { logVerbose } from '#/main/logger';
import { getMcpServerSettings, isValidMcpServerToken } from '#/main/settings/mcpSettings';
import { appendMcpServerLog, readMcpJsonRpcMethod } from './mcpServerLogBuffer';
import { registerHarborMcpTools, shouldRunMcpServer } from './tools';
import type { McpServerSettings, McpServerStatus } from '@harborclient/core/types';

/** HTTP server instance returned by {@link Express.listen}. */
type ExpressListenServer = ReturnType<Express['listen']>;

interface RunningMcpServer {
  httpServer: ExpressListenServer;
  host: string;
  port: number;
  /** Settings applied when the listener started (tool allowlist for new sessions). */
  settings: McpServerSettings;
}

let runningServer: RunningMcpServer | null = null;

/** Active Streamable HTTP session transports keyed by MCP session id. */
const sessionTransports = new Map<string, StreamableHTTPServerTransport>();

/**
 * Infers an image MIME type from a logo URL path extension.
 *
 * Falls back to `image/png` when the extension is missing or unrecognized so
 * MCP clients still receive a usable icon descriptor.
 *
 * @param logoUrl - Logo image URL from MCP server settings.
 * @returns MIME type string for `serverInfo.icons`.
 */
function mimeTypeForLogoUrl(logoUrl: string): string {
  const pathname = logoUrl.split('?')[0]?.split('#')[0] ?? logoUrl;
  const extension = pathname.includes('.')
    ? pathname.slice(pathname.lastIndexOf('.') + 1).toLowerCase()
    : '';

  switch (extension) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

/**
 * Builds an MCP server instance with the current tool allowlist.
 *
 * Advertises the configured display name and logo via `serverInfo` so MCP
 * clients can show a branded tile instead of a generic letter placeholder.
 *
 * @param settings - Persisted MCP server settings (identity, tool allowlist, auth).
 */
function createHarborMcpServer(settings: McpServerSettings): McpServer {
  const server = new McpServer(
    {
      name: 'harborclient',
      version: '1.0.0',
      title: settings.name,
      websiteUrl: 'https://harborclient.com',
      icons: [
        {
          src: settings.logoUrl,
          mimeType: mimeTypeForLogoUrl(settings.logoUrl),
          sizes: ['any']
        }
      ]
    },
    {
      capabilities: {
        tools: {}
      },
      instructions:
        'HarborClient MCP server exposing selected Harbor AI tools for collections, requests, environments, and responses.'
    }
  );

  registerHarborMcpTools(server, settings.exposedTools);
  return server;
}

/**
 * Parses a Bearer token from the Authorization header.
 *
 * @param header - Raw Authorization header value.
 */
function parseBearerToken(header: string | undefined): string {
  if (!header?.startsWith('Bearer ')) {
    return '';
  }
  return header.slice('Bearer '.length).trim();
}

/**
 * Rejects MCP requests without a valid bearer token.
 */
function bearerAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = parseBearerToken(req.headers.authorization);
  if (!isValidMcpServerToken(token)) {
    logVerbose('mcp:server:unauthorized', { path: req.path });
    appendMcpServerLog({
      timestamp: Date.now(),
      direction: 'in',
      kind: 'http',
      method: req.method,
      path: req.path,
      statusCode: 401,
      error: 'Unauthorized'
    });
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized'
      },
      id: null
    });
    return;
  }

  next();
}

/**
 * Records a sanitized HTTP access log line when the Express response finishes.
 *
 * Captures method, path, optional JSON-RPC method, status, and duration only —
 * never Authorization headers or request/response bodies.
 *
 * @param req - Incoming Express request.
 * @param res - Express response.
 * @param sessionId - MCP session id when present.
 */
function trackMcpHttpAccessLog(req: Request, res: Response, sessionId?: string): void {
  const startedAt = Date.now();
  const rpcMethod = readMcpJsonRpcMethod(req.body);
  res.on('finish', () => {
    appendMcpServerLog({
      timestamp: Date.now(),
      direction: 'in',
      kind: 'http',
      method: req.method,
      path: req.path,
      ...(rpcMethod ? { rpcMethod } : {}),
      statusCode: res.statusCode,
      durationMs: Math.max(0, Date.now() - startedAt),
      ...(sessionId ? { sessionId } : {})
    });
  });
}

/**
 * Reads the MCP session id header when present as a single string value.
 *
 * @param req - Incoming Express request.
 */
function readMcpSessionId(req: Request): string | undefined {
  const header = req.headers['mcp-session-id'];
  return typeof header === 'string' ? header : undefined;
}

/**
 * Responds with JSON-RPC 400 when a session id is missing or unknown.
 *
 * @param res - Express response.
 */
function respondInvalidSession(res: Response): void {
  res.status(400).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Bad Request: No valid session ID provided'
    },
    id: null
  });
}

/**
 * Closes and clears all active MCP session transports.
 */
async function closeAllSessionTransports(): Promise<void> {
  const transports = [...sessionTransports.values()];
  sessionTransports.clear();
  await Promise.allSettled(transports.map((transport) => transport.close()));
}

/**
 * Handles POST /mcp for initialize and in-session JSON-RPC requests.
 *
 * @param req - Incoming Express request.
 * @param res - Express response.
 */
async function handleMcpPost(req: Request, res: Response): Promise<void> {
  logVerbose('mcp:server:request', {
    method: req.method,
    path: req.path,
    remoteAddress: req.socket.remoteAddress
  });

  const sessionId = readMcpSessionId(req);
  trackMcpHttpAccessLog(req, res, sessionId);

  try {
    if (sessionId && sessionTransports.has(sessionId)) {
      const transport = sessionTransports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      if (!runningServer) {
        respondInvalidSession(res);
        return;
      }

      const server = createHarborMcpServer(runningServer.settings);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (initializedSessionId) => {
          logVerbose('mcp:server:session-init', { sessionId: initializedSessionId });
          appendMcpServerLog({
            timestamp: Date.now(),
            direction: 'in',
            kind: 'session',
            rpcMethod: 'initialize',
            sessionId: initializedSessionId
          });
          sessionTransports.set(initializedSessionId, transport);
        }
      });

      transport.onclose = () => {
        const closedSessionId = transport.sessionId;
        if (closedSessionId && sessionTransports.has(closedSessionId)) {
          logVerbose('mcp:server:session-close', { sessionId: closedSessionId });
          appendMcpServerLog({
            timestamp: Date.now(),
            direction: 'out',
            kind: 'session',
            rpcMethod: 'close',
            sessionId: closedSessionId
          });
          sessionTransports.delete(closedSessionId);
        }
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    respondInvalidSession(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message
        },
        id: null
      });
    }
  }
}

/**
 * Handles GET /mcp for the session SSE stream.
 *
 * @param req - Incoming Express request.
 * @param res - Express response.
 */
async function handleMcpGet(req: Request, res: Response): Promise<void> {
  const sessionId = readMcpSessionId(req);
  trackMcpHttpAccessLog(req, res, sessionId);
  if (!sessionId || !sessionTransports.has(sessionId)) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const transport = sessionTransports.get(sessionId)!;
  await transport.handleRequest(req, res);
}

/**
 * Handles DELETE /mcp for session termination.
 *
 * @param req - Incoming Express request.
 * @param res - Express response.
 */
async function handleMcpDelete(req: Request, res: Response): Promise<void> {
  const sessionId = readMcpSessionId(req);
  trackMcpHttpAccessLog(req, res, sessionId);
  if (!sessionId || !sessionTransports.has(sessionId)) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const transport = sessionTransports.get(sessionId)!;
  await transport.handleRequest(req, res);
}

/**
 * Creates the Express application for the Harbor MCP server.
 *
 * @param settings - Persisted MCP server settings.
 */
function createHarborMcpExpressApp(settings: McpServerSettings): Express {
  const app = createMcpExpressApp({ host: settings.host });
  app.use(bearerAuthMiddleware);

  app.post('/mcp', (req, res) => {
    void handleMcpPost(req, res);
  });

  app.get('/mcp', (req, res) => {
    void handleMcpGet(req, res);
  });

  app.delete('/mcp', (req, res) => {
    void handleMcpDelete(req, res);
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

/**
 * Starts the Harbor MCP HTTP server when settings require it.
 *
 * @param settings - Persisted MCP server settings.
 */
export async function startMcpServer(settings: McpServerSettings): Promise<McpServerStatus> {
  await stopMcpServer();

  if (!shouldRunMcpServer(settings)) {
    return { running: false, enabled: settings.enabled };
  }

  const app = createHarborMcpExpressApp(settings);
  const httpServer = await new Promise<ExpressListenServer>((resolve, reject) => {
    const instance = app.listen(settings.port, settings.host, () => {
      resolve(instance);
    });
    instance.on('error', reject);
  });

  const address = httpServer.address();
  const port = typeof address === 'object' && address !== null ? address.port : settings.port;
  const host = settings.host;

  runningServer = { httpServer, host, port, settings };
  logVerbose('mcp:server:started', {
    host,
    port,
    exposedToolCount: settings.exposedTools.length
  });
  appendMcpServerLog({
    timestamp: Date.now(),
    direction: 'out',
    kind: 'lifecycle',
    rpcMethod: 'started',
    path: `${host}:${port}`
  });
  return { running: true, enabled: settings.enabled, host, port };
}

/**
 * Stops the Harbor MCP HTTP server when it is running.
 */
export async function stopMcpServer(): Promise<void> {
  await closeAllSessionTransports();

  const entry = runningServer;
  if (!entry) {
    return;
  }

  runningServer = null;
  logVerbose('mcp:server:stopped');
  appendMcpServerLog({
    timestamp: Date.now(),
    direction: 'out',
    kind: 'lifecycle',
    rpcMethod: 'stopped'
  });
  await new Promise<void>((resolve, reject) => {
    entry.httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

/**
 * Returns whether the Harbor MCP HTTP server is running and whether the feature is enabled.
 */
export function getMcpServerStatus(): McpServerStatus {
  const enabled = getMcpServerSettings().enabled;
  if (!runningServer) {
    return { running: false, enabled };
  }

  return {
    running: true,
    enabled,
    host: runningServer.host,
    port: runningServer.port
  };
}

/**
 * Applies persisted MCP server settings to the HTTP listener lifecycle.
 *
 * When the feature is disabled or listen intent is off, stops any running
 * listener first. Otherwise (re)starts with the given bind settings.
 *
 * @param settings - Persisted MCP server settings.
 */
export async function applyMcpServerSettings(
  settings: McpServerSettings
): Promise<McpServerStatus> {
  if (!shouldRunMcpServer(settings)) {
    await stopMcpServer();
    return { running: false, enabled: settings.enabled };
  }

  return startMcpServer(settings);
}
