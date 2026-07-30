import type { BrowserSecurityState } from '@harborclient/core/types';

/**
 * Chromium net error codes that indicate TLS certificate verification failed.
 *
 * @see https://source.chromium.org/chromium/chromium/src/+/main:net/base/net_error_list.h
 */
const CERT_ERROR_CODES = new Set([
  -200, // ERR_CERT_COMMON_NAME_INVALID
  -201, // ERR_CERT_DATE_INVALID
  -202, // ERR_CERT_AUTHORITY_INVALID
  -203, // ERR_CERT_CONTAINS_ERRORS
  -204, // ERR_CERT_NO_REVOCATION_MECHANISM
  -205, // ERR_CERT_UNABLE_TO_CHECK_REVOCATION
  -206, // ERR_CERT_REVOKED
  -207, // ERR_CERT_INVALID
  -208, // ERR_CERT_WEAK_SIGNATURE_ALGORITHM
  -210, // ERR_CERT_NON_UNIQUE_NAME
  -211, // ERR_CERT_WEAK_KEY
  -212, // ERR_CERT_NAME_CONSTRAINT_VIOLATION
  -213, // ERR_CERT_VALIDITY_TOO_LONG
  -214, // ERR_CERTIFICATE_TRANSPARENCY_REQUIRED
  -215, // ERR_CERT_SYMANTEC_LEGACY
  -217, // ERR_CERT_KNOWN_INTERCEPTION_BLOCKED
  -218 // ERR_SSL_OBSOLETE_VERSION (treated as TLS/cert failure for the lock)
]);

/**
 * Returns whether a Chromium `did-fail-load` error code is a certificate failure.
 *
 * @param errorCode - Negative Chromium net error code from `did-fail-load`.
 * @returns True when the failure is cert-related.
 */
export function isCertificateFailLoadError(errorCode: number): boolean {
  return CERT_ERROR_CODES.has(errorCode);
}

/**
 * Derives the address-bar security indicator from the guest URL and cert-error flag.
 *
 * Certificate errors take precedence so a failed HTTPS load stays `invalid-cert`
 * even when Chromium temporarily shows an error-page URL.
 *
 * @param url - Last known guest URL (committed or attempted).
 * @param hasCertificateError - True when the current navigation hit a cert failure.
 * @returns Security state for the lock icon.
 */
export function resolveBrowserSecurityState(
  url: string,
  hasCertificateError: boolean
): BrowserSecurityState {
  if (hasCertificateError) {
    return 'invalid-cert';
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'unknown';
  }
  if (parsed.protocol === 'https:') {
    return 'secure';
  }
  if (parsed.protocol === 'http:') {
    return 'insecure';
  }
  return 'unknown';
}
