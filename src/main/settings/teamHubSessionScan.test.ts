import { afterEach, describe, expect, it, vi } from 'vitest';
import { scanTeamHubSessions } from '#/main/settings/teamHubSessionScan';
import type { TeamHub } from '#/shared/types';

describe('scanTeamHubSessions', () => {
  const originalFetch = globalThis.fetch;

  const userHub: TeamHub = {
    id: 'hub-user',
    name: 'Alice',
    baseUrl: 'http://127.0.0.1:8788',
    token: 'hbk_user_token'
  };

  const adminHub: TeamHub = {
    id: 'hub-admin',
    name: 'Ops',
    baseUrl: 'http://127.0.0.1:8789',
    token: 'hbk_admin_token'
  };

  const emptyServices = {
    storage: false,
    llm: false,
    pluginCatalog: false,
    snippets: false,
    admin: false
  };

  const userServices = {
    storage: true,
    llm: true,
    pluginCatalog: true,
    snippets: true,
    admin: false
  };

  const adminServices = {
    storage: true,
    llm: true,
    pluginCatalog: true,
    snippets: true,
    admin: true
  };

  /**
   * Builds a JSON response for mocked Team Hub fetch calls.
   *
   * @param body - Response JSON payload.
   * @param status - HTTP status code.
   */
  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns service flags and management capability for each hub', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization;

      if (url.endsWith('/health')) {
        return Promise.resolve(jsonResponse({ status: 'ok', version: '1.0.0' }));
      }

      if (authorization === `Bearer ${adminHub.token}`) {
        if (url.endsWith('/auth/session')) {
          return Promise.resolve(
            jsonResponse({
              user: { id: 'user-admin', name: 'ops', role: 'admin' },
              token: { id: 'token-admin', prefix: 'hbk_admin' },
              capabilities: { dataApi: false, managementApi: true, llm: false }
            })
          );
        }

        if (url.endsWith('/admin/llm/models')) {
          return Promise.resolve(jsonResponse({ models: [] }));
        }

        if (url.endsWith('/plugins/sources')) {
          return Promise.resolve(
            jsonResponse({
              catalogs: ['https://harborclient.com/plugin_catalog.json'],
              trusted: []
            })
          );
        }

        if (url.endsWith('/snippets')) {
          return Promise.resolve(jsonResponse({ snippets: [] }));
        }
      }

      if (url.endsWith('/auth/session')) {
        return Promise.resolve(
          jsonResponse({
            user: { id: 'user-alice', name: 'alice', role: 'user' },
            token: { id: 'token-user', prefix: 'hbk_user' },
            capabilities: { dataApi: true, managementApi: false, llm: true }
          })
        );
      }

      if (url.endsWith('/llm/models')) {
        return Promise.resolve(
          jsonResponse({
            models: [{ id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' }]
          })
        );
      }

      if (url.endsWith('/plugins/sources')) {
        return Promise.resolve(
          jsonResponse({
            catalogs: ['https://harborclient.com/plugin_catalog.json'],
            trusted: ['https://harborclient.com/plugins/trusted.json']
          })
        );
      }

      if (url.endsWith('/snippets')) {
        return Promise.resolve(jsonResponse({ snippets: [] }));
      }

      return Promise.resolve(jsonResponse({ error: 'Not found' }, 404));
    });
    globalThis.fetch = fetchMock;

    const results = await scanTeamHubSessions([userHub, adminHub]);

    expect(results).toEqual([
      {
        hubId: 'hub-user',
        services: userServices,
        managementApi: false
      },
      {
        hubId: 'hub-admin',
        services: adminServices,
        managementApi: true
      }
    ]);
  });

  it('marks LLM inactive when the models route returns 503', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/health')) {
        return Promise.resolve(jsonResponse({ status: 'ok', version: '1.0.0' }));
      }

      if (url.endsWith('/auth/session')) {
        return Promise.resolve(
          jsonResponse({
            user: { id: 'user-alice', name: 'alice', role: 'user' },
            token: { id: 'token-user', prefix: 'hbk_user' },
            capabilities: { dataApi: true, managementApi: false, llm: true }
          })
        );
      }

      if (url.endsWith('/llm/models')) {
        return Promise.resolve(jsonResponse({ error: 'LLM disabled' }, 503));
      }

      if (url.endsWith('/plugins/sources')) {
        return Promise.resolve(
          jsonResponse({
            catalogs: ['https://harborclient.com/plugin_catalog.json'],
            trusted: []
          })
        );
      }

      if (url.endsWith('/snippets')) {
        return Promise.resolve(jsonResponse({ snippets: [] }));
      }

      return Promise.resolve(jsonResponse({ error: 'Not found' }, 404));
    });
    globalThis.fetch = fetchMock;

    const results = await scanTeamHubSessions([userHub]);

    expect(results).toEqual([
      {
        hubId: 'hub-user',
        services: {
          storage: true,
          admin: false,
          llm: false,
          pluginCatalog: true,
          snippets: true
        },
        managementApi: false
      }
    ]);
  });

  it('marks plugin catalog inactive when no source URLs are configured', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/health')) {
        return Promise.resolve(jsonResponse({ status: 'ok', version: '1.0.0' }));
      }

      if (url.endsWith('/auth/session')) {
        return Promise.resolve(
          jsonResponse({
            user: { id: 'user-alice', name: 'alice', role: 'user' },
            token: { id: 'token-user', prefix: 'hbk_user' },
            capabilities: { dataApi: true, managementApi: false, llm: true }
          })
        );
      }

      if (url.endsWith('/llm/models')) {
        return Promise.resolve(jsonResponse({ models: [] }));
      }

      if (url.endsWith('/plugins/sources')) {
        return Promise.resolve(jsonResponse({ catalogs: [], trusted: [] }));
      }

      if (url.endsWith('/snippets')) {
        return Promise.resolve(jsonResponse({ snippets: [] }));
      }

      return Promise.resolve(jsonResponse({ error: 'Not found' }, 404));
    });
    globalThis.fetch = fetchMock;

    const results = await scanTeamHubSessions([userHub]);

    expect(results).toEqual([
      {
        hubId: 'hub-user',
        services: {
          storage: true,
          admin: false,
          llm: true,
          pluginCatalog: false,
          snippets: true
        },
        managementApi: false
      }
    ]);
  });

  it('marks snippets inactive when the snippets route returns 404', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/health')) {
        return Promise.resolve(jsonResponse({ status: 'ok', version: '1.0.0' }));
      }

      if (url.endsWith('/auth/session')) {
        return Promise.resolve(
          jsonResponse({
            user: { id: 'user-alice', name: 'alice', role: 'user' },
            token: { id: 'token-user', prefix: 'hbk_user' },
            capabilities: { dataApi: true, managementApi: false, llm: true }
          })
        );
      }

      if (url.endsWith('/llm/models')) {
        return Promise.resolve(jsonResponse({ models: [] }));
      }

      if (url.endsWith('/plugins/sources')) {
        return Promise.resolve(jsonResponse({ catalogs: [], trusted: [] }));
      }

      if (url.endsWith('/snippets')) {
        return Promise.resolve(jsonResponse({ error: 'Not found' }, 404));
      }

      return Promise.resolve(jsonResponse({ error: 'Not found' }, 404));
    });
    globalThis.fetch = fetchMock;

    const results = await scanTeamHubSessions([userHub]);

    expect(results).toEqual([
      {
        hubId: 'hub-user',
        services: {
          storage: true,
          admin: false,
          llm: true,
          pluginCatalog: false,
          snippets: false
        },
        managementApi: false
      }
    ]);
  });

  it('returns a non-throwing error result when a hub scan fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401));
    globalThis.fetch = fetchMock;

    const results = await scanTeamHubSessions([userHub]);

    expect(results).toEqual([
      {
        hubId: 'hub-user',
        services: emptyServices,
        managementApi: false,
        error: 'Unauthorized'
      }
    ]);
  });
});
