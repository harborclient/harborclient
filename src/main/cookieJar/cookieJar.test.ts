import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LocalRegistry } from '#/main/db/LocalRegistry';
import type { KeyValue } from '#/shared/types';
import { describeSqlite } from '#/test/nativeModules';

let tempDir: string;
let registry: LocalRegistry;
let cookieJar: typeof import('#/main/cookieJar/cookieJar');

/**
 * Sets up an isolated local registry for cookie jar tests.
 */
async function setupCookieJarTest(): Promise<void> {
  vi.resetModules();
  tempDir = mkdtempSync(join(tmpdir(), 'hc-cookie-test-'));
  registry = new LocalRegistry(tempDir);
  await registry.init();
  const registryInstance = await import('#/main/db/localRegistryInstance');
  registryInstance.setLocalRegistryForTesting(registry);
  cookieJar = await import('#/main/cookieJar/cookieJar');
}

describeSqlite('hostFromUrl', () => {
  beforeEach(async () => {
    await setupCookieJarTest();
  });

  afterEach(async () => {
    await registry.close();
    rmSync(tempDir, { recursive: true, force: true });
    const registryInstance = await import('#/main/db/localRegistryInstance');
    registryInstance.clearLocalRegistryForTesting();
  });

  it('returns null for empty or whitespace URLs', () => {
    expect(cookieJar.hostFromUrl('')).toBeNull();
    expect(cookieJar.hostFromUrl('   ')).toBeNull();
  });

  it('extracts hostname from absolute URLs', () => {
    expect(cookieJar.hostFromUrl('https://Example.com/path?q=1')).toBe('example.com');
    expect(cookieJar.hostFromUrl('http://api.test.local:8080/')).toBe('api.test.local');
  });

  it('parses host-only values with an https fallback', () => {
    expect(cookieJar.hostFromUrl('example.com')).toBe('example.com');
    expect(cookieJar.hostFromUrl('example.com/path')).toBe('example.com');
  });

  it('returns null for invalid URLs', () => {
    expect(cookieJar.hostFromUrl('://bad')).toBeNull();
  });
});

describeSqlite('getCookiesForDomain and setCookiesForDomain', () => {
  beforeEach(async () => {
    await setupCookieJarTest();
  });

  afterEach(async () => {
    await registry.close();
    rmSync(tempDir, { recursive: true, force: true });
    const registryInstance = await import('#/main/db/localRegistryInstance');
    registryInstance.clearLocalRegistryForTesting();
  });

  it('returns an empty list for unknown domains', () => {
    expect(cookieJar.getCookiesForDomain('example.com')).toEqual([]);
  });

  it('getCookiesForDomain returns cookies previously saved with setCookiesForDomain', () => {
    const cookies: KeyValue[] = [
      { key: 'session', value: 'abc123', enabled: true },
      { key: 'theme', value: 'dark', enabled: false }
    ];

    cookieJar.setCookiesForDomain('example.com', cookies);
    expect(cookieJar.getCookiesForDomain('example.com')).toEqual(cookies);
  });

  it('normalizes domain casing and whitespace', () => {
    cookieJar.setCookiesForDomain(' Example.COM ', [{ key: 'token', value: 'xyz', enabled: true }]);

    expect(cookieJar.getCookiesForDomain('example.com')).toEqual([
      { key: 'token', value: 'xyz', enabled: true }
    ]);
  });

  it('filters fully empty rows and trims cookie names', () => {
    cookieJar.setCookiesForDomain('example.com', [
      { key: ' session ', value: 'abc', enabled: true },
      { key: '', value: '', enabled: true },
      { key: ' ', value: 'kept', enabled: true }
    ]);

    expect(cookieJar.getCookiesForDomain('example.com')).toEqual([
      { key: 'session', value: 'abc', enabled: true },
      { key: '', value: 'kept', enabled: true }
    ]);
  });

  it('removes the domain entry when all rows are empty', () => {
    cookieJar.setCookiesForDomain('example.com', [{ key: 'session', value: 'abc', enabled: true }]);
    cookieJar.setCookiesForDomain('example.com', [{ key: '', value: '', enabled: true }]);

    expect(cookieJar.getCookiesForDomain('example.com')).toEqual([]);
    expect(registry.getSetting('cookieJar')).toBe('{}');
  });

  it('returns defensive copies that do not mutate stored cookies', () => {
    cookieJar.setCookiesForDomain('example.com', [{ key: 'session', value: 'abc', enabled: true }]);

    const cookies = cookieJar.getCookiesForDomain('example.com');
    cookies[0].value = 'mutated';

    expect(cookieJar.getCookiesForDomain('example.com')).toEqual([
      { key: 'session', value: 'abc', enabled: true }
    ]);
  });

  it('preserves the secure flag when cookies are resaved from the UI', () => {
    cookieJar.captureSetCookies('https://example.com/login', ['session=abc; Secure; Path=/']);

    cookieJar.setCookiesForDomain('example.com', [
      { key: 'session', value: 'updated', enabled: true }
    ]);

    expect(cookieJar.buildCookieHeader('https://example.com/')).toBe('session=updated');
    expect(cookieJar.buildCookieHeader('http://example.com/')).toBeNull();
  });
});

