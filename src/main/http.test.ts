import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SendRequestInput } from '#/shared/types';
import { buildHeaders, buildUrl, executeRequest } from '#/main/http';

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

  it('maps successful fetch responses', async () => {
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
      headers: { 'Content-Type': 'application/json' }
    });
  });

  it('maps fetch failures to error results', async () => {
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
});
