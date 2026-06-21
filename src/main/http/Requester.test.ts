import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SendRequestInput } from '#/shared/types';
import { DEFAULT_GENERAL_SETTINGS } from '#/main/settings/generalSettings';
import { Requester } from '#/main/http/Requester';

describe('Requester', () => {
  const requester = new Requester();
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

  describe('executeRequest', () => {
    it('returns URL required error for blank URL', async () => {
      const result = await requester.executeRequest({ ...baseInput, url: '   ' });

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

      const result = await requester.executeRequest({
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

    it('returns header validation error for forbidden hop-by-hop headers without calling fetch', async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      const result = await requester.executeRequest({
        ...baseInput,
        headers: [{ key: 'Connection', value: 'close', enabled: true }]
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        status: 0,
        statusText: 'Error',
        error: 'Forbidden header: Connection'
      });
    });

    it('returns header validation error for CRLF in header values without calling fetch', async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      const result = await requester.executeRequest({
        ...baseInput,
        headers: [{ key: 'X-Test', value: 'ok\r\nX-Injected: evil', enabled: true }]
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        status: 0,
        statusText: 'Error',
        error: 'Invalid header value for "X-Test": control characters are not allowed'
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

      await requester.executeRequest({
        ...baseInput,
        method: 'GET',
        body: '{"ignored":true}',
        bodyType: 'json'
      });

      const getInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(getInit.method).toBe('GET');
      expect(getInit).not.toHaveProperty('body');

      await requester.executeRequest({
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

      await requester.executeRequest({
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

      const result = await requester.executeRequest({
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

      const result = await requester.executeRequest({
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

      const result = await requester.executeRequest(baseInput);

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

    it('passes an undici dispatcher when verifySsl is false', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
      globalThis.fetch = fetchMock;

      await requester.executeRequest(baseInput, { ...DEFAULT_GENERAL_SETTINGS, verifySsl: false });

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { dispatcher?: unknown };
      expect(init.dispatcher).toBeDefined();
    });

    it('omits a dispatcher when verifySsl is true', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
      globalThis.fetch = fetchMock;

      await requester.executeRequest(baseInput, { ...DEFAULT_GENERAL_SETTINGS, verifySsl: true });

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { dispatcher?: unknown };
      expect(init.dispatcher).toBeUndefined();
    });

    it('selects dispatchers independently for concurrent secure and insecure requests', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
      globalThis.fetch = fetchMock;

      await Promise.all([
        requester.executeRequest(
          { ...baseInput, url: 'https://secure.example.com' },
          { ...DEFAULT_GENERAL_SETTINGS, verifySsl: true }
        ),
        requester.executeRequest(
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
});
