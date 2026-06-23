import { afterEach, describe, expect, it, vi } from 'vitest';
import { HarborTeamHubClient } from '#/main/teamHub/HarborTeamHubClient';
import { TeamHubClientError } from '#/main/teamHub/TeamHubClientError';

describe('HarborTeamHubClient', () => {
  const originalFetch = globalThis.fetch;
  const baseUrl = 'http://127.0.0.1:8788';
  const token = 'hbk_test_token';

  /**
   * Creates a client instance for tests with a fixed base URL and token.
   */
  function createClient(): HarborTeamHubClient {
    return new HarborTeamHubClient({ baseUrl, token });
  }

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('checkHealth', () => {
    it('returns parsed health payload without sending Authorization', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok', version: '0.1.0' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const health = await client.checkHealth();

      expect(health).toEqual({ status: 'ok', version: '0.1.0' });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/health',
        expect.objectContaining({
          method: 'GET',
          headers: expect.not.objectContaining({
            Authorization: expect.any(String)
          })
        })
      );
    });
  });

  describe('getSession', () => {
    it('sends bearer auth and parses the session payload for a user-role token', async () => {
      const session = {
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'alice',
          role: 'user' as const
        },
        token: {
          id: '660e8400-e29b-41d4-a716-446655440001',
          prefix: 'hbk_AbCd1234'
        },
        capabilities: {
          dataApi: true,
          managementApi: false,
          llm: true
        }
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(session), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.getSession();

      expect(result).toEqual(session);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/auth/session',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          })
        })
      );
    });

    it('parses admin capabilities from the session payload', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              name: 'ops',
              role: 'admin'
            },
            token: {
              id: '660e8400-e29b-41d4-a716-446655440001',
              prefix: 'hbk_AdMn5678'
            },
            capabilities: {
              dataApi: false,
              managementApi: true,
              llm: false
            }
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.getSession();

      expect(result.capabilities).toEqual({
        dataApi: false,
        managementApi: true,
        llm: false
      });
    });

    it('throws TeamHubClientError with status 401 for unauthorized requests', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();

      await expect(client.getSession()).rejects.toMatchObject({
        name: 'TeamHubClientError',
        message: 'Unauthorized',
        status: 401,
        method: 'GET',
        path: '/auth/session'
      });
    });
  });

  describe('listAdminUsers', () => {
    it('sends bearer auth and parses the admin users list', async () => {
      const user = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'alice',
        role: 'user' as const,
        collectionAccess: ['*'],
        environmentAccess: ['*'],
        llmAccess: true,
        llmModels: ['*'],
        llmMonthlyTokenLimit: 100000,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ users: [user] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const users = await client.listAdminUsers();

      expect(users).toEqual([user]);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/users',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          })
        })
      );
    });
  });

  describe('updateAdminUser', () => {
    it('sends bearer auth and parses the updated user record', async () => {
      const user = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'alice-renamed',
        role: 'user' as const,
        collectionAccess: ['*'],
        environmentAccess: ['*'],
        llmAccess: true,
        llmModels: ['*'],
        llmMonthlyTokenLimit: 100000,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(user), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const updated = await client.updateAdminUser(user.id, { name: 'alice-renamed' });

      expect(updated).toEqual(user);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://127.0.0.1:8788/admin/users/${user.id}`,
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ name: 'alice-renamed' })
        })
      );
    });
  });

  describe('deleteAdminUser', () => {
    it('sends bearer auth and accepts 204 responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      globalThis.fetch = fetchMock;

      const client = createClient();
      await client.deleteAdminUser('550e8400-e29b-41d4-a716-446655440000');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/users/550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          })
        })
      );
    });
  });

  describe('createAdminUser', () => {
    it('sends bearer auth and parses the created user and token payload', async () => {
      const payload = {
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'alice',
          role: 'user' as const,
          collectionAccess: ['*'],
          environmentAccess: ['*'],
          llmAccess: false,
          llmModels: [],
          llmMonthlyTokenLimit: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        },
        token: {
          id: '660e8400-e29b-41d4-a716-446655440001',
          userId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'alice',
          tokenPrefix: 'hbk_AbCd1234',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastUsedAt: null,
          revokedAt: null
        },
        secret: 'hbk_secret_value'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const created = await client.createAdminUser({
        name: 'alice',
        role: 'user',
        collectionAccess: ['*'],
        environmentAccess: ['*']
      });

      expect(created).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'alice',
            role: 'user',
            collectionAccess: ['*'],
            environmentAccess: ['*']
          })
        })
      );
    });
  });

  describe('listAdminTokens', () => {
    it('sends bearer auth and parses the admin token list', async () => {
      const tokenRecord = {
        id: '660e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Desktop',
        tokenPrefix: 'hbk_AbCd1234',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastUsedAt: null,
        revokedAt: null
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ tokens: [tokenRecord] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const tokens = await client.listAdminTokens();

      expect(tokens).toEqual([tokenRecord]);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/tokens',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });

  describe('createAdminUserToken', () => {
    it('sends bearer auth and parses the created token payload', async () => {
      const payload = {
        token: {
          id: '660e8400-e29b-41d4-a716-446655440001',
          userId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Desktop',
          tokenPrefix: 'hbk_AbCd1234',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastUsedAt: null,
          revokedAt: null
        },
        secret: 'hbk_secret_value'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const created = await client.createAdminUserToken('550e8400-e29b-41d4-a716-446655440000', {
        name: 'Desktop'
      });

      expect(created).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/users/550e8400-e29b-41d4-a716-446655440000/tokens',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Desktop' })
        })
      );
    });
  });

  describe('deleteAdminToken', () => {
    it('sends bearer auth and accepts 204 responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      globalThis.fetch = fetchMock;

      const client = createClient();
      await client.deleteAdminToken('660e8400-e29b-41d4-a716-446655440001');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/tokens/660e8400-e29b-41d4-a716-446655440001',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('listAdminResourceOptions', () => {
    it('loads collections, environments, and models in parallel', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ collections: [{ id: 'c-1', name: 'Shared API' }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ environments: [{ id: 'e-1', name: 'Production' }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              models: [{ id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' }]
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const options = await client.listAdminResourceOptions();

      expect(options).toEqual({
        collections: [{ id: 'c-1', name: 'Shared API' }],
        environments: [{ id: 'e-1', name: 'Production' }],
        models: [{ id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' }]
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('treats LLM 503 responses as an empty model list', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ collections: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ environments: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ error: 'LLM support is not configured on this Team Hub.' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const options = await client.listAdminResourceOptions();

      expect(options.models).toEqual([]);
    });
  });

  describe('listCollections', () => {
    it('sends bearer auth and parses the collections list', async () => {
      const collection = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Shared API',
        variables: [],
        headers: [],
        auth: {
          type: 'none' as const,
          basic: { username: '', password: '' },
          bearer: { token: '' }
        },
        preRequestScript: '',
        postRequestScript: '',
        createdAt: '2026-01-01T00:00:00.000Z'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ collections: [collection] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const collections = await client.listCollections();

      expect(collections).toEqual([collection]);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/collections',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          })
        })
      );
    });
  });

  describe('listLlmModels', () => {
    it('parses hub LLM model listings', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            models: [{ id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' }]
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const models = await client.listLlmModels();

      expect(models).toEqual([{ id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' }]);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/llm/models',
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('completeChatStep', () => {
    it('posts chat step payloads to the hub LLM proxy route', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            content: 'Done',
            usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 }
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.completeChatStep({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
        systemPrompt: 'System',
        tools: []
      });

      expect(result.content).toBe('Done');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/llm/chat/step',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'Hi' }],
            systemPrompt: 'System',
            tools: []
          })
        })
      );
    });
  });

  describe('deleteCollection', () => {
    it('resolves without a body for 204 responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      globalThis.fetch = fetchMock;

      const client = createClient();
      await expect(
        client.deleteCollection('550e8400-e29b-41d4-a716-446655440000')
      ).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it.each([
      [400, 'Validation failed'],
      [401, 'Unauthorized'],
      [403, 'Forbidden'],
      [404, 'Not found']
    ] as const)(
      'throws TeamHubClientError with status %i and server message',
      async (status, message) => {
        const fetchMock = vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: message }), {
            status,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        globalThis.fetch = fetchMock;

        const client = createClient();

        await expect(client.listCollections()).rejects.toMatchObject({
          name: 'TeamHubClientError',
          message,
          status,
          method: 'GET',
          path: '/collections'
        });
        await expect(client.listCollections()).rejects.toBeInstanceOf(TeamHubClientError);
      }
    );

    it('throws TeamHubClientError with status 0 on network failure', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Connection refused'));
      globalThis.fetch = fetchMock;

      const client = createClient();

      await expect(client.listCollections()).rejects.toMatchObject({
        name: 'TeamHubClientError',
        message: 'Connection refused',
        status: 0,
        method: 'GET',
        path: '/collections'
      });
    });
  });
});
