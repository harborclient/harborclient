import type { Response } from 'express';
import { resolveEchoResponseBody } from './resolveEchoResponseBody';
import type { EchoResponse, PluginServerHttpResponse } from './types';

/**
 * Normalized structured response ready to write to Express.
 */
export interface NormalizedPluginServerHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  delayMs: number;
  /**
   * When true, `body` is a string and should be sent with `res.send`.
   */
  sendAsText: boolean;
}

/**
 * Returns whether a handler return value is a structured plugin server response.
 *
 * Only objects with `kind: 'http-response'` qualify so legacy JSON bodies such as
 * `{ status: 404 }` stay body-only Echo responses.
 *
 * @param value - Raw value from a plugin `onRequest` handler.
 * @returns True when the value is a structured HTTP response.
 */
export function isPluginServerHttpResponse(value: unknown): value is PluginServerHttpResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return (value as PluginServerHttpResponse).kind === 'http-response';
}

/**
 * Clamps and defaults a structured plugin server response.
 *
 * @param response - Structured handler return value.
 * @returns Normalized fields for sending over HTTP.
 */
export function normalizePluginServerHttpResponse(
  response: PluginServerHttpResponse
): NormalizedPluginServerHttpResponse {
  const status =
    typeof response.status === 'number' &&
    Number.isFinite(response.status) &&
    response.status >= 100 &&
    response.status <= 599
      ? Math.trunc(response.status)
      : 200;

  const headers: Record<string, string> = {};
  if (response.headers && typeof response.headers === 'object') {
    for (const [key, value] of Object.entries(response.headers)) {
      if (typeof key === 'string' && key.trim() && typeof value === 'string') {
        headers[key] = value;
      }
    }
  }

  const delayMs =
    typeof response.delayMs === 'number' &&
    Number.isFinite(response.delayMs) &&
    response.delayMs > 0
      ? Math.min(Math.trunc(response.delayMs), 60_000)
      : 0;

  const body = response.body;
  const sendAsText = typeof body === 'string';

  return {
    status,
    headers,
    body: body === undefined ? null : body,
    delayMs,
    sendAsText
  };
}

/**
 * Sleeps for the given number of milliseconds.
 *
 * @param ms - Delay duration.
 */
export async function delayMs(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Writes a structured or legacy plugin server handler result to an Express response.
 *
 * @param res - Express response.
 * @param handlerResult - Raw value from the plugin handler chain.
 * @param defaultEcho - Default httpbin-style payload for legacy null/undefined returns.
 */
export async function sendPluginServerHandlerResult(
  res: Response,
  handlerResult: unknown,
  defaultEcho: EchoResponse
): Promise<void> {
  if (isPluginServerHttpResponse(handlerResult)) {
    const normalized = normalizePluginServerHttpResponse(handlerResult);
    await delayMs(normalized.delayMs);

    for (const [key, value] of Object.entries(normalized.headers)) {
      res.setHeader(key, value);
    }

    res.status(normalized.status);

    if (normalized.sendAsText) {
      if (!res.getHeader('Content-Type')) {
        res.type('text/plain');
      }
      res.send(normalized.body as string);
      return;
    }

    res.json(normalized.body);
    return;
  }

  res.json(resolveEchoResponseBody(handlerResult, defaultEcho));
}
