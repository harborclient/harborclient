import { describe, expect, it } from 'vitest';
import { parseFormParts } from '@harborclient/core/formData';
import { parseUrlEncodedParts } from '@harborclient/core/urlencoded';
import { validateCollectionExport } from '#/main/storage/collectionData';
import { canImportOpenCollection, convertOpenCollection, isOpenCollection } from './opencollection';

const bundledFixture = {
  opencollection: '1.0.0',
  info: {
    name: 'Demo API'
  },
  bundled: true,
  request: {
    headers: [{ name: 'X-Collection', value: 'demo', enabled: true }],
    auth: { type: 'bearer', token: '{{collectionToken}}' },
    scripts: [
      { type: 'before-request', code: 'hc.collection.setVar("ready", "1");' },
      { type: 'tests', code: 'hc.test("ok", () => true);' }
    ]
  },
  items: [
    {
      info: { type: 'http', name: 'Health', tags: ['smoke'] },
      http: {
        method: 'GET',
        url: 'https://example.com/health',
        headers: [{ name: 'Accept', value: 'application/json' }],
        params: [{ name: 'verbose', value: '1', enabled: true }]
      },
      docs: 'Health check endpoint'
    },
    {
      info: { type: 'folder', name: 'Users' },
      items: [
        {
          info: { type: 'http', name: 'Create user', description: 'Creates a user' },
          http: {
            method: 'POST',
            url: 'https://example.com/users',
            headers: [{ name: 'Content-Type', value: 'application/json' }],
            body: {
              type: 'json',
              data: '{\n  "name": "Ada"\n}'
            },
            auth: { type: 'basic', username: 'admin', password: 'secret' }
          },
          runtime: {
            scripts: [{ type: 'before-request', code: 'console.log("create");' }]
          }
        },
        {
          info: { name: 'Nested', type: 'folder' },
          items: [
            {
              info: { type: 'http', name: 'List pets' },
              http: {
                method: 'GET',
                url: '{{baseUrl}}/pets'
              }
            }
          ]
        }
      ]
    },
    {
      info: { type: 'http', name: 'Login form' },
      http: {
        method: 'POST',
        url: 'https://example.com/login',
        body: {
          type: 'form-urlencoded',
          data: [
            { name: 'username', value: 'ada' },
            { name: 'password', value: 'secret' }
          ]
        }
      }
    },
    {
      info: { type: 'http', name: 'Upload' },
      http: {
        method: 'POST',
        url: 'https://example.com/upload',
        body: {
          type: 'multipart-form',
          data: [
            { name: 'note', value: 'hello', type: 'text' },
            { name: 'file', value: '', type: 'file' }
          ]
        }
      }
    },
    {
      info: { type: 'grpc', name: 'Ignored gRPC' },
      grpc: {
        url: 'localhost:50051',
        service: 'Demo',
        method: 'Ping'
      }
    },
    {
      info: { type: 'graphql', name: 'Ignored GraphQL' },
      graphql: {
        url: 'https://example.com/graphql',
        query: '{ ping }'
      }
    }
  ]
};

const yamlFixture = `
opencollection: '1.0.0'
info:
  name: YAML Demo
bundled: true
items:
  - info:
      type: http
      name: Ping
    http:
      method: GET
      url: https://example.com/ping
`;

describe('isOpenCollection', () => {
  it('returns true for a valid bundled OpenCollection document', () => {
    expect(isOpenCollection(bundledFixture)).toBe(true);
  });

  it('returns false for Postman, HarborClient, OpenAPI, and invalid documents', () => {
    expect(isOpenCollection({ info: { name: 'Demo' }, item: [] })).toBe(false);
    expect(
      isOpenCollection({
        harborclientExport: 'collection',
        harborclientVersion: 1,
        name: 'Native'
      })
    ).toBe(false);
    expect(isOpenCollection({ openapi: '3.0.3', info: { title: 'Demo' }, paths: {} })).toBe(false);
    expect(isOpenCollection(null)).toBe(false);
    expect(isOpenCollection({ opencollection: '1.0.0' })).toBe(false);
    expect(isOpenCollection({ opencollection: '2.0.0', info: { name: 'Demo' } })).toBe(false);
    expect(isOpenCollection({ opencollection: '1.0.0', info: { name: '   ' } })).toBe(false);
  });
});

describe('canImportOpenCollection', () => {
  it('recognizes OpenCollection JSON and YAML', () => {
    expect(canImportOpenCollection(JSON.stringify(bundledFixture))).toBe(true);
    expect(canImportOpenCollection(yamlFixture)).toBe(true);
  });

  it('does not claim Postman collections, HarborClient exports, or OpenAPI specs', () => {
    expect(canImportOpenCollection('{"info":{"name":"Demo"},"item":[]}')).toBe(false);
    expect(
      canImportOpenCollection('{"harborclientExport":"collection","harborclientVersion":1}')
    ).toBe(false);
    expect(
      canImportOpenCollection(`
openapi: 3.0.3
info:
  title: Demo
paths: {}
`)
    ).toBe(false);
  });
});

