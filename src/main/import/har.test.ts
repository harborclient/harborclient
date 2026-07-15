import { describe, expect, it } from 'vitest';
import { validateCollectionExport } from '#/main/storage/collectionData';
import { isPostmanCollection } from './postman';
import { convertHarToCollection, isHarArchive } from './har';
import { parseFormParts } from '#/shared/formData';
import { parseUrlEncodedParts } from '#/shared/urlencoded';

const sampleHarFixture = {
  log: {
    version: '1.2',
    creator: { name: 'Chrome', version: '120.0.0.0' },
    pages: [{ title: 'Example App' }],
    entries: [
      {
        _resourceType: 'xhr',
        request: {
          method: 'GET',
          url: 'https://api.example.com/users?page=1&sort=name',
          headers: [
            { name: 'Accept', value: 'application/json' },
            { name: ':authority', value: 'api.example.com' }
          ],
          queryString: [
            { name: 'page', value: '1' },
            { name: 'sort', value: 'name' }
          ]
        },
        response: {
          content: { mimeType: 'application/json' }
        }
      },
      {
        _resourceType: 'image',
        request: {
          method: 'GET',
          url: 'https://cdn.example.com/logo.png',
          headers: [],
          queryString: []
        },
        response: {
          content: { mimeType: 'image/png' }
        }
      },
      {
        _resourceType: 'xhr',
        request: {
          method: 'POST',
          url: 'https://api.example.com/users',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          queryString: [],
          postData: {
            mimeType: 'application/json',
            text: '{"name":"Ada"}'
          }
        },
        response: {
          content: { mimeType: 'application/json' }
        }
      },
      {
        _resourceType: 'xhr',
        request: {
          method: 'POST',
          url: 'https://api.example.com/login',
          headers: [{ name: 'Content-Type', value: 'application/x-www-form-urlencoded' }],
          queryString: [],
          postData: {
            mimeType: 'application/x-www-form-urlencoded',
            params: [
              { name: 'username', value: 'ada' },
              { name: 'password', value: 'secret' }
            ]
          }
        },
        response: {
          content: { mimeType: 'application/json' }
        }
      },
      {
        _resourceType: 'xhr',
        request: {
          method: 'POST',
          url: 'https://api.example.com/upload',
          headers: [{ name: 'Content-Type', value: 'multipart/form-data; boundary=abc' }],
          queryString: [],
          postData: {
            mimeType: 'multipart/form-data; boundary=abc',
            params: [
              { name: 'title', value: 'Report' },
              { name: 'file', value: 'binary', fileName: 'report.pdf' }
            ]
          }
        },
        response: {
          content: { mimeType: 'application/json' }
        }
      },
      {
        request: {
          method: 'GET',
          url: 'https://api.example.com/notes',
          headers: [],
          queryString: []
        },
        response: {
          content: { mimeType: 'text/plain' }
        }
      },
      {
        request: {
          method: 'GET',
          url: 'https://cdn.example.com/app.js',
          headers: [],
          queryString: []
        },
        response: {
          content: { mimeType: 'application/javascript' }
        }
      }
    ]
  }
};

