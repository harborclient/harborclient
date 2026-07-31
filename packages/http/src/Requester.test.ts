import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SendRequestInput } from './types.js';
import { DEFAULT_REQUEST_SETTINGS } from './settings.js';
import { MAX_REDIRECTS, Requester } from './Requester.js';

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

    it('captures timing phases from a real HTTP request', async () => {
      const server = createServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('ok');
      });

      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
      });

      try {
        const address = server.address() as AddressInfo;
        const result = await requester.executeRequest({
          ...baseInput,
          url: `http://127.0.0.1:${address.port}/timing`
        });

        expect(result.error).toBeUndefined();
        expect(result.body).toBe('ok');
        expect(result.timing).toBeDefined();
        expect(result.timing?.stalledMs).toBeGreaterThanOrEqual(0);
        expect(result.timing?.waitingMs).toBeGreaterThanOrEqual(0);
        expect(result.timing?.downloadMs).toBeGreaterThanOrEqual(0);
        if (result.timing?.connectMs != null) {
          expect(result.timing.connectMs).toBeGreaterThanOrEqual(0);
        }
        if (result.timing?.requestSentMs != null) {
          expect(result.timing.requestSentMs).toBeGreaterThanOrEqual(0);
        }
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }
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

    it('unwraps undici fetch failed causes into a clearer error', async () => {
      const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5009'), {
        code: 'ECONNREFUSED'
      });
      const fetchError = new TypeError('fetch failed');
      fetchError.cause = cause;
      const fetchMock = vi.fn().mockRejectedValue(fetchError);
      globalThis.fetch = fetchMock;

      const result = await requester.executeRequest(baseInput);

      expect(result.error).toBe('Connection refused (127.0.0.1:5009)');
    });

    it('passes an undici dispatcher when verifySsl is false', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
      globalThis.fetch = fetchMock;

      await requester.executeRequest(baseInput, { ...DEFAULT_REQUEST_SETTINGS, verifySsl: false });

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { dispatcher?: unknown };
      expect(init.dispatcher).toBeDefined();
    });

    it('omits a dispatcher when verifySsl is true', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
      globalThis.fetch = fetchMock;

      await requester.executeRequest(baseInput, { ...DEFAULT_REQUEST_SETTINGS, verifySsl: true });

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { dispatcher?: unknown };
      expect(init.dispatcher).toBeUndefined();
    });

    it('uses manual redirect mode when followRedirects is true', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
      globalThis.fetch = fetchMock;

      await requester.executeRequest(baseInput, {
        ...DEFAULT_REQUEST_SETTINGS,
        followRedirects: true
      });

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(init.redirect).toBe('manual');
    });

    it('uses manual redirect mode when followRedirects is false', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('ok', { status: 302, statusText: 'Found' }));
      globalThis.fetch = fetchMock;

      await requester.executeRequest(baseInput, {
        ...DEFAULT_REQUEST_SETTINGS,
        followRedirects: false
      });

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(init.redirect).toBe('manual');
    });

    it('follows one redirect and records the hop chain', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            statusText: 'Found',
            headers: { Location: 'https://example.com/final' }
          })
        )
        .mockResolvedValueOnce(new Response('ok', { status: 200, statusText: 'OK' }));
      globalThis.fetch = fetchMock;

      const result = await requester.executeRequest(baseInput, {
        ...DEFAULT_REQUEST_SETTINGS,
        followRedirects: true
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(200);
      expect(result.redirects).toEqual([
        {
          status: 302,
          statusText: 'Found',
          url: 'https://example.com',
          location: 'https://example.com/final',
          method: 'GET'
        }
      ]);
    });

    it('resolves relative Location headers against the current URL', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            statusText: 'Found',
            headers: { Location: '/final' }
          })
        )
        .mockResolvedValueOnce(new Response('ok', { status: 200, statusText: 'OK' }));
      globalThis.fetch = fetchMock;

      const result = await requester.executeRequest(baseInput, {
        ...DEFAULT_REQUEST_SETTINGS,
        followRedirects: true
      });

      expect(result.redirects?.[0]?.location).toBe('https://example.com/final');
      expect(fetchMock.mock.calls[1]?.[0]).toBe('https://example.com/final');
    });

    it('converts POST with 302 to GET on the next hop', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            statusText: 'Found',
            headers: { Location: 'https://example.com/final' }
          })
        )
        .mockResolvedValueOnce(new Response('ok', { status: 200, statusText: 'OK' }));
      globalThis.fetch = fetchMock;

      await requester.executeRequest(
        {
          ...baseInput,
          method: 'POST',
          body: '{"ok":true}',
          bodyType: 'json'
        },
        { ...DEFAULT_REQUEST_SETTINGS, followRedirects: true }
      );

      const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
      expect(secondInit.method).toBe('GET');
      expect(secondInit.body).toBeUndefined();
    });

    it('strips authorization on cross-origin redirect hops', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            statusText: 'Found',
            headers: { Location: 'https://other.example.com/path' }
          })
        )
        .mockResolvedValueOnce(new Response('ok', { status: 200, statusText: 'OK' }));
      globalThis.fetch = fetchMock;

      await requester.executeRequest(
        {
          ...baseInput,
          headers: [{ key: 'Authorization', value: 'Bearer secret', enabled: true }]
        },
        { ...DEFAULT_REQUEST_SETTINGS, followRedirects: true }
      );

      const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
      const secondHeaders = secondInit.headers as Record<string, string>;
      expect(secondHeaders.Authorization).toBeUndefined();
    });

    it('returns too many redirects when the hop limit is exceeded', async () => {
      const fetchMock = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(null, {
            status: 302,
            statusText: 'Found',
            headers: { Location: 'https://example.com/next' }
          })
        )
      );
      globalThis.fetch = fetchMock;

      const result = await requester.executeRequest(baseInput, {
        ...DEFAULT_REQUEST_SETTINGS,
        followRedirects: true
      });

      expect(result.error).toBe('Too many redirects');
      expect(fetchMock).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
    });

    it('returns a redirect response without following when followRedirects is false', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(null, {
          status: 302,
          statusText: 'Found',
          headers: { Location: 'https://example.com/final' }
        })
      );
      globalThis.fetch = fetchMock;

      const result = await requester.executeRequest(baseInput, {
        ...DEFAULT_REQUEST_SETTINGS,
        followRedirects: false
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(302);
      expect(result.redirects).toBeUndefined();
    });

    it('selects dispatchers independently for concurrent secure and insecure requests', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
      globalThis.fetch = fetchMock;

      await Promise.all([
        requester.executeRequest(
          { ...baseInput, url: 'https://secure.example.com' },
          { ...DEFAULT_REQUEST_SETTINGS, verifySsl: true }
        ),
        requester.executeRequest(
          { ...baseInput, url: 'https://insecure.example.com' },
          { ...DEFAULT_REQUEST_SETTINGS, verifySsl: false }
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

    it('passes a proxy dispatcher when proxy is enabled with a host', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
      globalThis.fetch = fetchMock;

      await requester.executeRequest(baseInput, {
        ...DEFAULT_REQUEST_SETTINGS,
        proxy: {
          ...DEFAULT_REQUEST_SETTINGS.proxy,
          enabled: true,
          host: 'proxy.example.com',
          port: 8080
        }
      });

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { dispatcher?: unknown };
      expect(init.dispatcher).toBeDefined();
    });

    it('omits a proxy dispatcher when proxy is disabled', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('ok', { status: 200, statusText: 'OK' }));
      globalThis.fetch = fetchMock;

      await requester.executeRequest(baseInput, {
        ...DEFAULT_REQUEST_SETTINGS,
        proxy: {
          ...DEFAULT_REQUEST_SETTINGS.proxy,
          enabled: false,
          host: 'proxy.example.com'
        }
      });

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { dispatcher?: unknown };
      expect(init.dispatcher).toBeUndefined();
    });
  });
});
