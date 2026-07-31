/**
 * Pure helpers for deciding when Live Page may proceed past TLS certificate
 * errors for HarborClient live servers (self-signed / private CA).
 *
 * Callers that allow the load should still mark the session as having a
 * certificate error so the address-bar lock stays `invalid-cert` — the user
 * knowingly opened an untrusted live-server origin, not a globally trusted site.
 */

/**
 * Parses a URL and returns its origin (`scheme://host:port`), or null when the
 * string is not a valid absolute URL.
 *
 * @param value - Absolute URL or origin string.
 * @returns Canonical origin, or null.
 */
function tryParseOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Returns whether a `certificate-error` for the given request URL should be
 * allowed because it targets a currently running live server HTTPS origin.
 *
 * Matching is by URL origin only (scheme, host, port). Non-HTTPS request URLs
 * never match — HTTP live servers do not raise certificate errors we allow.
 * Arbitrary https origins are never allowed.
 *
 * @param url - Request URL from Electron's `certificate-error` event.
 * @param runningOrigins - `RunningLiveServer.origin` values for servers that
 *   are currently listening (may include http origins; those never match).
 * @returns True when the request origin equals a running live-server origin.
 */
export function shouldAllowLiveServerCertificateError(
  url: string,
  runningOrigins: string[]
): boolean {
  const requestOrigin = tryParseOrigin(url);
  if (requestOrigin === null || !requestOrigin.startsWith('https:')) {
    return false;
  }
  for (const candidate of runningOrigins) {
    const origin = tryParseOrigin(candidate);
    if (origin !== null && origin === requestOrigin) {
      return true;
    }
  }
  return false;
}