describe('isHarArchive', () => {
  it('returns true for a HAR archive with log.entries', () => {
    expect(isHarArchive(sampleHarFixture)).toBe(true);
  });

  it('returns false for a HarborClient collection export', () => {
    expect(
      isHarArchive({
        harborclientVersion: 1,
        harborclientExport: 'collection',
        name: 'Local',
        variables: [],
        headers: [],
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        requests: []
      })
    ).toBe(false);
  });

  it('returns false for a Postman collection export', () => {
    const postman = {
      info: {
        _postman_id: 'abc',
        name: 'Postman',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: []
    };

    expect(isPostmanCollection(postman)).toBe(true);
    expect(isHarArchive(postman)).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(isHarArchive(null)).toBe(false);
    expect(isHarArchive('har')).toBe(false);
  });
});

describe('convertHarToCollection', () => {
  it('converts API-like entries and validates as a collection export', () => {
    const exported = convertHarToCollection(sampleHarFixture);
    expect(exported.harborclientExport).toBe('collection');
    expect(exported.name).toBe('Example App');
    expect(exported.folders).toEqual([]);
    const validated = validateCollectionExport(exported);
    expect(validated.documents).toEqual([]);
    expect(validated.name).toBe(exported.name);
    expect(validated.requests).toHaveLength(exported.requests.length);

    expect(exported.requests).toHaveLength(5);
  });

  it('maps query strings to params and strips them from the stored URL', () => {
    const exported = convertHarToCollection(sampleHarFixture);
    const listUsers = exported.requests.find((request) => request.url.includes('/users'));

    expect(listUsers).toMatchObject({
      method: 'GET',
      url: 'https://api.example.com/users',
      params: [
        { key: 'page', value: '1', enabled: true },
        { key: 'sort', value: 'name', enabled: true }
      ]
    });
  });

  it('drops HTTP/2 pseudo-headers from imported requests', () => {
    const exported = convertHarToCollection(sampleHarFixture);
    const listUsers = exported.requests.find((request) => request.url.includes('/users'));

    expect(listUsers?.headers.some((header) => header.key.startsWith(':'))).toBe(false);
    expect(listUsers?.headers).toEqual([
      { key: 'Accept', value: 'application/json', enabled: true }
    ]);
  });

  it('maps JSON, urlencoded, and multipart post bodies', () => {
    const exported = convertHarToCollection(sampleHarFixture);

    const createUser = exported.requests.find((request) => request.name === 'POST /users');
    expect(createUser).toMatchObject({
      body: '{"name":"Ada"}',
      body_type: 'json'
    });

    const login = exported.requests.find((request) => request.name === 'POST /login');
    expect(login?.body_type).toBe('urlencoded');
    expect(parseUrlEncodedParts(login?.body ?? '')).toEqual([
      { key: 'username', value: 'ada', enabled: true },
      { key: 'password', value: 'secret', enabled: true }
    ]);

    const upload = exported.requests.find((request) => request.name === 'POST /upload');
    expect(upload?.body_type).toBe('multipart');
    expect(parseFormParts(upload?.body ?? '')).toEqual([
      { key: 'title', value: 'Report', enabled: true, type: 'text', files: [] },
      { key: 'file', value: 'binary', enabled: true, type: 'file', files: [] }
    ]);
  });

  it('filters static assets by resource type and mime-type heuristics', () => {
    const exported = convertHarToCollection(sampleHarFixture);
    const urls = exported.requests.map((request) => request.url);

    expect(urls).not.toContain('https://cdn.example.com/logo.png');
    expect(urls).not.toContain('https://cdn.example.com/app.js');
    expect(urls).toContain('https://api.example.com/notes');
  });

  it('uses creator name or import file name for the collection title', () => {
    const xhrEntry = {
      _resourceType: 'xhr',
      request: {
        method: 'GET',
        url: 'https://api.example.com/health',
        headers: [],
        queryString: []
      },
      response: {
        content: { mimeType: 'application/json' }
      }
    };

    expect(
      convertHarToCollection({
        log: {
          version: '1.2',
          creator: { name: 'Chrome' },
          entries: [xhrEntry]
        }
      }).name
    ).toBe('Chrome');

    expect(
      convertHarToCollection(
        {
          log: {
            version: '1.2',
            entries: [xhrEntry]
          }
        },
        { name: 'network-capture' }
      ).name
    ).toBe('network-capture');
  });

  it('throws when the archive has no importable API-like requests', () => {
    const fixture = {
      log: {
        version: '1.2',
        entries: [
          {
            _resourceType: 'image',
            request: {
              method: 'GET',
              url: 'https://cdn.example.com/logo.png',
              headers: [],
              queryString: []
            },
            response: {
              content: { mimeType: 'image/png' }
            }
          }
        ]
      }
    };

    expect(() => convertHarToCollection(fixture)).toThrow(
      'HAR archive contains no API-like requests to import.'
    );
  });
});
