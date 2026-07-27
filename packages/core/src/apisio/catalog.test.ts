import { describe, expect, it } from 'vitest';
import {
  apisIoCollectionFormatLabel,
  apisIoCollectionPageUrl,
  apisIoFallbackRawBase,
  detectApisIoCollectionFormat,
  isAllowedApisIoArtifactHost,
  parseApisIoCollectionList,
  resolveApisIoArtifactUrl,
  type ApisIoCollection
} from './catalog';

/**
 * Builds a minimal valid catalog collection for tests.
 *
 * @param overrides - Fields to replace on the base fixture.
 * @returns Catalog collection object.
 */
function sampleCollection(overrides: Partial<ApisIoCollection> = {}): ApisIoCollection {
  return {
    type: 'Collection',
    slug: 'postman-123formbuilder-rest-api-v2',
    name: '123FormBuilder REST API v2',
    provider_slug: '123formbuilder',
    provider_name: '123FormBuilder',
    description: 'REST API v2 for 123FormBuilder.',
    tags: ['Online Forms', 'Postman Collection'],
    url: 'postman/123formbuilder-rest-api-v2.postman_collection.json',
    meta: { item_count: 26 },
    ...overrides
  };
}

describe('apisio/catalog', () => {
  it('parseApisIoCollectionList accepts a paginated response and ignores unknown fields', () => {
    const list = parseApisIoCollectionList({
      meta: {
        total: 1,
        page: 1,
        limit: 25,
        pages: 1,
        query: { type: 'collections', q: 'forms' },
        extra: true
      },
      data: [{ ...sampleCollection(), unexpected: 1 }],
      alsoExtra: 'ok'
    });

    expect(list.meta.total).toBe(1);
    expect(list.data).toHaveLength(1);
    expect(list.data[0]?.name).toBe('123FormBuilder REST API v2');
  });

  it('parseApisIoCollectionList rejects invalid payloads', () => {
    expect(() => parseApisIoCollectionList({ meta: {}, data: [] })).toThrow();
  });

  it('detectApisIoCollectionFormat prefers URL suffixes over tags', () => {
    expect(detectApisIoCollectionFormat(sampleCollection())).toBe('postman');
    expect(
      detectApisIoCollectionFormat(
        sampleCollection({
          slug: 'open-123formbuilder-rest-api-v2',
          url: 'collections/123formbuilder-rest-api-v2.opencollection.json',
          tags: ['Open Collection']
        })
      )
    ).toBe('opencollection');
  });

  it('detectApisIoCollectionFormat falls back to tags when the URL is ambiguous', () => {
    expect(
      detectApisIoCollectionFormat(
        sampleCollection({
          url: 'artifacts/collection.json',
          tags: ['Postman Collection']
        })
      )
    ).toBe('postman');
    expect(
      detectApisIoCollectionFormat(
        sampleCollection({
          url: 'artifacts/collection.json',
          tags: ['Open Collection']
        })
      )
    ).toBe('opencollection');
    expect(
      detectApisIoCollectionFormat(
        sampleCollection({
          url: 'artifacts/collection.json',
          tags: ['Forms']
        })
      )
    ).toBeNull();
  });

  it('apisIoCollectionPageUrl builds the public detail page URL', () => {
    expect(apisIoCollectionPageUrl(sampleCollection())).toBe(
      'https://apis.io/collections/123formbuilder/postman-123formbuilder-rest-api-v2/'
    );
  });

  it('apisIoFallbackRawBase points at the api-evangelist raw tree', () => {
    expect(apisIoFallbackRawBase('123formbuilder')).toBe(
      'https://raw.githubusercontent.com/api-evangelist/123formbuilder/refs/heads/main/'
    );
  });

  it('isAllowedApisIoArtifactHost only permits https raw.githubusercontent.com and apis.io', () => {
    expect(
      isAllowedApisIoArtifactHost(
        'https://raw.githubusercontent.com/api-evangelist/123formbuilder/refs/heads/main/postman/x.json'
      )
    ).toBe(true);
    expect(isAllowedApisIoArtifactHost('https://apis.io/api/v1/collections')).toBe(true);
    expect(isAllowedApisIoArtifactHost('http://raw.githubusercontent.com/api-evangelist/x')).toBe(
      false
    );
    expect(isAllowedApisIoArtifactHost('https://evil.example/x.json')).toBe(false);
    expect(isAllowedApisIoArtifactHost('not-a-url')).toBe(false);
  });

  it('resolveApisIoArtifactUrl resolves relative paths against the provider apis.yml URL', () => {
    const resolved = resolveApisIoArtifactUrl(
      'postman/123formbuilder-rest-api-v2.postman_collection.json',
      'https://raw.githubusercontent.com/api-evangelist/123formbuilder/refs/heads/main/apis.yml',
      '123formbuilder'
    );
    expect(resolved).toBe(
      'https://raw.githubusercontent.com/api-evangelist/123formbuilder/refs/heads/main/postman/123formbuilder-rest-api-v2.postman_collection.json'
    );
  });

  it('resolveApisIoArtifactUrl uses the fallback base when the provider URL is missing', () => {
    const resolved = resolveApisIoArtifactUrl(
      'collections/123formbuilder-rest-api-v2.opencollection.json',
      null,
      '123formbuilder'
    );
    expect(resolved).toBe(
      'https://raw.githubusercontent.com/api-evangelist/123formbuilder/refs/heads/main/collections/123formbuilder-rest-api-v2.opencollection.json'
    );
  });

  it('resolveApisIoArtifactUrl returns absolute allowed URLs unchanged', () => {
    const absolute =
      'https://raw.githubusercontent.com/api-evangelist/123formbuilder/main/postman/x.postman_collection.json';
    expect(resolveApisIoArtifactUrl(absolute, null, '123formbuilder')).toBe(absolute);
  });

  it('resolveApisIoArtifactUrl rejects path traversal and blocked hosts', () => {
    expect(resolveApisIoArtifactUrl('../secrets.json', null, '123formbuilder')).toBeNull();
    expect(
      resolveApisIoArtifactUrl('https://evil.example/x.json', null, '123formbuilder')
    ).toBeNull();
  });

  it('apisIoCollectionFormatLabel returns UI labels', () => {
    expect(apisIoCollectionFormatLabel('postman')).toBe('Postman Collection');
    expect(apisIoCollectionFormatLabel('opencollection')).toBe('Open Collection');
  });
});
