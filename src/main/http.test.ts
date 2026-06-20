import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { SendRequestInput } from '#/shared/types';
import { serializeFormParts } from '#/shared/formData';
import { serializeUrlEncodedParts } from '#/shared/urlencoded';
import { DEFAULT_GENERAL_SETTINGS } from '#/main/settings/generalSettings';
import { buildHeaders, buildUrl, executeRequest, isValidRequestUrl } from '#/main/http';

describe('buildUrl', () => {
  it('returns trimmed URL when empty or whitespace', () => {
    expect(buildUrl('', [])).toBe('');
    expect(buildUrl('   ', [])).toBe('');
  });

  it('returns URL unchanged when no enabled params', () => {
    expect(buildUrl('https://example.com', [])).toBe('https://example.com');
    expect(
      buildUrl('https://example.com', [
        { key: 'q', value: 'test', enabled: false },
        { key: '  ', value: 'ignored', enabled: true }
      ])
    ).toBe('https://example.com');
  });

  it('appends and overwrites params on a valid absolute URL', () => {
    const url = buildUrl('https://example.com/path?existing=1', [
      { key: 'foo', value: 'bar', enabled: true },
      { key: 'existing', value: '2', enabled: true }
    ]);

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://example.com/path');
    expect(parsed.searchParams.get('existing')).toBe('2');
    expect(parsed.searchParams.get('foo')).toBe('bar');
  });

  it('skips disabled and blank-key params', () => {
    const url = buildUrl('https://example.com', [
      { key: 'enabled', value: 'yes', enabled: true },
      { key: 'disabled', value: 'no', enabled: false },
      { key: '   ', value: 'blank', enabled: true }
    ]);

    const parsed = new URL(url);
    expect(parsed.searchParams.get('enabled')).toBe('yes');
    expect(parsed.searchParams.has('disabled')).toBe(false);
    expect(parsed.searchParams.has('blank')).toBe(false);
  });

  it('uses fallback query building for non-absolute URLs', () => {
    expect(buildUrl('/api/users', [{ key: 'page', value: '2', enabled: true }])).toBe(
      '/api/users?page=2'
    );
    expect(buildUrl('/api/users?sort=name', [{ key: 'page', value: '2', enabled: true }])).toBe(
      '/api/users?sort=name&page=2'
    );
    expect(buildUrl('/search', [{ key: 'q', value: 'hello world', enabled: true }])).toBe(
      '/search?q=hello%20world'
    );
  });

  it('does not append params to disallowed schemes or malformed URLs', () => {
    const params = [{ key: 'q', value: 'test', enabled: true }];

    expect(buildUrl('javascript:alert(1)', params)).toBe('javascript:alert(1)');
    expect(buildUrl('file:///', params)).toBe('file:///');
    expect(buildUrl('not-a-url', params)).toBe('not-a-url');
    expect(buildUrl('//cdn.example.com/path', params)).toBe('//cdn.example.com/path');
  });
});

describe('isValidRequestUrl', () => {
  it('accepts http and https absolute URLs', () => {
    expect(isValidRequestUrl('https://example.com')).toBe(true);
    expect(isValidRequestUrl('http://localhost:8080/path')).toBe(true);
  });

  it('accepts root-relative paths', () => {
    expect(isValidRequestUrl('/api/users')).toBe(true);
    expect(isValidRequestUrl('/search?q=hello')).toBe(true);
  });

  it('rejects blank, dangerous, and malformed URLs', () => {
    expect(isValidRequestUrl('')).toBe(false);
    expect(isValidRequestUrl('   ')).toBe(false);
    expect(isValidRequestUrl('javascript:alert(1)')).toBe(false);
    expect(isValidRequestUrl('file:///')).toBe(false);
    expect(isValidRequestUrl('not-a-url')).toBe(false);
    expect(isValidRequestUrl('//cdn.example.com/path')).toBe(false);
  });
});

