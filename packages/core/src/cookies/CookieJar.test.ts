import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CookieJar } from './CookieJar';
import type { KeyValue } from '../types';
import { describe } from 'vitest';

const settings = new Map<string, string>();
let jar: CookieJar;

/**
 * Sets up an isolated in-memory registry and cookie jar for tests.
 */
function setupCookieJarTest(): void {
  settings.clear();
  jar = new CookieJar({
    getSetting: (key) => settings.get(key),
    setSetting: (key, value) => settings.set(key, value)
  });
}

describe('hostFromUrl', () => {
  beforeEach(() => {
    setupCookieJarTest();
  });

  afterEach(() => {
    settings.clear();
  });

  it('returns null for empty or whitespace URLs', () => {
    expect(CookieJar.hostFromUrl('')).toBeNull();
    expect(CookieJar.hostFromUrl('   ')).toBeNull();
  });

  it('extracts hostname from absolute URLs', () => {
    expect(CookieJar.hostFromUrl('https://Example.com/path?q=1')).toBe('example.com');
    expect(CookieJar.hostFromUrl('http://api.test.local:8080/')).toBe('api.test.local');
  });

  it('parses host-only values with an https fallback', () => {
    expect(CookieJar.hostFromUrl('example.com')).toBe('example.com');
    expect(CookieJar.hostFromUrl('example.com/path')).toBe('example.com');
  });

  it('returns null for invalid URLs', () => {
    expect(CookieJar.hostFromUrl('://bad')).toBeNull();
  });
});

describe('getCookiesForDomain and setCookiesForDomain', () => {
  beforeEach(() => {
    setupCookieJarTest();
  });

  afterEach(() => {
    settings.clear();
  });

  it('returns an empty list for unknown domains', () => {
    expect(jar.getCookiesForDomain('example.com')).toEqual([]);
  });

  it('getCookiesForDomain returns cookies previously saved with setCookiesForDomain', () => {
    const cookies: KeyValue[] = [
      { key: 'session', value: 'abc123', enabled: true },
      { key: 'theme', value: 'dark', enabled: false }
    ];

    jar.setCookiesForDomain('example.com', cookies);
    expect(jar.getCookiesForDomain('example.com')).toEqual(cookies);
  });

  it('normalizes domain casing and whitespace', () => {
    jar.setCookiesForDomain(' Example.COM ', [{ key: 'token', value: 'xyz', enabled: true }]);

    expect(jar.getCookiesForDomain('example.com')).toEqual([
      { key: 'token', value: 'xyz', enabled: true }
    ]);
  });

  it('filters fully empty rows and trims cookie names', () => {
    jar.setCookiesForDomain('example.com', [
      { key: ' session ', value: 'abc', enabled: true },
      { key: '', value: '', enabled: true },
      { key: ' ', value: 'kept', enabled: true }
    ]);

    expect(jar.getCookiesForDomain('example.com')).toEqual([
      { key: 'session', value: 'abc', enabled: true },
      { key: '', value: 'kept', enabled: true }
    ]);
  });

  it('removes the domain entry when all rows are empty', () => {
    jar.setCookiesForDomain('example.com', [{ key: 'session', value: 'abc', enabled: true }]);
    jar.setCookiesForDomain('example.com', [{ key: '', value: '', enabled: true }]);

    expect(jar.getCookiesForDomain('example.com')).toEqual([]);
    expect(settings.get('cookieJar')).toBe('{}');
  });

  it('returns defensive copies that do not mutate stored cookies', () => {
    jar.setCookiesForDomain('example.com', [{ key: 'session', value: 'abc', enabled: true }]);

    const cookies = jar.getCookiesForDomain('example.com');
    cookies[0].value = 'mutated';

    expect(jar.getCookiesForDomain('example.com')).toEqual([
      { key: 'session', value: 'abc', enabled: true }
    ]);
  });

  it('degrades to an empty jar when stored JSON is corrupt', () => {
    settings.set('cookieJar', '{not-json');
    expect(jar.getCookiesForDomain('example.com')).toEqual([]);
    expect(jar.listDomains()).toEqual([]);
  });

  it('degrades to an empty jar when the root value is not an object', () => {
    settings.set('cookieJar', '["example.com"]');
    expect(jar.listDomains()).toEqual([]);
  });

  it('keeps valid domains and drops malformed cookie rows', () => {
    settings.set(
      'cookieJar',
      JSON.stringify({
        'example.com': [
          { key: 'session', value: 'ok', enabled: true },
          { key: 1, value: 'bad' },
          'not-an-object',
          { key: 'theme', value: 'dark' }
        ],
        'bad.com': 'not-an-array',
        '': [{ key: 'x', value: 'y', enabled: true }]
      })
    );

    expect(jar.listDomains()).toEqual(['example.com']);
    expect(jar.getCookiesForDomain('example.com')).toEqual([
      { key: 'session', value: 'ok', enabled: true },
      { key: 'theme', value: 'dark', enabled: true }
    ]);
    expect(jar.getCookiesForDomain('bad.com')).toEqual([]);
  });

  it('preserves the secure flag when cookies are resaved from the UI', () => {
    jar.captureSetCookies('https://example.com/login', ['session=abc; Secure; Path=/']);

    jar.setCookiesForDomain('example.com', [{ key: 'session', value: 'updated', enabled: true }]);

    expect(jar.buildCookieHeader('https://example.com/')).toBe('session=updated');
    expect(jar.buildCookieHeader('http://example.com/')).toBeNull();
  });
});

