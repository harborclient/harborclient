import express, { type Express } from 'express';
import { bodyParsers } from './bodyParsers';
import { buildEchoResponse } from './echo';
import { sendPluginServerHandlerResult } from './resolvePluginServerResponse';
import type { EchoServerIncomingRequest, RequestWithRawBody } from './types';

/**
 * Infers HarborClient body type from Content-Type for script context seeding.
 *
 * @param contentType - Raw Content-Type header value.
 */
function inferBodyType(contentType: string | undefined): EchoServerIncomingRequest['bodyType'] {
  if (!contentType) {
    return 'none';
  }
  if (contentType.includes('application/json')) {
    return 'json';
  }
  if (contentType.includes('multipart/form-data')) {
    return 'multipart';
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return 'urlencoded';
  }
  if (contentType.startsWith('text/')) {
    return 'text';
  }
  return 'text';
}

/**
 * Builds a serializable request snapshot for plugin echo handlers.
 *
 * @param req - Parsed Express request.
 * @returns Incoming request payload including default echo JSON.
 */
export function buildIncomingRequestSnapshot(req: RequestWithRawBody): EchoServerIncomingRequest {
  const echo = buildEchoResponse(req);
  const contentType = req.headers['content-type'] ?? '';
  const params = Object.entries(echo.args).map(([key, value]) => ({
    key,
    value,
    enabled: true
  }));

  return {
    method: req.method,
    url: echo.url,
    path: req.path,
    query: echo.args,
    headers: echo.headers,
    body: echo.data,
    bodyType: inferBodyType(contentType),
    params,
    echo
  };
}

/**
 * Creates an Express app that routes incoming HTTP requests through a callback.
 *
 * The callback returns either a legacy JSON body (`unknown`), a structured
 * `{ kind: 'http-response', ... }` response, or `null`/`undefined` to use the
 * default httpbin-style echo payload.
 *
 * @param onIncoming - Returns the handler result for each request.
 * @returns Configured Express application.
 */
export function createEchoApp(
  onIncoming: (request: EchoServerIncomingRequest) => Promise<unknown>
): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(bodyParsers);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.all(/.*/, async (req, res) => {
    try {
      const snapshot = buildIncomingRequestSnapshot(req as RequestWithRawBody);
      const handlerResult = await onIncoming(snapshot);
      await sendPluginServerHandlerResult(res, handlerResult, snapshot.echo);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  return app;
}