describeSqlite('buildCookieHeader', () => {
  beforeEach(async () => {
    await setupCookieJarTest();
  });

  afterEach(async () => {
    await registry.close();
    rmSync(tempDir, { recursive: true, force: true });
    const registryInstance = await import('#/main/db/localRegistryInstance');
    registryInstance.clearLocalRegistryForTesting();
  });

  it('returns null when the URL has no host', () => {
    expect(cookieJar.buildCookieHeader('')).toBeNull();
  });

  it('returns null when no enabled cookies exist for the host', () => {
    cookieJar.setCookiesForDomain('example.com', [
      { key: 'session', value: 'abc', enabled: false }
    ]);

    expect(cookieJar.buildCookieHeader('https://example.com/')).toBeNull();
  });

  it('joins enabled cookies into a Cookie header value', () => {
    cookieJar.setCookiesForDomain('example.com', [
      { key: 'session', value: 'abc', enabled: true },
      { key: 'theme', value: 'dark', enabled: false },
      { key: 'lang', value: 'en', enabled: true }
    ]);

    expect(cookieJar.buildCookieHeader('https://example.com/api')).toBe('session=abc; lang=en');
  });

  it('omits Secure cookies over plain HTTP but includes them over HTTPS', () => {
    cookieJar.captureSetCookies('https://example.com/login', [
      'secureToken=secret; Path=/; Secure',
      'plainToken=open; Path=/'
    ]);

    expect(cookieJar.buildCookieHeader('https://example.com/api')).toBe(
      'secureToken=secret; plainToken=open'
    );
    expect(cookieJar.buildCookieHeader('http://example.com/api')).toBe('plainToken=open');
  });

  it('excludes cookies whose names or values contain control characters', () => {
    cookieJar.setCookiesForDomain('example.com', [
      { key: 'safe', value: 'ok', enabled: true },
      { key: 'bad', value: 'val\r\ninjected', enabled: true },
      { key: 'also-bad\x7F', value: 'fine', enabled: true }
    ]);

    expect(cookieJar.buildCookieHeader('https://example.com/')).toBe('safe=ok');
  });

  it('excludes cookies whose values contain semicolon injection patterns', () => {
    cookieJar.setCookiesForDomain('example.com', [
      { key: 'safe', value: 'ok', enabled: true },
      { key: 'session', value: 'abc; Secure', enabled: true }
    ]);

    expect(cookieJar.buildCookieHeader('https://example.com/')).toBe('safe=ok');
  });
});

describeSqlite('captureSetCookies', () => {
  beforeEach(async () => {
    await setupCookieJarTest();
  });

  afterEach(async () => {
    await registry.close();
    rmSync(tempDir, { recursive: true, force: true });
    const registryInstance = await import('#/main/db/localRegistryInstance');
    registryInstance.clearLocalRegistryForTesting();
    vi.useRealTimers();
  });

  it('does nothing when headers are missing or empty', () => {
    cookieJar.captureSetCookies('https://example.com/', undefined);
    cookieJar.captureSetCookies('https://example.com/', []);

    expect(cookieJar.getCookiesForDomain('example.com')).toEqual([]);
  });

  it('upserts cookies from Set-Cookie headers', () => {
    cookieJar.captureSetCookies('https://example.com/login', [
      'session=abc123; Path=/; HttpOnly',
      'theme=dark; Path=/'
    ]);

    expect(cookieJar.getCookiesForDomain('example.com')).toEqual([
      { key: 'session', value: 'abc123', enabled: true },
      { key: 'theme', value: 'dark', enabled: true }
    ]);
  });

  it('updates an existing cookie with the same name', () => {
    cookieJar.setCookiesForDomain('example.com', [{ key: 'session', value: 'old', enabled: true }]);

    cookieJar.captureSetCookies('https://example.com/refresh', ['session=new; Path=/']);

    expect(cookieJar.getCookiesForDomain('example.com')).toEqual([
      { key: 'session', value: 'new', enabled: true }
    ]);
  });

  it('deletes cookies when Max-Age is zero', () => {
    cookieJar.setCookiesForDomain('example.com', [
      { key: 'session', value: 'abc', enabled: true },
      { key: 'theme', value: 'dark', enabled: true }
    ]);

    cookieJar.captureSetCookies('https://example.com/logout', ['session=; Max-Age=0; Path=/']);

    expect(cookieJar.getCookiesForDomain('example.com')).toEqual([
      { key: 'theme', value: 'dark', enabled: true }
    ]);
  });

  it('deletes cookies when Expires is in the past', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-20T12:00:00Z'));

    cookieJar.setCookiesForDomain('example.com', [{ key: 'session', value: 'abc', enabled: true }]);

    cookieJar.captureSetCookies('https://example.com/logout', [
      'session=; Expires=Wed, 01 Jan 2020 00:00:00 GMT; Path=/'
    ]);

    expect(cookieJar.getCookiesForDomain('example.com')).toEqual([]);
  });

  it('ignores malformed Set-Cookie headers', () => {
    cookieJar.captureSetCookies('https://example.com/', ['invalid-header', '=missing-name']);

    expect(cookieJar.getCookiesForDomain('example.com')).toEqual([]);
  });

  it('does nothing when the URL has no host', () => {
    cookieJar.captureSetCookies('', ['session=abc']);

    expect(registry.getSetting('cookieJar')).toBeUndefined();
  });

  it('does not persist cookies with control characters in the name or value', () => {
    cookieJar.captureSetCookies('https://example.com/', [
      'safe=ok; Path=/',
      'bad=val\r\ninjected; Path=/',
      'also-bad\x7F=fine; Path=/'
    ]);

    expect(cookieJar.getCookiesForDomain('example.com')).toEqual([
      { key: 'safe', value: 'ok', enabled: true }
    ]);
  });
});
