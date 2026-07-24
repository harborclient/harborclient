import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { Express, NextFunction, Request, Response } from 'express';
import { logVerbose } from '#/main/logger';
import { isValidMcpServerToken } from '#/main/settings/mcpSettings';
import { registerHarborMcpTools, shouldRunMcpServer } from './tools';
import type { McpServerSettings, McpServerStatus } from '#/shared/types';

interface RunningMcpServer {
  httpServer: Server;
  host: string;
  port: number;
}

let runningServer: RunningMcpServer | null = null;

/** Active Streamable HTTP session transports keyed by MCP session id. */
const sessionTransports = new Map<string, StreamableHTTPServerTransport>();

/**
 * Builds an MCP server instance with the currently exposed Harbor tools.
 *
 * @param settings - Persisted MCP server settings.
 */
function createHarborMcpServer(settings: McpServerSettings): McpServer {
  const server = new McpServer(
    {
      name: 'harborclient',
      version: '1.0.0'
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
 * @param settings - Persisted MCP server settings captured at listen time.
 */
async function handleMcpPost(
  req: Request,
  res: Response,
  settings: McpServerSettings
): Promise<void> {
  logVerbose('mcp:server:request', {
    method: req.method,
    path: req.path,
    remoteAddress: req.socket.remoteAddress
  });

  const sessionId = readMcpSessionId(req);

  try {
    if (sessionId && sessionTransports.has(sessionId)) {
      const transport = sessionTransports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const server = createHarborMcpServer(settings);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (initializedSessionId) => {
          logVerbose('mcp:server:session-init', { sessionId: initializedSessionId });
          sessionTransports.set(initializedSessionId, transport);
        }
      });

      transport.onclose = () => {
        const closedSessionId = transport.sessionId;
        if (closedSessionId && sessionTransports.has(closedSessionId)) {
          logVerbose('mcp:server:session-close', { sessionId: closedSessionId });
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
    void handleMcpPost(req, res, settings);
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
    return { running: false };
  }

  const app = createHarborMcpExpressApp(settings);
  const httpServer = await new Promise<Server>((resolve, reject) => {
    const instance = app.listen(settings.port, settings.host, () => {
      resolve(instance);
    });
    instance.on('error', reject);
  });

  const address = httpServer.address();
  const port = typeof address === 'object' && address !== null ? address.port : settings.port;
  const host = settings.host;

  runningServer = { httpServer, host, port };
  logVerbose('mcp:server:started', {
    host,
    port,
    exposedToolCount: settings.exposedTools.length
  });
  return { running: true, host, port };
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
 * Returns whether the Harbor MCP HTTP server is running.
 */
export function getMcpServerStatus(): McpServerStatus {
  if (!runningServer) {
    return { running: false };
  }

  return {
    running: true,
    host: runningServer.host,
    port: runningServer.port
  };
}

/**
 * Applies persisted MCP server settings to the HTTP listener lifecycle.
 *
 * @param settings - Persisted MCP server settings.
 */
export async function applyMcpServerSettings(
  settings: McpServerSettings
): Promise<McpServerStatus> {
  if (!shouldRunMcpServer(settings)) {
    await stopMcpServer();
    return { running: false };
  }

  return startMcpServer(settings);
}