describe('buildHeaders', () => {
  it('includes only enabled headers with trimmed keys', () => {
    const headers = buildHeaders(
      [
        { key: ' Authorization ', value: 'Bearer token', enabled: true },
        { key: 'X-Disabled', value: 'off', enabled: false },
        { key: '  ', value: 'blank', enabled: true }
      ],
      'none'
    );

    expect(headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('auto-adds application/json Content-Type for json body', () => {
    expect(buildHeaders([], 'json')).toEqual({ 'Content-Type': 'application/json' });
  });

  it('auto-adds text/plain Content-Type for text body', () => {
    expect(buildHeaders([], 'text')).toEqual({ 'Content-Type': 'text/plain' });
  });

  it('does not auto-add Content-Type for none body', () => {
    expect(buildHeaders([], 'none')).toEqual({});
  });

  it('respects an existing case-insensitive content-type header', () => {
    const headers = buildHeaders(
      [{ key: 'content-type', value: 'application/xml', enabled: true }],
      'json'
    );

    expect(headers).toEqual({ 'content-type': 'application/xml' });
  });

  it('strips content-type for multipart body so fetch can set the boundary', () => {
    const headers = buildHeaders(
      [
        { key: 'Content-Type', value: 'multipart/form-data', enabled: true },
        { key: 'Authorization', value: 'Bearer token', enabled: true }
      ],
      'multipart'
    );

    expect(headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('does not auto-add Content-Type for multipart body', () => {
    expect(buildHeaders([], 'multipart')).toEqual({});
  });

  it('auto-adds application/x-www-form-urlencoded Content-Type for urlencoded body', () => {
    expect(buildHeaders([], 'urlencoded')).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded'
    });
  });

  it('respects an existing content-type header for urlencoded body', () => {
    const headers = buildHeaders(
      [{ key: 'Content-Type', value: 'text/plain', enabled: true }],
      'urlencoded'
    );

    expect(headers).toEqual({ 'Content-Type': 'text/plain' });
  });

  it('request headers override collection headers when merged last-wins', () => {
    const collectionHeaders = [{ key: 'Authorization', value: 'Bearer collection', enabled: true }];
    const requestHeaders = [{ key: 'Authorization', value: 'Bearer request', enabled: true }];
    const merged = [...collectionHeaders, ...requestHeaders];

    expect(buildHeaders(merged, 'none')).toEqual({ Authorization: 'Bearer request' });
  });
});

describe('executeRequest', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const baseInput: SendRequestInput = {
    method: 'GET',
    url: 'https://example.com',
    headers: [],
    params: [],
    body: '',
    bodyType: 'none'
  };

  it('returns URL required error for blank URL', async () => {
    const result = await executeRequest({ ...baseInput, url: '   ' });

    expect(result).toMatchObject({
      status: 0,
      statusText: 'Error',
      error: 'URL is required',
      timeMs: 0,
      sizeBytes: 0
    });
    expect(result.request).toMatchObject({
      method: 'GET',
      url: '   ',
      body: ''
    });
  });

  it('returns invalid URL error for disallowed schemes without calling fetch', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const result = await executeRequest({
      ...baseInput,
      url: 'javascript:alert(1)',
      params: [{ key: 'q', value: 'test', enabled: true }]
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 0,
      statusText: 'Error',
      error: 'Invalid URL',
      timeMs: 0,
      sizeBytes: 0
    });
    expect(result.request).toMatchObject({
      method: 'GET',
      url: 'javascript:alert(1)'
    });
  });

  it('omits body for GET and HEAD requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('ok', {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' }
      })
    );
    globalThis.fetch = fetchMock;

    await executeRequest({
      ...baseInput,
      method: 'GET',
      body: '{"ignored":true}',
      bodyType: 'json'
    });

    const getInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(getInit.method).toBe('GET');
    expect(getInit).not.toHaveProperty('body');

    await executeRequest({
      ...baseInput,
      method: 'HEAD',
      body: 'ignored',
      bodyType: 'text'
    });

    const headInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(headInit.method).toBe('HEAD');
    expect(headInit).not.toHaveProperty('body');
  });

  it('omits body when bodyType is none', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
    globalThis.fetch = fetchMock;

    await executeRequest({
      ...baseInput,
      method: 'POST',
      body: 'should-not-send',
      bodyType: 'none'
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init).not.toHaveProperty('body');
  });

  it('sends empty string body for POST with json bodyType and empty body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
    globalThis.fetch = fetchMock;

    const result = await executeRequest({
      ...baseInput,
      method: 'POST',
      body: '',
      bodyType: 'json'
    });

    expect(result.error).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });

    expect(result.request).toMatchObject({
      method: 'POST',
      body: '',
      bodyType: 'json',
      headers: { 'Content-Type': 'application/json' }
    });
  });

  it('returns status, headers, and body from fetch Response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', {
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json', 'x-test': '1' }
      })
    );
    globalThis.fetch = fetchMock;

    const result = await executeRequest({
      ...baseInput,
      method: 'POST',
      body: '{"ok":true}',
      bodyType: 'json'
    });

    expect(result.status).toBe(201);
    expect(result.statusText).toBe('Created');
    expect(result.body).toBe('{"ok":true}');
    expect(result.headers['content-type']).toBe('application/json');
    expect(result.headers['x-test']).toBe('1');
    expect(result.sizeBytes).toBe(new TextEncoder().encode('{"ok":true}').length);
    expect(result.error).toBeUndefined();
    expect(result.request).toMatchObject({
      method: 'POST',
      url: 'https://example.com',
      body: '{"ok":true}',
      bodyType: 'json',
      headers: { 'Content-Type': 'application/json' }
    });
  });

  it('returns error result when fetch rejects', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    globalThis.fetch = fetchMock;

    const result = await executeRequest(baseInput);

    expect(result).toMatchObject({
      status: 0,
      statusText: 'Error',
      body: '',
      sizeBytes: 0,
      error: 'network down'
    });
    expect(result.timeMs).toBeGreaterThanOrEqual(0);
    expect(result.request).toMatchObject({
      method: 'GET',
      url: 'https://example.com'
    });
  });

  it('sends multipart form-data with text and file parts', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'hc-multipart-'));
    const filePath = join(tempDir, 'upload.txt');
    await writeFile(filePath, 'hello file', 'utf-8');

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
    globalThis.fetch = fetchMock;

    const body = serializeFormParts([
      { key: 'name', value: 'Ada', enabled: true, type: 'text', files: [] },
      { key: 'file', value: '', enabled: true, type: 'file', files: [filePath] }
    ]);

    const result = await executeRequest({
      ...baseInput,
      method: 'POST',
      body,
      bodyType: 'multipart'
    });

    expect(result.error).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).toEqual({});

    const formData = init.body as FormData;
    expect(formData.get('name')).toBe('Ada');
    expect(formData.get('file')).toBeInstanceOf(Blob);

    expect(result.request).toMatchObject({
      method: 'POST',
      body: `name: Ada\nfile: [upload.txt]`,
      bodyType: 'multipart'
    });
  });

  it('returns an error when a multipart file cannot be read', async () => {
    const body = serializeFormParts([
      {
        key: 'file',
        value: '',
        enabled: true,
        type: 'file',
        files: ['/tmp/does-not-exist-hc-multipart.txt']
      }
    ]);

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const result = await executeRequest({
      ...baseInput,
      method: 'POST',
      body,
      bodyType: 'multipart'
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 0,
      statusText: 'Error',
      error: 'Failed to read file: /tmp/does-not-exist-hc-multipart.txt'
    });
  });

  it('sends application/x-www-form-urlencoded body from key-value rows', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
    globalThis.fetch = fetchMock;

    const body = serializeUrlEncodedParts([
      { key: 'name', value: 'Ada Lovelace', enabled: true },
      { key: 'disabled', value: 'ignored', enabled: false },
      { key: '  ', value: 'blank key', enabled: true },
      { key: 'tags', value: 'a&b=c', enabled: true }
    ]);

    const result = await executeRequest({
      ...baseInput,
      method: 'POST',
      body,
      bodyType: 'urlencoded'
    });

    expect(result.error).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('name=Ada+Lovelace&tags=a%26b%3Dc');
    expect(init.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });

    expect(result.request).toMatchObject({
      method: 'POST',
      body: 'name=Ada+Lovelace&tags=a%26b%3Dc',
      bodyType: 'urlencoded',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  });

  it('passes an undici dispatcher when verifySsl is false', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
    globalThis.fetch = fetchMock;

    await executeRequest(baseInput, { ...DEFAULT_GENERAL_SETTINGS, verifySsl: false });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { dispatcher?: unknown };
    expect(init.dispatcher).toBeDefined();
  });

  it('omits a dispatcher when verifySsl is true', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
    globalThis.fetch = fetchMock;

    await executeRequest(baseInput, { ...DEFAULT_GENERAL_SETTINGS, verifySsl: true });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { dispatcher?: unknown };
    expect(init.dispatcher).toBeUndefined();
  });

  it('selects dispatchers independently for concurrent secure and insecure requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
    globalThis.fetch = fetchMock;

    await Promise.all([
      executeRequest(
        { ...baseInput, url: 'https://secure.example.com' },
        { ...DEFAULT_GENERAL_SETTINGS, verifySsl: true }
      ),
      executeRequest(
        { ...baseInput, url: 'https://insecure.example.com' },
        { ...DEFAULT_GENERAL_SETTINGS, verifySsl: false }
      )
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secureInit = fetchMock.mock.calls.find(
      (call) => call[0] === 'https://secure.example.com'
    )?.[1] as RequestInit & { dispatcher?: unknown };
    const insecureInit = fetchMock.mock.calls.find(
      (call) => call[0] === 'https://insecure.example.com'
    )?.[1] as RequestInit & { dispatcher?: unknown };

    expect(secureInit.dispatcher).toBeUndefined();
    expect(insecureInit.dispatcher).toBeDefined();
  });
});
