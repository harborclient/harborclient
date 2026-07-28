import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamHubClient } from './TeamHubClient.js';
import { TeamHubClientError } from './TeamHubClientError.js';

describe('TeamHubClient', () => {
  const originalFetch = globalThis.fetch;
  const baseUrl = 'http://127.0.0.1:8788';
  const token = 'hbk_test_token';

  /**
   * Creates a client instance for tests with a fixed base URL and token.
   */
  function createClient(): TeamHubClient {
    return new TeamHubClient({ baseUrl, token });
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
        snippetAccess: ['*'],
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
        snippetAccess: ['*'],
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
          snippetAccess: ['*'],
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
        environmentAccess: ['*'],
        snippetAccess: ['*']
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
            environmentAccess: ['*'],
            snippetAccess: ['*']
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

  describe('createAdminInvitedUser', () => {
    it('sends bearer auth and parses the created user and invitation payload', async () => {
      const payload = {
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'alice',
          role: 'user' as const,
          collectionAccess: ['*'],
          environmentAccess: ['*'],
          snippetAccess: ['*'],
          llmAccess: false,
          llmModels: [],
          llmMonthlyTokenLimit: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        },
        invitation: {
          id: '770e8400-e29b-41d4-a716-446655440003',
          userId: '550e8400-e29b-41d4-a716-446655440000',
          codePrefix: 'hbi_AbCd',
          expiresAt: '2026-01-08T00:00:00.000Z',
          redeemedAt: null,
          revokedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          status: 'pending' as const
        },
        secret: 'hbi_secret_value'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const created = await client.createAdminInvitedUser({
        name: 'alice',
        role: 'user',
        collectionAccess: ['*'],
        environmentAccess: ['*'],
        snippetAccess: ['*'],
        expiresInHours: 168
      });

      expect(created).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/invited-users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'alice',
            role: 'user',
            collectionAccess: ['*'],
            environmentAccess: ['*'],
            snippetAccess: ['*'],
            expiresInHours: 168
          })
        })
      );
    });
  });

  describe('createAdminUserInvitation', () => {
    it('sends bearer auth and parses a replacement invitation payload', async () => {
      const payload = {
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'alice',
          role: 'user' as const,
          collectionAccess: ['*'],
          environmentAccess: ['*'],
          snippetAccess: ['*'],
          llmAccess: false,
          llmModels: [],
          llmMonthlyTokenLimit: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        },
        invitation: {
          id: '880e8400-e29b-41d4-a716-446655440004',
          userId: '550e8400-e29b-41d4-a716-446655440000',
          codePrefix: 'hbi_EfGh',
          expiresAt: '2026-01-15T00:00:00.000Z',
          redeemedAt: null,
          revokedAt: null,
          createdAt: '2026-01-02T00:00:00.000Z',
          status: 'pending' as const
        },
        secret: 'hbi_reissue_secret'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const created = await client.createAdminUserInvitation(
        '550e8400-e29b-41d4-a716-446655440000',
        { expiresInHours: 72 }
      );

      expect(created).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/users/550e8400-e29b-41d4-a716-446655440000/invitations',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ expiresInHours: 72 })
        })
      );
    });
  });

  describe('listAdminInvitations', () => {
    it('sends bearer auth and parses the admin invitation list', async () => {
      const invitation = {
        id: '770e8400-e29b-41d4-a716-446655440003',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        codePrefix: 'hbi_AbCd',
        expiresAt: '2026-01-08T00:00:00.000Z',
        redeemedAt: null,
        revokedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        status: 'pending' as const
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ invitations: [invitation] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const invitations = await client.listAdminInvitations();

      expect(invitations).toEqual([invitation]);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/invitations',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });

  describe('revokeAdminInvitation', () => {
    it('sends bearer auth and accepts 204 responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      globalThis.fetch = fetchMock;

      const client = createClient();
      await client.revokeAdminInvitation('770e8400-e29b-41d4-a716-446655440003');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/invitations/770e8400-e29b-41d4-a716-446655440003',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('previewInvitation', () => {
    it('posts the invitation secret without bearer auth', async () => {
      const payload = {
        user: {
          name: 'alice',
          role: 'user' as const,
          collectionAccess: ['*'],
          environmentAccess: ['*'],
          snippetAccess: ['*'],
          llmAccess: false,
          llmModels: []
        },
        expiresAt: '2026-01-08T00:00:00.000Z'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = new TeamHubClient({ baseUrl });
      const preview = await client.previewInvitation({ secret: 'hbi_secret_value' });

      expect(preview).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/auth/invitations/preview',
        expect.objectContaining({
          method: 'POST',
          headers: expect.not.objectContaining({
            Authorization: expect.any(String)
          }),
          body: JSON.stringify({ secret: 'hbi_secret_value' })
        })
      );
    });
  });

  describe('redeemInvitation', () => {
    it('posts the invitation secret and optional token name without bearer auth', async () => {
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

      const client = new TeamHubClient({ baseUrl });
      const redeemed = await client.redeemInvitation({
        secret: 'hbi_secret_value',
        tokenName: 'Desktop'
      });

      expect(redeemed).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/auth/invitations/redeem',
        expect.objectContaining({
          method: 'POST',
          headers: expect.not.objectContaining({
            Authorization: expect.any(String)
          }),
          body: JSON.stringify({ secret: 'hbi_secret_value', tokenName: 'Desktop' })
        })
      );
    });
  });

  describe('authenticated requests without a token', () => {
    it('throws TeamHubClientError before calling fetch', async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      const client = new TeamHubClient({ baseUrl });

      await expect(client.getSession()).rejects.toMatchObject({
        name: 'TeamHubClientError',
        message: 'Bearer token is required for authenticated requests',
        status: 0,
        method: 'GET',
        path: '/auth/session'
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('reloadConfig', () => {
    it('sends bearer auth and parses a successful reload report', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            sections: [
              { section: 'db', status: 'unchanged' },
              { section: 'redis', status: 'unchanged' },
              { section: 'llm', status: 'reloaded' },
              { section: 'plugins', status: 'reloaded' },
              { section: 'server', status: 'unchanged' }
            ]
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.reloadConfig();

      expect(result.sections).toHaveLength(5);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/config/reload',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer hbk_test_token'
          })
        })
      );
    });

    it('returns fatal reload errors from 400 responses without throwing', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            sections: [],
            fatalError: 'Config file not found: /missing/server.yaml'
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.reloadConfig();

      expect(result).toEqual({
        sections: [],
        fatalError: 'Config file not found: /missing/server.yaml'
      });
    });

    it('throws for forbidden responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      await expect(client.reloadConfig()).rejects.toBeInstanceOf(TeamHubClientError);
    });
  });

  describe('listAdminResourceOptions', () => {
    it('loads collections, environments, and models in parallel', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              collections: [{ id: 'c-1', name: 'Shared API', deletionLocked: false }]
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              environments: [{ id: 'e-1', name: 'Production', deletionLocked: false }]
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              models: [{ id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' }],
              capabilities: { openai: true }
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
        collections: [{ id: 'c-1', name: 'Shared API', deletionLocked: false }],
        environments: [{ id: 'e-1', name: 'Production', deletionLocked: false }],
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
    it('sends bearer auth and parses the full collections list', async () => {
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
        createdAt: '2026-01-01T00:00:00.000Z',
        deletionLocked: false
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

  describe('listEnvironments', () => {
    it('sends bearer auth and parses the full environments list', async () => {
      const environment = {
        id: '660e8400-e29b-41d4-a716-446655440002',
        name: 'Production',
        variables: [
          {
            key: 'host',
            value: 'https://api.example.com',
            defaultValue: '',
            enabled: true,
            share: true
          }
        ],
        createdAt: '2026-01-02T00:00:00.000Z',
        deletionLocked: false
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ environments: [environment] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const environments = await client.listEnvironments();

      expect(environments).toEqual([{ ...environment, parentUuid: null }]);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/environments',
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

  describe('createSnippet', () => {
    it('sends name, code, and scope in the POST body', async () => {
      const snippet = {
        id: '770e8400-e29b-41d4-a716-446655440003',
        name: 'Auth helper',
        code: 'console.log("hello");',
        scope: 'pre-request' as const,
        createdAt: '2026-01-02T00:00:00.000Z',
        deletionLocked: false
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(snippet), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const created = await client.createSnippet({
        name: 'Auth helper',
        code: 'console.log("hello");',
        scope: 'pre-request'
      });

      expect(created).toEqual(snippet);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/snippets',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Auth helper',
            code: 'console.log("hello");',
            scope: 'pre-request'
          })
        })
      );
    });
  });

  describe('listSnippets', () => {
    it('sends bearer auth and parses the full snippets list', async () => {
      const snippet = {
        id: '770e8400-e29b-41d4-a716-446655440003',
        name: 'Auth helper',
        code: 'console.log("hello");',
        scope: 'pre-request' as const,
        createdAt: '2026-01-02T00:00:00.000Z',
        deletionLocked: false
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ snippets: [snippet] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const snippets = await client.listSnippets();

      expect(snippets).toEqual([snippet]);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/snippets',
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

  describe('probeSnippetsServiceEnabled', () => {
    it('returns true when GET /snippets succeeds', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ snippets: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      await expect(client.probeSnippetsServiceEnabled()).resolves.toBe(true);
    });

    it('returns false when GET /snippets returns 404', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      await expect(client.probeSnippetsServiceEnabled()).resolves.toBe(false);
    });
  });

  describe('createCollection', () => {
    it('parses Team Hub create responses without oauth2 auth', async () => {
      const collection = {
        id: '660e8400-e29b-41d4-a716-446655440001',
        name: 'Moved API',
        variables: [],
        headers: [],
        auth: {
          type: 'none' as const,
          basic: { username: '', password: '' },
          bearer: { token: '' }
        },
        preRequestScript: '',
        postRequestScript: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
        deletionLocked: false
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(collection), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const created = await client.createCollection({ name: 'Moved API' });

      expect(created).toEqual({
        id: collection.id,
        name: collection.name,
        variables: collection.variables,
        headers: collection.headers,
        auth: collection.auth,
        preRequestScript: collection.preRequestScript,
        postRequestScript: collection.postRequestScript,
        createdAt: collection.createdAt,
        deletionLocked: collection.deletionLocked
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/collections',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Moved API' })
        })
      );
    });
  });

  describe('listLlmModels', () => {
    it('parses hub LLM model listings', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            models: [{ id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' }],
            capabilities: { openai: true }
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.listLlmModels();

      expect(result).toEqual({
        models: [{ id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' }],
        capabilities: { openai: true }
      });
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

  describe('listAdminCollectionFolders', () => {
    it('fetches folders for operator inspection', async () => {
      const collectionId = '550e8400-e29b-41d4-a716-446655440000';
      const folder = {
        id: '660e8400-e29b-41d4-a716-446655440001',
        collectionId,
        parentFolderId: null,
        name: 'Auth',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ folders: [folder] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const folders = await client.listAdminCollectionFolders(collectionId);

      expect(folders).toEqual([
        expect.objectContaining({
          id: folder.id,
          name: folder.name,
          sortOrder: folder.sortOrder,
          collectionId: folder.collectionId
        })
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://127.0.0.1:8788/admin/collections/${collectionId}/folders`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`
          })
        })
      );
    });
  });

  describe('listFolders', () => {
    it('defaults parentFolderId to null for hub servers that omit it', async () => {
      const collectionId = '550e8400-e29b-41d4-a716-446655440000';
      const folder = {
        id: '660e8400-e29b-41d4-a716-446655440001',
        collectionId,
        name: 'Auth',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ folders: [folder] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();

      await expect(client.listFolders(collectionId)).resolves.toEqual([
        expect.objectContaining({ id: folder.id, parentFolderId: null })
      ]);
    });
  });

  describe('moveFolder', () => {
    it('moves a folder to a nested parent and returns the updated record', async () => {
      const folderId = '660e8400-e29b-41d4-a716-446655440001';
      const parentFolderId = '770e8400-e29b-41d4-a716-446655440002';
      const folder = {
        id: folderId,
        collectionId: '550e8400-e29b-41d4-a716-446655440000',
        parentFolderId,
        name: 'Auth',
        sortOrder: 1,
        createdAt: '2026-01-01T00:00:00.000Z'
      };
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(folder), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      await expect(client.moveFolder(folderId, { parentFolderId, sortOrder: 1 })).resolves.toEqual(
        folder
      );
      expect(fetchMock).toHaveBeenCalledWith(
        `http://127.0.0.1:8788/folders/${folderId}/move`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ parentFolderId, sortOrder: 1 })
        })
      );
    });
  });

  describe('listAdminCollectionRequests', () => {
    it('fetches requests for operator inspection', async () => {
      const collectionId = '550e8400-e29b-41d4-a716-446655440000';
      const savedRequest = {
        id: '770e8400-e29b-41d4-a716-446655440002',
        collectionId,
        name: 'Get health',
        method: 'GET',
        url: '/health',
        headers: [],
        params: [],
        auth: { type: 'none', basic: { username: '', password: '' }, bearer: { token: '' } },
        body: '',
        bodyType: 'none',
        preRequestScript: '',
        postRequestScript: '',
        comment: '',
        folderId: null,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ requests: [savedRequest] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const requests = await client.listAdminCollectionRequests(collectionId);

      expect(requests).toEqual([
        expect.objectContaining({
          id: savedRequest.id,
          name: savedRequest.name,
          method: savedRequest.method,
          url: savedRequest.url
        })
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://127.0.0.1:8788/admin/collections/${collectionId}/requests`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`
          })
        })
      );
    });
  });

  describe('deleteAdminCollection', () => {
    it('resolves without a body for 204 responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      globalThis.fetch = fetchMock;

      const client = createClient();
      await expect(
        client.deleteAdminCollection('550e8400-e29b-41d4-a716-446655440000')
      ).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/collections/550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`
          })
        })
      );
    });
  });

  describe('deleteAdminEnvironment', () => {
    it('resolves without a body for 204 responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      globalThis.fetch = fetchMock;

      const client = createClient();
      await expect(
        client.deleteAdminEnvironment('660e8400-e29b-41d4-a716-446655440002')
      ).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/environments/660e8400-e29b-41d4-a716-446655440002',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`
          })
        })
      );
    });
  });

  describe('deleteAdminRequest', () => {
    it('resolves without a body for 204 responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      globalThis.fetch = fetchMock;

      const client = createClient();
      await expect(
        client.deleteAdminRequest('770e8400-e29b-41d4-a716-446655440002')
      ).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/requests/770e8400-e29b-41d4-a716-446655440002',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`
          })
        })
      );
    });
  });

  describe('updateAdminCollectionDeletionLocked', () => {
    it('sends the lock flag and parses the updated config', async () => {
      const config = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Shared API',
        deletionLocked: true
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(config), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.updateAdminCollectionDeletionLocked(config.id, true);

      expect(result).toEqual(config);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://127.0.0.1:8788/admin/collections/${config.id}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ deletionLocked: true })
        })
      );
    });
  });

  describe('updateAdminEnvironmentDeletionLocked', () => {
    it('sends the lock flag and parses the updated config', async () => {
      const config = {
        id: '660e8400-e29b-41d4-a716-446655440002',
        name: 'Production',
        deletionLocked: false
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(config), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.updateAdminEnvironmentDeletionLocked(config.id, false);

      expect(result).toEqual(config);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://127.0.0.1:8788/admin/environments/${config.id}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ deletionLocked: false })
        })
      );
    });
  });

  describe('listAdminSnippets', () => {
    it('sends bearer auth and parses the full snippets list', async () => {
      const snippets = [
        {
          id: '770e8400-e29b-41d4-a716-446655440003',
          name: 'Auth helper',
          code: 'console.log("hello");',
          scope: 'pre-request' as const,
          createdAt: '2026-01-02T00:00:00.000Z',
          deletionLocked: false
        }
      ];

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ snippets }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.listAdminSnippets();

      expect(result).toEqual(snippets);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/snippets',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer hbk_test_token',
            Accept: 'application/json'
          })
        })
      );
    });
  });

  describe('createAdminSnippet', () => {
    it('sends name, code, and scope in the POST body', async () => {
      const snippet = {
        id: '770e8400-e29b-41d4-a716-446655440003',
        name: 'Auth helper',
        code: 'console.log("hello");',
        scope: 'pre-request' as const,
        createdAt: '2026-01-02T00:00:00.000Z',
        deletionLocked: false
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(snippet), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const created = await client.createAdminSnippet({
        name: 'Auth helper',
        code: 'console.log("hello");',
        scope: 'pre-request'
      });

      expect(created).toEqual(snippet);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/snippets',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Auth helper',
            code: 'console.log("hello");',
            scope: 'pre-request'
          })
        })
      );
    });
  });

  describe('updateAdminSnippet', () => {
    it('sends updated fields in the PUT body', async () => {
      const snippet = {
        id: '770e8400-e29b-41d4-a716-446655440003',
        name: 'Updated helper',
        code: 'console.log("updated");',
        scope: 'post-request' as const,
        createdAt: '2026-01-02T00:00:00.000Z',
        deletionLocked: false
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(snippet), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.updateAdminSnippet(snippet.id, {
        name: 'Updated helper',
        code: 'console.log("updated");',
        scope: 'post-request'
      });

      expect(result).toEqual(snippet);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://127.0.0.1:8788/admin/snippets/${snippet.id}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            name: 'Updated helper',
            code: 'console.log("updated");',
            scope: 'post-request'
          })
        })
      );
    });
  });

  describe('deleteAdminSnippet', () => {
    it('resolves without a body for 204 responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      globalThis.fetch = fetchMock;

      const client = createClient();
      await expect(
        client.deleteAdminSnippet('770e8400-e29b-41d4-a716-446655440003')
      ).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/admin/snippets/770e8400-e29b-41d4-a716-446655440003',
        expect.objectContaining({ method: 'DELETE' })
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

  describe('listDocuments', () => {
    it('sends bearer auth and parses the documents list', async () => {
      const collectionId = '550e8400-e29b-41d4-a716-446655440000';
      const document = {
        id: '880e8400-e29b-41d4-a716-446655440003',
        collectionId,
        folderId: null,
        name: 'README.md',
        content: '# API notes',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ documents: [document] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const documents = await client.listDocuments(collectionId);

      expect(documents).toEqual([document]);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://127.0.0.1:8788/collections/${collectionId}/documents`,
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

  describe('createDocument', () => {
    it('sends name, content, and folderId in the POST body', async () => {
      const collectionId = '550e8400-e29b-41d4-a716-446655440000';
      const folderId = '660e8400-e29b-41d4-a716-446655440001';
      const document = {
        id: '880e8400-e29b-41d4-a716-446655440003',
        collectionId,
        folderId,
        name: 'Auth.md',
        content: '# Auth flow',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(document), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const created = await client.createDocument(collectionId, {
        name: 'Auth.md',
        content: '# Auth flow',
        folderId
      });

      expect(created).toEqual(document);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://127.0.0.1:8788/collections/${collectionId}/documents`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Auth.md',
            content: '# Auth flow',
            folderId
          })
        })
      );
    });
  });

  describe('updateDocument', () => {
    it('sends updated document fields in the PUT body', async () => {
      const documentId = '880e8400-e29b-41d4-a716-446655440003';
      const collectionId = '550e8400-e29b-41d4-a716-446655440000';
      const document = {
        id: documentId,
        collectionId,
        folderId: null,
        name: 'README.md',
        content: '# Updated notes',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(document), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      const updated = await client.updateDocument(documentId, {
        collectionId,
        name: 'README.md',
        content: '# Updated notes'
      });

      expect(updated).toEqual(document);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://127.0.0.1:8788/documents/${documentId}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            collectionId,
            name: 'README.md',
            content: '# Updated notes'
          })
        })
      );
    });
  });

  describe('deleteDocument', () => {
    it('resolves without a body for 204 responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      globalThis.fetch = fetchMock;

      const client = createClient();
      await expect(
        client.deleteDocument('880e8400-e29b-41d4-a716-446655440003')
      ).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/documents/880e8400-e29b-41d4-a716-446655440003',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`
          })
        })
      );
    });
  });

  describe('reorderDocuments', () => {
    it('sends folderId and orderedDocumentIds in the PUT body', async () => {
      const collectionId = '550e8400-e29b-41d4-a716-446655440000';
      const folderId = '660e8400-e29b-41d4-a716-446655440001';
      const orderedDocumentIds = [
        '880e8400-e29b-41d4-a716-446655440003',
        '990e8400-e29b-41d4-a716-446655440004'
      ];

      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      globalThis.fetch = fetchMock;

      const client = createClient();
      await expect(
        client.reorderDocuments(collectionId, { folderId, orderedDocumentIds })
      ).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(
        `http://127.0.0.1:8788/collections/${collectionId}/documents/reorder`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ folderId, orderedDocumentIds })
        })
      );
    });
  });

  describe('moveDocument', () => {
    it('sends folderId and index in the PUT body', async () => {
      const documentId = '880e8400-e29b-41d4-a716-446655440003';
      const folderId = '660e8400-e29b-41d4-a716-446655440001';

      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      globalThis.fetch = fetchMock;

      const client = createClient();
      await expect(
        client.moveDocument(documentId, { folderId, index: 1 })
      ).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(
        `http://127.0.0.1:8788/documents/${documentId}/move`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ folderId, index: 1 })
        })
      );
    });
  });

  describe('getPluginSources', () => {
    it('returns plugin source URLs configured on the Team Hub', async () => {
      const payload = {
        catalogs: ['https://harborclient.com/plugin_catalog.json'],
        trusted: ['https://harborclient.com/plugins/trusted.json']
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      globalThis.fetch = fetchMock;

      const client = createClient();
      await expect(client.getPluginSources()).resolves.toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8788/plugins/sources',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`
          })
        })
      );
    });
  });
});
