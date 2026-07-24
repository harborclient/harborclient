const MDN_HEADERS_BASE = 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers';

/**
 * Builds the MDN reference URL for an HTTP response header name.
 *
 * @param headerName - Header field name as returned by the server.
 * @returns MDN documentation URL for the given header.
 */
export function headerMdnDocsUrl(headerName: string): string {
  return `${MDN_HEADERS_BASE}/${encodeURIComponent(headerName.trim())}`;
}
