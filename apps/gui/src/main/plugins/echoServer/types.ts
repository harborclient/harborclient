import type { Request } from 'express';

/**
 * httpbin-style echo response returned by the default echo handler.
 */
export interface EchoResponse {
  args: Record<string, string>;
  data: string;
  files: Record<string, string>;
  form: Record<string, string>;
  headers: Record<string, string>;
  json: Record<string, unknown> | null;
  origin: string;
  url: string;
}

/**
 * Express request with optional raw body bytes captured during parsing.
 */
export interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Serializable incoming request snapshot passed to plugin echo handlers.
 */
export interface EchoServerIncomingRequest {
  method: string;
  url: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  bodyType: 'none' | 'json' | 'text' | 'multipart' | 'urlencoded';
  params: Array<{ key: string; value: string; enabled: boolean }>;
  echo: EchoResponse;
}

/**
 * Structured HTTP response from a plugin `onRequest` handler.
 *
 * Only objects with `kind: 'http-response'` are treated as structured so legacy
 * JSON bodies such as `{ status: 404 }` remain body-only Echo responses.
 */
export interface PluginServerHttpResponse {
  kind: 'http-response';
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
  delayMs?: number;
}

/**
 * Status returned from echo server lifecycle queries.
 */
export interface EchoServerStatus {
  running: boolean;
  port?: number;
}
