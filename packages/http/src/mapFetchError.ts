/**
 * Maximum depth when walking `Error.cause` chains from undici/Node fetch failures.
 */
const MAX_CAUSE_DEPTH = 6;

/**
 * Opaque undici top-level message that hides the real network failure on `cause`.
 */
const OPAQUE_FETCH_FAILED = 'fetch failed';

/**
 * TLS / certificate error codes from OpenSSL via Node's TLS stack.
 */
const TLS_ERROR_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'ERR_SSL_WRONG_VERSION_NUMBER'
]);

/**
 * Connect / socket timeout codes from Node and undici.
 */
const CONNECT_TIMEOUT_CODES = new Set([
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT'
]);

interface CauseEntry {
  /**
   * Error message string when present.
   */
  message: string;

  /**
   * Node/OpenSSL/undici error code when present.
   */
  code?: string;
}

/**
 * Returns whether a message is undici's opaque top-level fetch failure text.
 *
 * @param message - Error message to inspect.
 */
function isOpaqueFetchFailed(message: string): boolean {
  return message.trim().toLowerCase() === OPAQUE_FETCH_FAILED;
}

/**
 * Reads a Node-style `code` property from an unknown cause value.
 *
 * @param value - Cause object that may carry a string `code`.
 * @returns The code when it is a non-empty string.
 */
function readErrorCode(value: unknown): string | undefined {
  if (value == null || typeof value !== 'object') {
    return undefined;
  }
  const code = (value as { code?: unknown }).code;
  return typeof code === 'string' && code.length > 0 ? code : undefined;
}

/**
 * Walks `Error.cause` (and plain objects with `cause`/`message`) up to a fixed depth.
 *
 * @param err - Thrown fetch error or nested cause.
 * @returns Ordered chain from the top error toward the root cause.
 */
function collectCauseChain(err: unknown): CauseEntry[] {
  const chain: CauseEntry[] = [];
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current != null; depth += 1) {
    if (current instanceof Error) {
      chain.push({
        message: current.message,
        code: readErrorCode(current)
      });
      current = current.cause;
      continue;
    }
    if (typeof current === 'object') {
      const record = current as { message?: unknown; cause?: unknown };
      const message = typeof record.message === 'string' ? record.message : '';
      chain.push({
        message,
        code: readErrorCode(current)
      });
      current = record.cause;
      continue;
    }
    if (typeof current === 'string' && current.length > 0) {
      chain.push({ message: current });
    }
    break;
  }
  return chain;
}

/**
 * Extracts `host:port` from a typical Node connect error message when present.
 *
 * @param message - Cause message such as `connect ECONNREFUSED 127.0.0.1:5009`.
 * @returns Host and port suffix, or undefined when not found.
 */
function extractHostPort(message: string): string | undefined {
  const match = message.match(/(\[[^\]]+\]|[\w.-]+):(\d+)\s*$/);
  if (!match) {
    return undefined;
  }
  return `${match[1]}:${match[2]}`;
}

/**
 * Maps a Node/OpenSSL/undici error code to a short user-facing message.
 *
 * @param code - Error code from the cause chain.
 * @param message - Matching cause message (used for host:port hints).
 * @returns Mapped text, or undefined when the code is not specially handled.
 */
function messageForCode(code: string, message: string): string | undefined {
  if (code === 'ECONNREFUSED') {
    const hostPort = extractHostPort(message);
    return hostPort ? `Connection refused (${hostPort})` : 'Connection refused';
  }
  if (code === 'ENOTFOUND') {
    return 'Host not found (DNS lookup failed)';
  }
  if (code === 'EAI_AGAIN') {
    return 'Temporary DNS failure — try again';
  }
  if (code === 'ECONNRESET') {
    return 'Connection reset';
  }
  if (CONNECT_TIMEOUT_CODES.has(code)) {
    return 'Connection timed out';
  }
  if (TLS_ERROR_CODES.has(code)) {
    if (code === 'CERT_HAS_EXPIRED') {
      return 'TLS certificate has expired';
    }
    if (code === 'CERT_NOT_YET_VALID') {
      return 'TLS certificate is not yet valid';
    }
    if (code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
      return 'TLS certificate does not match the hostname';
    }
    return 'TLS certificate verification failed — disable Verify SSL for local HTTPS, or use a trusted certificate';
  }
  return undefined;
}

/**
 * Maps a thrown fetch / undici error to a user-facing transport error string.
 *
 * Unwraps `Error.cause` chains so opaque `"fetch failed"` messages become
 * connection refused, DNS, TLS, or other actionable network failures.
 *
 * @param err - Thrown fetch error.
 * @param timeoutMs - Configured request timeout in milliseconds (for TimeoutError).
 * @returns Message suitable for SendResult.error.
 */
export function mapFetchError(err: unknown, timeoutMs: number): string {
  if (err instanceof Error && err.name === 'AbortError') {
    return 'Request canceled';
  }
  if (err instanceof Error && err.name === 'TimeoutError') {
    return `Request timed out after ${timeoutMs} ms`;
  }

  const chain = collectCauseChain(err);
  if (chain.length === 0) {
    return 'Unknown error';
  }

  const coded = chain.find((entry) => entry.code);
  if (coded?.code) {
    const mapped = messageForCode(coded.code, coded.message);
    if (mapped) {
      return mapped;
    }
  }

  const topMessage = chain[0]?.message?.trim() ?? '';
  const deepestUseful = [...chain]
    .reverse()
    .find((entry) => entry.message.trim().length > 0 && !isOpaqueFetchFailed(entry.message));

  if (isOpaqueFetchFailed(topMessage) && deepestUseful) {
    return deepestUseful.message.trim();
  }

  if (topMessage.length > 0 && !isOpaqueFetchFailed(topMessage)) {
    return topMessage;
  }

  if (deepestUseful) {
    return deepestUseful.message.trim();
  }

  return 'Network request failed';
}
