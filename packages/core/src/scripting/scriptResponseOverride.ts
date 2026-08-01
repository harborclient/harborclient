import type { ScriptResponseOverride, SendResult } from '../types';

/**
 * Common HTTP reason phrases for status codes used by hc.send / hc.sendJSON.
 */
const HTTP_STATUS_TEXT: Record<number, string> = {
  100: 'Continue',
  101: 'Switching Protocols',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  206: 'Partial Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout'
};

/**
 * Returns the standard reason phrase for an HTTP status code.
 *
 * @param status - HTTP status code.
 * @returns Reason phrase, or an empty string when the code is not in the map.
 */
export function httpStatusText(status: number): string {
  return HTTP_STATUS_TEXT[status] ?? '';
}

/**
 * Validates and normalizes an integer HTTP status in the 100–599 range.
 *
 * @param statusCode - User-provided status (defaults to 200 when omitted).
 * @returns Normalized status code.
 * @throws When statusCode is provided but is not an integer in 100–599.
 */
function normalizeStatusCode(statusCode: unknown): number {
  if (statusCode === undefined || statusCode === null) {
    return 200;
  }
  const n = typeof statusCode === 'number' ? statusCode : Number(statusCode);
  if (!Number.isInteger(n) || n < 100 || n > 599) {
    throw new Error(
      `hc.send statusCode must be an integer between 100 and 599 (got ${String(statusCode)})`
    );
  }
  return n;
}

/**
 * Builds a {@link ScriptResponseOverride} from script-facing send arguments.
 *
 * @param body - Response body text.
 * @param statusCode - Optional HTTP status (default 200).
 * @param contentType - Optional Content-Type header value (default text/plain; charset=utf-8).
 * @returns Override payload for {@link ScriptRunResult.responseOverride}.
 * @throws When statusCode is not a valid HTTP status integer.
 */
export function buildScriptResponseOverride(
  body: string,
  statusCode?: unknown,
  contentType?: unknown
): ScriptResponseOverride {
  const status = normalizeStatusCode(statusCode);
  const type =
    contentType === undefined || contentType === null
      ? 'text/plain; charset=utf-8'
      : String(contentType);
  return {
    status,
    statusText: httpStatusText(status),
    headers: {
      'content-type': type
    },
    body
  };
}

/**
 * Applies a script response override onto a base {@link SendResult}.
 *
 * Replaces status, statusText, headers, and body; recomputes sizeBytes; drops
 * bodyBase64 and error so the result presents as a successful synthetic response.
 * Preserves timing, request, and redirects from the base.
 *
 * @param base - Real, skipped, or previously overridden SendResult.
 * @param override - Values from hc.send / hc.sendJSON.
 * @returns New SendResult with override fields applied.
 */
export function applyScriptResponseOverride(
  base: SendResult,
  override: ScriptResponseOverride
): SendResult {
  const next: SendResult = {
    ...base,
    status: override.status,
    statusText: override.statusText,
    headers: { ...override.headers },
    body: override.body,
    sizeBytes: new TextEncoder().encode(override.body).byteLength
  };
  delete next.bodyBase64;
  delete next.error;
  return next;
}