describe('convertOpenCollection', () => {
  it('converts a bundled collection into a valid HarborClient export', () => {
    const converted = convertOpenCollection(bundledFixture);
    expect(() => validateCollectionExport(converted)).not.toThrow();

    expect(converted.name).toBe('Demo API');
    expect(converted.harborclientExport).toBe('collection');
    expect(converted.harborclientVersion).toBe(1);
  });

  it('maps collection-level headers, auth, and scripts', () => {
    const converted = convertOpenCollection(bundledFixture);

    expect(converted.headers).toEqual([{ key: 'X-Collection', value: 'demo', enabled: true }]);
    expect(converted.auth?.type).toBe('bearer');
    expect(converted.auth?.bearer.token).toBe('{{collectionToken}}');
    expect(converted.pre_request_script).toContain('hc.collection.setVar');
    expect(converted.post_request_script).toContain('hc.test');
  });

  it('imports HTTP requests, folders, bodies, auth, tags, and skips non-HTTP items', () => {
    const converted = convertOpenCollection(bundledFixture);

    expect(converted.requests).toHaveLength(5);
    const users = converted.folders?.find((folder) => folder.name === 'Users');
    const nestedFolder = converted.folders?.find((folder) => folder.name === 'Nested');
    expect(users).toMatchObject({ parent_folder_uuid: null, sort_order: 0 });
    expect(nestedFolder).toMatchObject({
      parent_folder_uuid: users?.uuid,
      sort_order: 0
    });
    expect(new Set(converted.folders?.map((folder) => folder.uuid)).size).toBe(2);

    const health = converted.requests.find((request) => request.name === 'Health');
    expect(health).toMatchObject({
      method: 'GET',
      url: 'https://example.com/health',
      tags: 'smoke',
      comment: 'Health check endpoint',
      folder_name: null
    });
    expect(health?.headers).toEqual([{ key: 'Accept', value: 'application/json', enabled: true }]);
    expect(health?.params).toEqual([{ key: 'verbose', value: '1', enabled: true }]);

    const createUser = converted.requests.find((request) => request.name === 'Create user');
    expect(createUser).toMatchObject({
      method: 'POST',
      url: 'https://example.com/users',
      body_type: 'json',
      body: '{\n  "name": "Ada"\n}',
      comment: 'Creates a user',
      folder_name: 'Users',
      folder_uuid: users?.uuid,
      pre_request_script: 'console.log("create");'
    });
    expect(createUser?.auth?.type).toBe('basic');
    expect(createUser?.auth?.basic).toEqual({ username: 'admin', password: 'secret' });

    const nested = converted.requests.find((request) => request.name === 'List pets');
    expect(nested).toMatchObject({
      folder_name: 'Nested',
      folder_uuid: nestedFolder?.uuid
    });

    const login = converted.requests.find((request) => request.name === 'Login form');
    expect(login?.body_type).toBe('urlencoded');
    expect(parseUrlEncodedParts(login?.body ?? '')).toEqual([
      { key: 'username', value: 'ada', enabled: true },
      { key: 'password', value: 'secret', enabled: true }
    ]);

    const upload = converted.requests.find((request) => request.name === 'Upload');
    expect(upload?.body_type).toBe('multipart');
    expect(parseFormParts(upload?.body ?? '')).toEqual([
      { key: 'note', value: 'hello', enabled: true, type: 'text', files: [] },
      { key: 'file', value: '', enabled: true, type: 'file', files: [] }
    ]);

    expect(converted.requests.some((request) => request.name.includes('gRPC'))).toBe(false);
    expect(converted.requests.some((request) => request.name.includes('GraphQL'))).toBe(false);
  });

  it('imports Accept text/event-stream requests as SSE and leaves JSON Accept as HTTP', () => {
    const converted = convertOpenCollection({
      opencollection: '1.0.0',
      info: { name: 'SSE Demo' },
      items: [
        {
          info: { type: 'http', name: 'Live Events' },
          http: {
            method: 'GET',
            url: 'https://example.com/events',
            headers: [{ name: 'Accept', value: 'text/event-stream' }]
          }
        },
        {
          info: { type: 'http', name: 'Health' },
          http: {
            method: 'GET',
            url: 'https://example.com/health',
            headers: [{ name: 'Accept', value: 'application/json' }]
          }
        }
      ]
    });

    const liveEvents = converted.requests.find((request) => request.name === 'Live Events');
    const health = converted.requests.find((request) => request.name === 'Health');

    expect(liveEvents?.protocol).toBe('sse');
    expect(health?.protocol).toBeUndefined();
  });

  it('throws for invalid documents', () => {
    expect(() => convertOpenCollection({ info: { name: 'Nope' } })).toThrow(
      'Invalid OpenCollection file'
    );
  });
});
