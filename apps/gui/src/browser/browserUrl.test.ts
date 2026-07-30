import { describe, expect, it } from 'vitest';
import {
  isAllowedBrowserUrl,
  normalizeBrowserAddressInput,
  browserUrlsMatch,
  toViewSourceUrl
} from './browserUrl';

describe('isAllowedBrowserUrl', () => {
  it('allows http and https URLs', () => {
    expect(isAllowedBrowserUrl('https://example.com/')).toBe(true);
    expect(isAllowedBrowserUrl('http://localhost:3000')).toBe(true);
  });

  it('allows about:blank', () => {
    expect(isAllowedBrowserUrl('about:blank')).toBe(true);
  });

  it('allows view-source wrappers of http(s) URLs', () => {
    expect(isAllowedBrowserUrl('view-source:https://example.com/')).toBe(true);
    expect(isAllowedBrowserUrl('view-source:http://localhost:3000/path')).toBe(true);
  });

  it('rejects nested view-source and non-http(s) view-source targets', () => {
    expect(isAllowedBrowserUrl('view-source:view-source:https://example.com/')).toBe(false);
    expect(isAllowedBrowserUrl('view-source:about:blank')).toBe(false);
    expect(isAllowedBrowserUrl('view-source:file:///etc/passwd')).toBe(false);
  });

  it('rejects file and custom schemes', () => {
    expect(isAllowedBrowserUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedBrowserUrl('harbor-plugin://x/shell.html')).toBe(false);
    expect(isAllowedBrowserUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects empty and malformed input', () => {
    expect(isAllowedBrowserUrl('')).toBe(false);
    expect(isAllowedBrowserUrl('not a url')).toBe(false);
  });
});

describe('toViewSourceUrl', () => {
  it('wraps http(s) URLs', () => {
    expect(toViewSourceUrl('https://example.com/path')).toBe(
      'view-source:https://example.com/path'
    );
    expect(toViewSourceUrl('http://localhost:3000')).toBe('view-source:http://localhost:3000/');
  });

  it('returns null for non-http(s) URLs', () => {
    expect(toViewSourceUrl('about:blank')).toBeNull();
    expect(toViewSourceUrl('view-source:https://example.com/')).toBeNull();
    expect(toViewSourceUrl('file:///tmp')).toBeNull();
    expect(toViewSourceUrl('')).toBeNull();
  });
});

describe('normalizeBrowserAddressInput', () => {
  it('prefixes bare hostnames with https', () => {
    expect(normalizeBrowserAddressInput('example.com')).toBe('https://example.com/');
  });

  it('preserves about:blank', () => {
    expect(normalizeBrowserAddressInput('about:blank')).toBe('about:blank');
  });

  it('normalizes view-source http(s) URLs', () => {
    expect(normalizeBrowserAddressInput('view-source:https://example.com')).toBe(
      'view-source:https://example.com/'
    );
  });

  it('returns null for disallowed schemes', () => {
    expect(normalizeBrowserAddressInput('file:///tmp')).toBeNull();
    expect(normalizeBrowserAddressInput('view-source:about:blank')).toBeNull();
  });
});

describe('browserUrlsMatch', () => {
  it('matches equivalent http(s) URLs after normalization', () => {
    expect(browserUrlsMatch('https://example.com', 'https://example.com/')).toBe(true);
    expect(browserUrlsMatch('example.com/path', 'https://example.com/path')).toBe(true);
  });

  it('matches equivalent view-source URLs after normalization', () => {
    expect(
      browserUrlsMatch('view-source:https://example.com', 'view-source:https://example.com/')
    ).toBe(true);
  });

  it('does not match different paths or hosts', () => {
    expect(browserUrlsMatch('https://example.com/a', 'https://example.com/b')).toBe(false);
    expect(browserUrlsMatch('https://a.test/', 'https://b.test/')).toBe(false);
  });

  it('returns false for disallowed URLs', () => {
    expect(browserUrlsMatch('file:///tmp', 'https://example.com/')).toBe(false);
  });
});
