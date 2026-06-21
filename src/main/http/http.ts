import { readFile } from 'fs/promises';
import { basename } from 'path';
import { Agent, type Dispatcher } from 'undici';
import type {
  BodyType,
  GeneralSettings,
  KeyValue,
  SendRequestInput,
  SendResult,
  SentRequest
} from '#/shared/types';
import { parseFormParts } from '#/shared/formData';
import { parseUrlEncodedParts } from '#/shared/urlencoded';
import {
  DEFAULT_GENERAL_SETTINGS,
  HARD_MAX_RESPONSE_SIZE_MB
} from '#/main/settings/generalSettings';
import { validateHeaderField } from '#/shared/httpHeaders';

export { HARD_MAX_RESPONSE_SIZE_MB };

/**
 * HTTP schemes allowed for outbound requests.
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Resolves the effective response size limit in megabytes.
 *
 * @param maxResponseSizeMb - User setting; 0 means no configurable limit.
 * @returns The user limit when positive, otherwise {@link HARD_MAX_RESPONSE_SIZE_MB}.
 */
export function resolveMaxResponseSizeMb(maxResponseSizeMb: number): number {
  return maxResponseSizeMb > 0 ? maxResponseSizeMb : HARD_MAX_RESPONSE_SIZE_MB;
}

/**
 * Returns whether a URL string is a root-relative path (`/api`), not protocol-relative (`//cdn`).
 *
 * @param url - Trimmed URL string.
 */
function isRootRelativePath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

/**
 * Returns whether a URL is safe to send via fetch: absolute http(s) or root-relative path.
 *
 * @param url - Request URL before or after query string merging.
 * @returns True when the URL uses http/https or is a root-relative path.
 */
export function isValidRequestUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    return ALLOWED_PROTOCOLS.has(new URL(trimmed).protocol);
  } catch {
    return isRootRelativePath(trimmed);
  }
}

/**
 * Appends query parameters via string concatenation for root-relative paths.
 *
 * @param trimmed - Trimmed base URL that failed absolute URL parsing.
 * @param enabledParams - Enabled key-value pairs to append.
 */
function appendQueryFallback(trimmed: string, enabledParams: KeyValue[]): string {
  const separator = trimmed.includes('?') ? '&' : '?';
  const query = enabledParams
    .map((p) => `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(p.value)}`)
    .join('&');
  return `${trimmed}${separator}${query}`;
}

/**
 * Appends enabled query parameters to a base URL.
 *
 * @param baseUrl - Request URL before query string merging.
 * @param params - Key-value pairs to append as search params.
 * @returns URL with merged query parameters.
 */
export function buildUrl(baseUrl: string, params: KeyValue[]): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) return trimmed;

  const enabledParams = params.filter((p) => p.enabled && p.key.trim());
  if (enabledParams.length === 0) return trimmed;

  try {
    const url = new URL(trimmed);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      return trimmed;
    }
    for (const param of enabledParams) {
      url.searchParams.set(param.key.trim(), param.value);
    }
    return url.toString();
  } catch {
    if (!isRootRelativePath(trimmed)) {
      return trimmed;
    }
    return appendQueryFallback(trimmed, enabledParams);
  }
}

/**
 * Result of building request headers from user input.
 */
export type BuildHeadersResult =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; error: string };

/**
 * Builds request headers from enabled key-value pairs and body type defaults.
 *
 * Rejects hop-by-hop headers and fields containing control characters or CRLF.
 *
 * @param headers - User-defined headers.
 * @param bodyType - Body type used to infer Content-Type when absent.
 * @returns Header map ready for fetch, or an error when a field is invalid.
 */