describe('listDomains', () => {
  beforeEach(() => {
    setupCookieJarTest();
  });

  afterEach(() => {
    settings.clear();
  });

  it('returns an empty list when no cookies are saved', () => {
    expect(jar.listDomains()).toEqual([]);
  });

  it('returns saved cookie domains in sorted order', () => {
    jar.setCookiesForDomain('z.example.com', [{ key: 'session', value: 'abc', enabled: true }]);
    jar.setCookiesForDomain('a.example.com', [{ key: 'theme', value: 'dark', enabled: true }]);

    expect(jar.listDomains()).toEqual(['a.example.com', 'z.example.com']);
  });

  it('omits domains after their last cookie is removed', () => {
    jar.setCookiesForDomain('example.com', [{ key: 'session', value: 'abc', enabled: true }]);
    jar.setCookiesForDomain('example.com', []);

    expect(jar.listDomains()).toEqual([]);
  });
});

describe('buildCookieHeader', () => {
  beforeEach(() => {
    setupCookieJarTest();
  });

  afterEach(() => {
    settings.clear();
  });

  it('returns null when the URL has no host', () => {
    expect(jar.buildCookieHeader('')).toBeNull();
  });

  it('returns null when no enabled cookies exist for the host', () => {
    jar.setCookiesForDomain('example.com', [{ key: 'session', value: 'abc', enabled: false }]);

    expect(jar.buildCookieHeader('https://example.com/')).toBeNull();
  });

  it('joins enabled cookies into a Cookie header value', () => {
    jar.setCookiesForDomain('example.com', [
      { key: 'session', value: 'abc', enabled: true },
      { key: 'theme', value: 'dark', enabled: false },
      { key: 'lang', value: 'en', enabled: true }
    ]);

    expect(jar.buildCookieHeader('https://example.com/api')).toBe('session=abc; lang=en');
  });

  it('omits Secure cookies over plain HTTP but includes them over HTTPS', () => {
    jar.captureSetCookies('https://example.com/login', [
      'secureToken=secret; Path=/; Secure',
      'plainToken=open; Path=/'
    ]);

    expect(jar.buildCookieHeader('https://example.com/api')).toBe(
      'secureToken=secret; plainToken=open'
    );
    expect(jar.buildCookieHeader('http://example.com/api')).toBe('plainToken=open');
  });

  it('excludes cookies whose names or values contain control characters', () => {
    jar.setCookiesForDomain('example.com', [
      { key: 'safe', value: 'ok', enabled: true },
      { key: 'bad', value: 'val\r\ninjected', enabled: true },
      { key: 'also-bad\x7F', value: 'fine', enabled: true }
    ]);

    expect(jar.buildCookieHeader('https://example.com/')).toBe('safe=ok');
  });

  it('excludes cookies whose values contain semicolon injection patterns', () => {
    jar.setCookiesForDomain('example.com', [
      { key: 'safe', value: 'ok', enabled: true },
      { key: 'session', value: 'abc; Secure', enabled: true }
    ]);

    expect(jar.buildCookieHeader('https://example.com/')).toBe('safe=ok');
  });
});

