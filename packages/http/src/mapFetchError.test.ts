import { describe, expect, it } from 'vitest';
import { mapFetchError } from './mapFetchError.js';

/**
 * Builds a TypeError matching undici's opaque fetch failure shape.
 *
 * @param cause - Nested cause assigned to `error.cause`.
 */
function fetchFailed(cause: Error): TypeError {
  const err = new TypeError('fetch failed');
  err.cause = cause;
  return err;
}

/**
 * Builds a Node-style system error with a `code` property.
 *
 * @param message - Error message.
 * @param code - System error code.
 */
function codedError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

describe('mapFetchError', () => {
  it('maps AbortError to Request canceled', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    expect(mapFetchError(err, 30_000)).toBe('Request canceled');
  });

  it('maps TimeoutError with the configured timeout', () => {
    const err = new Error('timeout');
    err.name = 'TimeoutError';
    expect(mapFetchError(err, 5000)).toBe('Request timed out after 5000 ms');
  });

  it('maps ECONNREFUSED with host and port from the cause message', () => {
    const err = fetchFailed(codedError('connect ECONNREFUSED 127.0.0.1:5009', 'ECONNREFUSED'));
    expect(mapFetchError(err, 30_000)).toBe('Connection refused (127.0.0.1:5009)');
  });

  it('maps ECONNREFUSED without a host when the message has none', () => {
    const err = fetchFailed(codedError('connect ECONNREFUSED', 'ECONNREFUSED'));
    expect(mapFetchError(err, 30_000)).toBe('Connection refused');
  });

  it('maps ENOTFOUND to a DNS failure message', () => {
    const err = fetchFailed(codedError('getaddrinfo ENOTFOUND example.invalid', 'ENOTFOUND'));
    expect(mapFetchError(err, 30_000)).toBe('Host not found (DNS lookup failed)');
  });

  it('maps EAI_AGAIN to a temporary DNS failure message', () => {
    const err = fetchFailed(codedError('getaddrinfo EAI_AGAIN example.com', 'EAI_AGAIN'));
    expect(mapFetchError(err, 30_000)).toBe('Temporary DNS failure — try again');
  });

  it('maps ECONNRESET', () => {
    const err = fetchFailed(codedError('read ECONNRESET', 'ECONNRESET'));
    expect(mapFetchError(err, 30_000)).toBe('Connection reset');
  });

  it('maps connect timeout codes', () => {
    const err = fetchFailed(codedError('Connect Timeout Error', 'UND_ERR_CONNECT_TIMEOUT'));
    expect(mapFetchError(err, 30_000)).toBe('Connection timed out');
  });

  it('maps self-signed TLS failures with a Verify SSL hint', () => {
    const err = fetchFailed(codedError('self-signed certificate', 'DEPTH_ZERO_SELF_SIGNED_CERT'));
    expect(mapFetchError(err, 30_000)).toBe(
      'TLS certificate verification failed — disable Verify SSL for local HTTPS, or use a trusted certificate'
    );
  });

  it('maps CERT_HAS_EXPIRED', () => {
    const err = fetchFailed(codedError('certificate has expired', 'CERT_HAS_EXPIRED'));
    expect(mapFetchError(err, 30_000)).toBe('TLS certificate has expired');
  });

  it('uses the cause message when fetch failed has no mapped code', () => {
    const err = fetchFailed(new Error('bad port'));
    expect(mapFetchError(err, 30_000)).toBe('bad port');
  });

  it('keeps a non-opaque top-level Error message', () => {
    expect(mapFetchError(new Error('network down'), 30_000)).toBe('network down');
  });

  it('falls back to Network request failed for opaque fetch failed alone', () => {
    expect(mapFetchError(new TypeError('fetch failed'), 30_000)).toBe('Network request failed');
  });

  it('returns Unknown error for non-Error values', () => {
    expect(mapFetchError(null, 30_000)).toBe('Unknown error');
    expect(mapFetchError(42, 30_000)).toBe('Unknown error');
  });
});
