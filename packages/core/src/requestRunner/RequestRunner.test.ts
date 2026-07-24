import { describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '../auth';
import type { ICookieJar } from '../interfaces';
import type { ScriptRequestContext } from '../types';
import { runRequest } from './RequestRunner';

/**
 * Creates the minimal cookie adapter needed by request-runner tests.
 *
 * @returns In-memory cookie adapter with no cookies.
 */
function createCookieJar(): ICookieJar {
  return {
    getCookiesForDomain: vi.fn(() => []),
    listDomains: vi.fn(() => []),
    setCookiesForDomain: vi.fn(),
    buildCookieHeader: vi.fn(() => null),
    captureSetCookies: vi.fn()
  };
}

/**
 * Creates a standard request context for runner tests.
 *
 * @param url - URL to send.
 * @returns Mutable script request context.
 */
function createRequest(url: string): ScriptRequestContext {
  return {
    method: 'GET',
    url,
    headers: [],
    params: [],
    body: '',
    bodyType: 'none',
    auth: defaultAuth()
  };
}

describe('RequestRunner', () => {
  it('sends a happy-path GET through injected transport', async () => {
    const transport = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: 'done',
      timeMs: 12,
      sizeBytes: 4
    }));

    const result = await runRequest(
      { request: createRequest('https://example.test/health') },
      { settings: {} as never, cookieJar: createCookieJar(), transport }
    );

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', url: 'https://example.test/health' }),
      undefined
    );
    expect(result.response.status).toBe(200);
    expect(result.sendInput?.url).toBe('https://example.test/health');
  });

  it('substitutes environment variables in URL, headers, params, and body', async () => {
    const transport = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '',
      timeMs: 1,
      sizeBytes: 0
    }));
    const request = createRequest('https://{{host}}/{{path}}');
    request.headers = [{ key: 'X-Token', value: '{{token}}', enabled: true }];
    request.params = [{ key: 'q', value: '{{path}}', enabled: true }];
    request.body = '{"token":"{{token}}"}';

    await runRequest(
      {
        request,
        environment: {
          variables: [
            { key: 'host', value: 'api.example.test', defaultValue: '', share: false },
            { key: 'path', value: 'users', defaultValue: '', share: false },
            { key: 'token', value: 'secret', defaultValue: '', share: false }
          ]
        }
      },
      { settings: {} as never, cookieJar: createCookieJar(), transport }
    );

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.test/users',
        headers: [{ key: 'X-Token', value: 'secret', enabled: true }],
        params: [{ key: 'q', value: 'users', enabled: true }],
        body: '{"token":"secret"}'
      }),
      undefined
    );
  });
});