export function buildHeaders(headers: KeyValue[], bodyType: BodyType): BuildHeadersResult {
  const result: Record<string, string> = {};

  for (const header of headers) {
    if (header.enabled && header.key.trim()) {
      const key = header.key.trim();
      if (bodyType === 'multipart' && key.toLowerCase() === 'content-type') {
        continue;
      }
      const validationError = validateHeaderField(key, header.value);
      if (validationError) {
        return { ok: false, error: validationError };
      }
      result[key] = header.value;
    }
  }

  const hasContentType = Object.keys(result).some((key) => key.toLowerCase() === 'content-type');

  if (!hasContentType) {
    if (bodyType === 'json') {
      result['Content-Type'] = 'application/json';
    } else if (bodyType === 'text') {
      result['Content-Type'] = 'text/plain';
    } else if (bodyType === 'urlencoded') {
      result['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }

  return { ok: true, headers: result };
}

/**
 * Builds a human-readable summary of multipart form parts for request preview.
 *
 * @param body - Serialized multipart form parts JSON.
 * @returns Summary string for SentRequest.body.
 */
export function summarizeFormParts(body: string): string {
  const parts = parseFormParts(body).filter((part) => part.enabled && part.key.trim());
  if (parts.length === 0) {
    return '';
  }

  return parts
    .map((part) => {
      const key = part.key.trim();
      if (part.type === 'file') {
        const names = part.files.map((filePath) => basename(filePath)).join(', ');
        return `${key}: [${names || 'no files'}]`;
      }
      return `${key}: ${part.value}`;
    })
    .join('\n');
}

/**
 * Builds a FormData body from serialized multipart form parts.
 *
 * @param body - Serialized multipart form parts JSON.
 * @returns FormData ready for fetch, or an error message when a file cannot be read.
 */
export async function buildMultipartBody(
  body: string
): Promise<{ formData: FormData } | { error: string }> {
  const parts = parseFormParts(body).filter((part) => part.enabled && part.key.trim());
  const formData = new FormData();

  for (const part of parts) {
    const key = part.key.trim();
    if (part.type === 'file') {
      for (const filePath of part.files) {
        try {
          const data = await readFile(filePath);
          formData.append(key, new Blob([Uint8Array.from(data)]), basename(filePath));
        } catch {
          return { error: `Failed to read file: ${filePath}` };
        }
      }
      continue;
    }

    formData.append(key, part.value);
  }

  return { formData };
}

/**
 * Builds an application/x-www-form-urlencoded body from serialized key-value rows.
 *
 * @param body - JSON array stored in the request body field.
 * @returns URL-encoded query string for the request body.
 */
export function buildUrlEncodedBody(body: string): string {
  const rows = parseUrlEncodedParts(body).filter((row) => row.enabled && row.key.trim());
  const params = new URLSearchParams();
  for (const row of rows) {
    params.append(row.key.trim(), row.value);
  }
  return params.toString();
}

/**
 * Combines optional cancel and timeout signals for fetch.
 *
 * @param signal - Optional user cancel signal.
 * @param timeoutMs - Request timeout in milliseconds; 0 disables timeout.
 */
function buildEffectiveSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number
): AbortSignal | undefined {
  const signals: AbortSignal[] = [];
  if (signal) {
    signals.push(signal);
  }
  if (timeoutMs > 0) {
    signals.push(AbortSignal.timeout(timeoutMs));
  }

  if (signals.length === 0) {
    return undefined;
  }
  if (signals.length === 1) {
    return signals[0];
  }
  return AbortSignal.any(signals);
}

/**
 * Reads a response body, enforcing a max size in megabytes.
 *
 * When {@link maxResponseSizeMb} is 0, the user-configurable limit is disabled but
 * {@link HARD_MAX_RESPONSE_SIZE_MB} still applies as a safety ceiling.
 *
 * @param response - Fetch response to read.
 * @param maxResponseSizeMb - Maximum body size in MB; 0 uses the hard cap only.
 */
async function readResponseBody(
  response: Response,
  maxResponseSizeMb: number
): Promise<{ body: string; sizeBytes: number } | { error: string }> {
  const effectiveMaxMb = resolveMaxResponseSizeMb(maxResponseSizeMb);
  const maxBytes = effectiveMaxMb * 1024 * 1024;

  const bodyStream =
    response.body ??
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      }
    });

  const reader = bodyStream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      totalBytes += value.length;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        const error =
          maxResponseSizeMb > 0
            ? `Response exceeded max size of ${maxResponseSizeMb} MB`
            : `Response exceeded the maximum allowed size of ${HARD_MAX_RESPONSE_SIZE_MB} MB`;
        return { error };
      }
      chunks.push(value);
    }
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const body = new TextDecoder().decode(combined);
  return { body, sizeBytes: totalBytes };
}

/**
 * Maps fetch errors to user-facing messages.
 *
 * @param err - Thrown fetch error.
 * @param timeoutMs - Configured request timeout in milliseconds.
 */
