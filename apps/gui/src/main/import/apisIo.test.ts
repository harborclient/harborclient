import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIS_IO_API_BASE, type ApisIoCollection } from '@harborclient/core/apisio/catalog';

/**
 * Builds a minimal valid catalog collection for tests.
 *
 * @param overrides - Fields to replace on the base fixture.
 * @returns Catalog collection object.
 */
function sampleCollection(overrides: Partial<ApisIoCollection> = {}): ApisIoCollection {
  return {
    type: 'Collection',
    slug: 'postman-demo-api',
    name: 'Demo API',
    provider_slug: 'demo',
    provider_name: 'Demo',
    description: 'A demo Postman collection.',
    tags: ['Postman Collection'],
    url: 'postman/demo-api.postman_collection.json',
    meta: { item_count: 2 },
    ...overrides
  };
}

const postmanDocument = {
  info: {
    _postman_id: '11111111-1111-1111-1111-111111111111',
    name: 'Demo API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: [
    {
      name: 'Users',
      item: [
        {
          name: 'List users',
          request: { method: 'GET', url: 'https://example.com/users' }
        }
      ]
    },
    {
      name: 'Health',
      request: { method: 'GET', url: 'https://example.com/health' }
    }
  ]
};

const openCollectionDocument = {
  opencollection: '1.0.0',
  info: { name: 'Demo Open Collection', version: '1.0.0' },
  items: [
    {
      info: { name: 'Auth', type: 'folder' },
      items: [
        {
          info: { name: 'Login', type: 'http' },
          http: { method: 'POST', url: 'https://example.com/login' }
        }
      ]
    },
    {
      info: { name: 'Ping', type: 'http' },
      http: { method: 'GET', url: 'https://example.com/ping' }
    }
  ]
};

describe('apisIo', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('searchApisIoCollections requests the collections endpoint and parses the response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          meta: { total: 1, page: 1, limit: 25, pages: 1, query: { q: 'demo' } },
          data: [sampleCollection()]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { searchApisIoCollections } = await import('#/main/import/apisIo');
    const result = await searchApisIoCollections('demo', 1);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.name).toBe('Demo API');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain(`${APIS_IO_API_BASE}/collections`);
    expect(calledUrl).toContain('q=demo');
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('limit=25');
  });

  it('searchApisIoCollections rejects an empty query', async () => {
    const { searchApisIoCollections } = await import('#/main/import/apisIo');
    await expect(searchApisIoCollections('   ')).rejects.toThrow(/search query/i);
  });

  it('searchApisIoCollections throws a readable error when the API returns non-OK', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    const { searchApisIoCollections } = await import('#/main/import/apisIo');
    await expect(searchApisIoCollections('demo')).rejects.toThrow(/Failed to search apis\.io/i);
  });

  it('fetchApisIoCollectionDocument resolves the provider base, downloads, and caches the document', async () => {
    const artifactUrl =
      'https://raw.githubusercontent.com/api-evangelist/demo/refs/heads/main/postman/demo-api.postman_collection.json';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/providers/demo')) {
        return new Response(
          JSON.stringify({
            slug: 'demo',
            url: 'https://raw.githubusercontent.com/api-evangelist/demo/refs/heads/main/apis.yml'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === artifactUrl) {
        return new Response(JSON.stringify(postmanDocument), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('', { status: 404 });
    });

    const { clearApisIoCaches, fetchApisIoCollectionDocument } =
      await import('#/main/import/apisIo');
    clearApisIoCaches();

    const first = await fetchApisIoCollectionDocument(sampleCollection());
    expect(first.format).toBe('postman');
    expect(first.sourceUrl).toBe(artifactUrl);
    expect(first.parsed).toEqual(postmanDocument);

    const second = await fetchApisIoCollectionDocument(sampleCollection());
    expect(second.parsed).toEqual(postmanDocument);
    // Provider + artifact on first call; second call should hit the document cache.
    expect(fetchMock.mock.calls.filter((call) => String(call[0]) === artifactUrl)).toHaveLength(1);
  });

  it('fetchApisIoCollectionDocument rejects blocked artifact hosts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ slug: 'demo', url: 'https://evil.example/apis.yml' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const { clearApisIoCaches, fetchApisIoCollectionDocument } =
      await import('#/main/import/apisIo');
    clearApisIoCaches();

    await expect(
      fetchApisIoCollectionDocument(
        sampleCollection({
          url: 'https://evil.example/collection.json'
        })
      )
    ).rejects.toThrow(/safe download URL/i);
  });

  it('summarizeApisIoDocument counts Postman folders and requests and builds an outline', async () => {
    const { summarizeApisIoDocument } = await import('#/main/import/apisIo');
    const summary = summarizeApisIoDocument(postmanDocument, 'postman');
    expect(summary.requestCount).toBe(2);
    expect(summary.folderCount).toBe(1);
    expect(summary.outline).toEqual(['Users', 'Health']);
  });

  it('summarizeApisIoDocument counts Open Collection folders and requests', async () => {
    const { summarizeApisIoDocument } = await import('#/main/import/apisIo');
    const summary = summarizeApisIoDocument(openCollectionDocument, 'opencollection');
    expect(summary.requestCount).toBe(2);
    expect(summary.folderCount).toBe(1);
    expect(summary.outline).toEqual(['Auth', 'Ping']);
  });

  it('previewApisIoCollection returns format, source URL, and summary fields', async () => {
    const artifactUrl =
      'https://raw.githubusercontent.com/api-evangelist/demo/refs/heads/main/collections/demo.opencollection.json';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/providers/demo')) {
        return new Response(JSON.stringify({ slug: 'demo', url: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === artifactUrl) {
        return new Response(JSON.stringify(openCollectionDocument), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('', { status: 404 });
    });

    const { clearApisIoCaches, previewApisIoCollection } = await import('#/main/import/apisIo');
    clearApisIoCaches();

    const preview = await previewApisIoCollection(
      sampleCollection({
        slug: 'open-demo',
        url: 'collections/demo.opencollection.json',
        tags: ['Open Collection']
      })
    );

    expect(preview.format).toBe('opencollection');
    expect(preview.sourceUrl).toBe(artifactUrl);
    expect(preview.requestCount).toBe(2);
    expect(preview.folderCount).toBe(1);
    expect(preview.outline).toEqual(['Auth', 'Ping']);
  });
});
