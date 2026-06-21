/**
 * Hop-by-hop headers that must not be set from user or script input.
 */
const FORBIDDEN_HEADER_NAMES = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

/**
 * Returns whether a header field contains control characters or other bytes
 * unsafe for HTTP header serialization (including CR and LF).
 *
 * @param value - Header name or value to inspect.
 */
export function hasUnsafeHeaderFieldChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Validates a request header name and value before passing them to fetch.
 *
 * @param name - Header field name (already trimmed when supplied from buildHeaders).
 * @param value - Header field value.
 * @returns An error message when invalid, otherwise null.
 */
export function validateHeaderField(name: string, value: string): string | null {
  if (FORBIDDEN_HEADER_NAMES.has(name.toLowerCase())) {
    return `Forbidden header: ${name}`;
  }

  if (hasUnsafeHeaderFieldChars(name)) {
    return `Invalid header name: control characters are not allowed`;
  }

  if (hasUnsafeHeaderFieldChars(value)) {
    return `Invalid header value for "${name}": control characters are not allowed`;
  }

  return null;
}

/**
 * Validates a header map and returns the first validation error, if any.
 *
 * @param headers - Header map ready for fetch.
 * @returns An error message when a field is invalid, otherwise null.
 */
export function validateHeaders(headers: Record<string, string>): string | null {
  for (const [name, value] of Object.entries(headers)) {
    const error = validateHeaderField(name, value);
    if (error) {
      return error;
    }
  }
  return null;
}
