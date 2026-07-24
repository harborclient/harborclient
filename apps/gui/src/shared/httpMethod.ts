import type { HttpMethod } from '#/shared/types/common';

const HTTP_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
]);

/**
 * Parses and validates an HTTP method string from user input or plugin hooks.
 *
 * @param method - Raw method value that may include surrounding whitespace or mixed case.
 * @returns Normalized HarborClient method when supported, otherwise null.
 */
export function parseHttpMethod(method: string | undefined | null): HttpMethod | null {
  if (typeof method !== 'string') {
    return null;
  }

  const upper = method.trim().toUpperCase() as HttpMethod;
  return HTTP_METHODS.has(upper) ? upper : null;
}
