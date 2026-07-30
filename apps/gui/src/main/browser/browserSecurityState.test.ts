import { describe, expect, it } from 'vitest';
import { isCertificateFailLoadError, resolveBrowserSecurityState } from './browserSecurityState';

describe('resolveBrowserSecurityState', () => {
  it('returns invalid-cert when a certificate error is flagged', () => {
    expect(resolveBrowserSecurityState('https://example.com/', true)).toBe('invalid-cert');
    expect(resolveBrowserSecurityState('http://example.com/', true)).toBe('invalid-cert');
    expect(resolveBrowserSecurityState('chrome-error://chromewebdata/', true)).toBe('invalid-cert');
  });

  it('returns secure for https without a certificate error', () => {
    expect(resolveBrowserSecurityState('https://example.com/path', false)).toBe('secure');
  });

  it('returns insecure for http without a certificate error', () => {
    expect(resolveBrowserSecurityState('http://example.com/', false)).toBe('insecure');
  });

  it('returns unknown for non-http(s) schemes and invalid URLs', () => {
    expect(resolveBrowserSecurityState('about:blank', false)).toBe('unknown');
    expect(resolveBrowserSecurityState('file:///tmp/page.html', false)).toBe('unknown');
    expect(resolveBrowserSecurityState('not a url', false)).toBe('unknown');
  });
});

describe('isCertificateFailLoadError', () => {
  it('recognizes common ERR_CERT_* codes', () => {
    expect(isCertificateFailLoadError(-202)).toBe(true);
    expect(isCertificateFailLoadError(-200)).toBe(true);
    expect(isCertificateFailLoadError(-3)).toBe(false);
    expect(isCertificateFailLoadError(-6)).toBe(false);
  });
});
