import { describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '../auth';
import { DEFAULT_GENERAL_SETTINGS } from '../generalSettings';
import type { ICookieJar, IScriptRunner } from '../interfaces';
import type { ScriptRequestContext, ScriptRunResult, SendResult } from '../types';
import { DEFAULT_USER_AGENT } from '../userAgent';
import { runRequest } from './RequestRunner';

/**
 * Builds a minimal successful ScriptRunResult for runner tests.
 *
 * @param request - Request context echoed back from the sandbox.
 * @param overrides - Partial fields (skipRequest, responseOverride, etc.).
 * @returns Complete ScriptRunResult.
 */
function scriptResult(
  request: ScriptRequestContext,
  overrides: Partial<ScriptRunResult> = {}
): ScriptRunResult {
  return {
    request,
    variableSets: {},
    variableClears: [],
    collectionVariableSets: {},
    collectionVariableClears: [],
    folderVariableSets: {},
    folderVariableClears: [],
    environmentVariableSets: {},
    environmentVariableClears: [],
    globalVariableSets: {},
    globalVariableClears: [],
    cookieSets: {},
    cookieClears: [],
    collectionHeaders: [],
    folderHeaders: [],
    tests: [],
    logs: [],
    executionEvents: [],
    data: {},
    ...overrides
  };
}

/**
 * Creates a script runner that returns canned results per phase.
 *
 * @param byPhase - Factory for each script phase.
 * @returns IScriptRunner double.
 */
function createScriptRunner(
  byPhase: (phase: 'pre' | 'post', request: ScriptRequestContext) => ScriptRunResult
): IScriptRunner {
  return {
    run: async (input) => byPhase(input.phase, input.request),
    dispose: () => undefined
  };
}

/**
 * Minimal successful HTTP SendResult for transport doubles.
 *
 * @returns 200 OK SendResult.
 */
function okTransportResult(): SendResult {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'text/plain' },
    body: 'from-server',
    timeMs: 12,
    sizeBytes: 11
  };
}

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
            {
              key: 'host',
              value: 'api.example.test',
              defaultValue: '',
              enabled: true,
              share: false
            },
            { key: 'path', value: 'users', defaultValue: '', enabled: true, share: false },
            { key: 'token', value: 'secret', defaultValue: '', enabled: true, share: false }
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

  it('injects the global User-Agent when no scoped override or header exists', async () => {
    const transport = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '',
      timeMs: 1,
      sizeBytes: 0
    }));

    await runRequest(
      { request: createRequest('https://example.test') },
      {
        settings: { ...DEFAULT_GENERAL_SETTINGS, userAgent: DEFAULT_USER_AGENT },
        cookieJar: createCookieJar(),
        transport
      }
    );

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: [{ key: 'User-Agent', value: DEFAULT_USER_AGENT, enabled: true }]
      }),
      undefined
    );
  });

  it('prefers request User-Agent over folder, collection, and general', async () => {
    const transport = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '',
      timeMs: 1,
      sizeBytes: 0
    }));
    const request = createRequest('https://example.test');
    request.userAgent = 'Request/1';

    await runRequest(
      {
        request,
        folder: {
          id: 1,
          name: 'Folder',
          variables: [],
          headers: [],
          userAgent: 'Folder/1',
          auth: defaultAuth(),
          pre_request_script: '',
          post_request_script: ''
        },
        collection: {
          id: 1,
          name: 'Collection',
          variables: [],
          headers: [],
          userAgent: 'Collection/1',
          auth: defaultAuth(),
          pre_request_script: '',
          post_request_script: ''
        }
      },
      {
        settings: { ...DEFAULT_GENERAL_SETTINGS, userAgent: DEFAULT_USER_AGENT },
        cookieJar: createCookieJar(),
        transport
      }
    );

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: [{ key: 'User-Agent', value: 'Request/1', enabled: true }]
      }),
      undefined
    );
  });

  it('skips User-Agent injection when a key/value header is set', async () => {
    const transport = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '',
      timeMs: 1,
      sizeBytes: 0
    }));
    const request = createRequest('https://example.test');
    request.userAgent = 'Request/1';
    request.headers = [{ key: 'User-Agent', value: 'Manual/1', enabled: true }];

    await runRequest(
      { request },
      {
        settings: { ...DEFAULT_GENERAL_SETTINGS, userAgent: DEFAULT_USER_AGENT },
        cookieJar: createCookieJar(),
        transport
      }
    );

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: [{ key: 'User-Agent', value: 'Manual/1', enabled: true }]
      }),
      undefined
    );
  });

  it('applies a pre-request responseOverride when skipRequest is also set', async () => {
    const transport = vi.fn(async () => okTransportResult());
    const override = {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'content-type': 'application/json' },
      body: '{"error":"Something happened."}'
    };

    const result = await runRequest(
      {
        request: createRequest('https://example.test'),
        scripts: [{ phase: 'pre', source: '// mock', label: 'Pre' }]
      },
      {
        settings: {} as never,
        cookieJar: createCookieJar(),
        transport,
        scriptRunner: createScriptRunner((phase, request) =>
          phase === 'pre'
            ? scriptResult(request, { skipRequest: true, responseOverride: override })
            : scriptResult(request)
        )
      }
    );

    expect(transport).not.toHaveBeenCalled();
    expect(result.scriptSkipRequest).toBe(true);
    expect(result.response.status).toBe(400);
    expect(result.response.body).toBe('{"error":"Something happened."}');
    expect(result.response.error).toBeUndefined();
  });

  it('sends HTTP then replaces the response with a pre-request override', async () => {
    const transport = vi.fn(async () => okTransportResult());
    const afterSend = vi.fn(async () => undefined);
    const override = {
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}'
    };

    const result = await runRequest(
      {
        request: createRequest('https://example.test'),
        scripts: [
          { phase: 'pre', source: '// mock', label: 'Pre' },
          { phase: 'post', source: '// post', label: 'Post' }
        ]
      },
      {
        settings: {} as never,
        cookieJar: createCookieJar(),
        transport,
        pluginHooks: { afterSend },
        scriptRunner: createScriptRunner((phase, request) =>
          phase === 'pre'
            ? scriptResult(request, { responseOverride: override })
            : scriptResult(request)
        )
      }
    );

    expect(transport).toHaveBeenCalledOnce();
    expect(afterSend).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: 'from-server', status: 200 })
    );
    expect(result.response.status).toBe(201);
    expect(result.response.body).toBe('{"ok":true}');
  });

  it('applies a post-request responseOverride after post scripts see the real response', async () => {
    const transport = vi.fn(async () => okTransportResult());
    let postSawBody: string | undefined;
    const override = {
      status: 418,
      statusText: '',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: 'overridden'
    };

    const result = await runRequest(
      {
        request: createRequest('https://example.test'),
        scripts: [{ phase: 'post', source: '// post', label: 'Post' }]
      },
      {
        settings: {} as never,
        cookieJar: createCookieJar(),
        transport,
        scriptRunner: {
          run: async (input) => {
            if (input.phase === 'post') {
              postSawBody = input.response?.body;
              return scriptResult(input.request, { responseOverride: override });
            }
            return scriptResult(input.request);
          },
          dispose: () => undefined
        }
      }
    );

    expect(postSawBody).toBe('from-server');
    expect(result.response.status).toBe(418);
    expect(result.response.body).toBe('overridden');
  });
});