function mapFetchError(err: unknown, timeoutMs: number): string {
  if (err instanceof Error && err.name === 'AbortError') {
    return 'Request canceled';
  }
  if (err instanceof Error && err.name === 'TimeoutError') {
    return `Request timed out after ${timeoutMs} ms`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Unknown error';
}

let insecureDispatcher: Agent | undefined;

/**
 * Returns a shared undici Agent that skips TLS certificate verification.
 */
function getInsecureDispatcher(): Agent {
  insecureDispatcher ??= new Agent({ connect: { rejectUnauthorized: false } });
  return insecureDispatcher;
}

/**
 * Executes an HTTP request via fetch and returns timing and response metadata.
 *
 * @param input - Method, URL, headers, params, body, and body type.
 * @param settings - General request settings for timeout, size limits, and SSL verification.
 * @param signal - Optional abort signal to cancel the in-flight request.
 * @param cookieHeader - Optional Cookie header value from the cookie jar.
 * @returns Response status, headers, body, timing, and size; error field on failure.
 */
export async function executeRequest(
  input: SendRequestInput,
  settings: GeneralSettings = DEFAULT_GENERAL_SETTINGS,
  signal?: AbortSignal,
  cookieHeader?: string
): Promise<SendResult> {
  const url = buildUrl(input.url, input.params);
  const builtHeaders = buildHeaders(input.headers, input.bodyType);
  if (!builtHeaders.ok) {
    return {
      status: 0,
      statusText: 'Error',
      headers: {},
      body: '',
      timeMs: 0,
      sizeBytes: 0,
      error: builtHeaders.error,
      request: {
        method: input.method,
        url: input.url,
        headers: {},
        body: '',
        bodyType: input.bodyType
      }
    };
  }
  const headers = builtHeaders.headers;
  const hasCookieHeader = Object.keys(headers).some((key) => key.toLowerCase() === 'cookie');
  if (cookieHeader && !hasCookieHeader) {
    const cookieError = validateHeaderField('Cookie', cookieHeader);
    if (cookieError) {
      return {
        status: 0,
        statusText: 'Error',
        headers: {},
        body: '',
        timeMs: 0,
        sizeBytes: 0,
        error: cookieError,
        request: {
          method: input.method,
          url: input.url,
          headers,
          body: '',
          bodyType: input.bodyType
        }
      };
    }
    headers.Cookie = cookieHeader;
  }
  const shouldSendBody =
    input.bodyType !== 'none' && input.method !== 'GET' && input.method !== 'HEAD';
  const sentBody = shouldSendBody
    ? input.bodyType === 'multipart'
      ? summarizeFormParts(input.body)
      : input.bodyType === 'urlencoded'
        ? buildUrlEncodedBody(input.body)
        : input.body
    : '';
  const request: SentRequest = {
    method: input.method,
    url,
    headers,
    body: sentBody,
    bodyType: input.bodyType
  };

  if (!url.trim()) {
    return {
      status: 0,
      statusText: 'Error',
      headers: {},
      body: '',
      timeMs: 0,
      sizeBytes: 0,
      error: 'URL is required',
      request: {
        method: input.method,
        url: input.url,
        headers,
        body: sentBody,
        bodyType: input.bodyType
      }
    };
  }

  if (!isValidRequestUrl(url)) {
    return {
      status: 0,
      statusText: 'Error',
      headers: {},
      body: '',
      timeMs: 0,
      sizeBytes: 0,
      error: 'Invalid URL',
      request: {
        method: input.method,
        url: input.url,
        headers,
        body: sentBody,
        bodyType: input.bodyType
      }
    };
  }

  const start = performance.now();
  const effectiveSignal = buildEffectiveSignal(signal, settings.requestTimeoutMs);

  try {
    const init: RequestInit & { dispatcher?: Dispatcher } = {
      method: input.method,
      headers,
      signal: effectiveSignal
    };

    if (!settings.verifySsl) {
      init.dispatcher = getInsecureDispatcher();
    }

    if (shouldSendBody) {
      if (input.bodyType === 'multipart') {
        const multipartResult = await buildMultipartBody(input.body);
        if ('error' in multipartResult) {
          const timeMs = Math.round(performance.now() - start);
          return {
            status: 0,
            statusText: 'Error',
            headers: {},
            body: '',
            timeMs,
            sizeBytes: 0,
            error: multipartResult.error,
            request
          };
        }
        init.body = multipartResult.formData;
      } else if (input.bodyType === 'urlencoded') {
        init.body = buildUrlEncodedBody(input.body);
      } else {
        init.body = input.body;
      }
    }

    const response = await fetch(url, init);
    const setCookieHeaders =
      typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    const bodyResult = await readResponseBody(response, settings.maxResponseSizeMb);
    const timeMs = Math.round(performance.now() - start);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    if ('error' in bodyResult) {
      return {
        status: 0,
        statusText: 'Error',
        headers: responseHeaders,
        body: '',
        timeMs,
        sizeBytes: 0,
        error: bodyResult.error,
        setCookieHeaders,
        request
      };
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: bodyResult.body,
      timeMs,
      sizeBytes: bodyResult.sizeBytes,
      setCookieHeaders,
      request
    };
  } catch (err) {
    const timeMs = Math.round(performance.now() - start);

    return {
      status: 0,
      statusText: 'Error',
      headers: {},
      body: '',
      timeMs,
      sizeBytes: 0,
      error: mapFetchError(err, settings.requestTimeoutMs),
      request
    };
  }
}