describe('captureSetCookies', () => {
  beforeEach(() => {
    setupCookieJarTest();
  });

  afterEach(() => {
    settings.clear();
    vi.useRealTimers();
  });

  it('does nothing when headers are missing or empty', () => {
    jar.captureSetCookies('https://example.com/', undefined);
    jar.captureSetCookies('https://example.com/', []);

    expect(jar.getCookiesForDomain('example.com')).toEqual([]);
  });

  it('upserts cookies from Set-Cookie headers', () => {
    jar.captureSetCookies('https://example.com/login', [
      'session=abc123; Path=/; HttpOnly',
      'theme=dark; Path=/'
    ]);

    expect(jar.getCookiesForDomain('example.com')).toEqual([
      { key: 'session', value: 'abc123', enabled: true },
      { key: 'theme', value: 'dark', enabled: true }
    ]);
  });

  it('updates an existing cookie with the same name', () => {
    jar.setCookiesForDomain('example.com', [{ key: 'session', value: 'old', enabled: true }]);

    jar.captureSetCookies('https://example.com/refresh', ['session=new; Path=/']);

    expect(jar.getCookiesForDomain('example.com')).toEqual([
      { key: 'session', value: 'new', enabled: true }
    ]);
  });

  it('deletes cookies when Max-Age is zero', () => {
    jar.setCookiesForDomain('example.com', [
      { key: 'session', value: 'abc', enabled: true },
      { key: 'theme', value: 'dark', enabled: true }
    ]);

    jar.captureSetCookies('https://example.com/logout', ['session=; Max-Age=0; Path=/']);

    expect(jar.getCookiesForDomain('example.com')).toEqual([
      { key: 'theme', value: 'dark', enabled: true }
    ]);
  });

  it('deletes cookies when Expires is in the past', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-20T12:00:00Z'));

    jar.setCookiesForDomain('example.com', [{ key: 'session', value: 'abc', enabled: true }]);

    jar.captureSetCookies('https://example.com/logout', [
      'session=; Expires=Wed, 01 Jan 2020 00:00:00 GMT; Path=/'
    ]);

    expect(jar.getCookiesForDomain('example.com')).toEqual([]);
  });

  it('ignores malformed Set-Cookie headers', () => {
    jar.captureSetCookies('https://example.com/', ['invalid-header', '=missing-name']);

    expect(jar.getCookiesForDomain('example.com')).toEqual([]);
  });

  it('does nothing when the URL has no host', () => {
    jar.captureSetCookies('', ['session=abc']);

    expect(settings.get('cookieJar')).toBeUndefined();
  });

  it('does not persist cookies with control characters in the name or value', () => {
    jar.captureSetCookies('https://example.com/', [
      'safe=ok; Path=/',
      'bad=val\r\ninjected; Path=/',
      'also-bad\x7F=fine; Path=/'
    ]);

    expect(jar.getCookiesForDomain('example.com')).toEqual([
      { key: 'safe', value: 'ok', enabled: true }
    ]);
  });
});
