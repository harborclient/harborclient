import { afterEach, describe, expect, it, vi } from 'vitest';
import { HarborServerClient } from '#/main/server/HarborServerClient';
import { ServerClientError } from '#/main/server/ServerClientError';

describe('HarborServerClient', () => {
  const originalFetch = globalThis.fetch;
  const baseUrl = 'http://127.0.0.1:8788';
  const token = 'hbk_test_token';

  /**
   * Creates a client instance for tests with a fixed base URL and token.
   */
  function createClient(): HarborServerClient {
    return new HarborServerClient({ baseUrl, token });
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
      'throws ServerClientError with status %i and server message',
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
          name: 'ServerClientError',
          message,
          status,
          method: 'GET',
          path: '/collections'
        });
        await expect(client.listCollections()).rejects.toBeInstanceOf(ServerClientError);
      }
    );

    it('throws ServerClientError with status 0 on network failure', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Connection refused'));
      globalThis.fetch = fetchMock;

      const client = createClient();

      await expect(client.listCollections()).rejects.toMatchObject({
        name: 'ServerClientError',
        message: 'Connection refused',
        status: 0,
        method: 'GET',
        path: '/collections'
      });
    });
  });
});
