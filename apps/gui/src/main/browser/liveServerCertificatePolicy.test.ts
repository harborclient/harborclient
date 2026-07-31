import { describe, expect, it } from 'vitest';
import { shouldAllowLiveServerCertificateError } from './liveServerCertificatePolicy';

describe('shouldAllowLiveServerCertificateError', () => {
  it('allows when the request origin matches a running https live server', () => {
    expect(
      shouldAllowLiveServerCertificateError('https://127.0.0.1:5500/index.html', [
        'https://127.0.0.1:5500'
      ])
    ).toBe(true);
    expect(
      shouldAllowLiveServerCertificateError('https://127.0.0.1:5500/docs/?q=1#top', [
        'http://127.0.0.1:3000',
        'https://127.0.0.1:5500'
      ])
    ).toBe(true);
  });

  it('denies when no running origin matches', () => {
    expect(
      shouldAllowLiveServerCertificateError('https://127.0.0.1:5500/', ['https://127.0.0.1:5501'])
    ).toBe(false);
    expect(shouldAllowLiveServerCertificateError('https://example.com/', [])).toBe(false);
    expect(
      shouldAllowLiveServerCertificateError('https://evil.example/', ['https://127.0.0.1:5500'])
    ).toBe(false);
  });

  it('denies http request URLs even when an http live server is running', () => {
    expect(
      shouldAllowLiveServerCertificateError('http://127.0.0.1:5500/', ['http://127.0.0.1:5500'])
    ).toBe(false);
  });

  it('denies https when only an http live server origin is listed', () => {
    expect(
      shouldAllowLiveServerCertificateError('https://127.0.0.1:5500/', ['http://127.0.0.1:5500'])
    ).toBe(false);
  });

  it('treats different ports as different origins', () => {
    expect(
      shouldAllowLiveServerCertificateError('https://127.0.0.1:8443/', ['https://127.0.0.1:443'])
    ).toBe(false);
  });

  it('matches localhost hostnames case-insensitively via URL.origin', () => {
    expect(
      shouldAllowLiveServerCertificateError('https://LocalHost:5500/page', [
        'https://localhost:5500'
      ])
    ).toBe(true);
  });

  it('denies invalid request URLs', () => {
    expect(shouldAllowLiveServerCertificateError('not a url', ['https://127.0.0.1:5500'])).toBe(
      false
    );
    expect(shouldAllowLiveServerCertificateError('', ['https://127.0.0.1:5500'])).toBe(false);
  });

  it('ignores invalid entries in the running-origins list', () => {
    expect(
      shouldAllowLiveServerCertificateError('https://127.0.0.1:5500/', [
        'not-an-origin',
        'https://127.0.0.1:5500'
      ])
    ).toBe(true);
  });
});
