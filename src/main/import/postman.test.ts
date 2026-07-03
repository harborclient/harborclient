import { describe, expect, it } from 'vitest';
import { validateCollectionExport } from '#/main/storage/collectionData';
import { convertPostmanCollection, isPostmanCollection } from '#/main/import/postman';

const pintailFixture = {
  info: {
    _postman_id: 'c04ab761-e6ce-4c46-bf94-5d5ff31ad50b',
    name: 'Pintail',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: [
    {
      name: 'Fetch Queries',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{base_url}}/queries?q=%7B%22text%22%3A%22%22%7D',
          host: ['{{base_url}}'],
          path: ['queries'],
          query: [{ key: 'q', value: '%7B%22text%22%3A%22%22%7D' }]
        }
      },
      response: []
    },
    {
      name: 'Request Pixel',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: 'https://pixel.pintail.io/v1/tic6QBYHSJDdd55ao?fast=true',
          protocol: 'https',
          host: ['pixel', 'pintail', 'io'],
          path: ['v1', 'tic6QBYHSJDdd55ao'],
          query: [{ key: 'fast', value: 'true' }]
        }
      },
      response: []
    }
  ],
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: 'secret-token', type: 'string' }]
  },
  event: [
    {
      listen: 'prerequest',
      script: { type: 'text/javascript', exec: [''] }
    },
    {
      listen: 'test',
      script: { type: 'text/javascript', exec: [''] }
    }
  ],
  variable: [{ key: 'base_url', value: '' }]
};

const nestedFolderFixture = {
  info: {
    _postman_id: 'nested-test-id',
    name: 'Nested API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: [
    {
      name: 'Authentication',
      item: [
        {
          name: 'API Grant',
          event: [
            {
              listen: 'test',
              script: {
                exec: [
                  'const response = pm.response.json();',
                  "pm.collectionVariables.set('idToken', response.idToken);"
                ]
              }
            }
          ],
          request: {
            auth: { type: 'noauth' },
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
              mode: 'raw',
              raw: '{\n  "key": "{{apiKey}}"\n}'
            },
            url: {
              raw: '{{baseUrl}}{{apiBase}}/auth/apiGrant',
              host: ['{{baseUrl}}{{apiBase}}'],
              path: ['auth', 'apiGrant']
            },
            description: 'Authenticate using an API key.'
          },
          response: []
        }
      ]
    },
    {
      name: 'Organization',
      item: [
        {
          name: 'Pass Types',
          item: [
            {
              name: 'List Pass Types',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}{{apiBase}}/organization/passTypes',
                  host: ['{{baseUrl}}{{apiBase}}'],
                  path: ['organization', 'passTypes']
                }
              },
              response: []
            }
          ]
        }
      ]
    },
    {
      name: 'Root Request',
      request: {
        method: 'GET',
        header: [],
        url: 'https://example.com/health'
      },
      response: []
    }
  ],
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{idToken}}', type: 'string' }]
  },
  variable: [
    { key: 'baseUrl', value: 'https://app.example.com' },
    { key: 'apiBase', value: '/api/v1' }
  ]
};

describe('isPostmanCollection', () => {
  it('returns true when info._postman_id is present', () => {
    expect(isPostmanCollection(pintailFixture)).toBe(true);
  });

  it('returns true when info.schema references Postman', () => {
    expect(
      isPostmanCollection({
        info: { schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: []
      })
    ).toBe(true);
  });

  it('returns false for HarborClient export files', () => {
    expect(
      isPostmanCollection({
        harborclientVersion: 1,
        harborclientExport: 'collection',
        name: 'My API',
        variables: [],
        headers: [],
        requests: []
      })
    ).toBe(false);
  });

  it('returns false for non-object payloads', () => {
    expect(isPostmanCollection(null)).toBe(false);
    expect(isPostmanCollection('not-json')).toBe(false);
  });
});

describe('convertPostmanCollection', () => {
  it('converts top-level requests, variables, and collection auth', () => {
    const result = convertPostmanCollection(pintailFixture);

    expect(result.harborclientVersion).toBe(1);
    expect(result.harborclientExport).toBe('collection');
    expect(result.name).toBe('Pintail');
    expect(result.variables).toEqual([
      { key: 'base_url', value: '', defaultValue: '', share: true }
    ]);
    expect(result.auth?.type).toBe('bearer');
    expect(result.auth?.bearer.token).toBe('secret-token');
    expect(result.folders).toEqual([]);
    expect(result.requests).toHaveLength(2);
    expect(result.requests[0]).toMatchObject({
      name: 'Fetch Queries',
      method: 'GET',
      url: '{{base_url}}/queries?q=%7B%22text%22%3A%22%22%7D',
      params: [],
      folder_name: null
    });
    expect(result.requests[1].url).toBe('https://pixel.pintail.io/v1/tic6QBYHSJDdd55ao?fast=true');
  });

  it('flattens nested folders into single-level folder names', () => {
    const result = convertPostmanCollection(nestedFolderFixture);

    expect(result.folders).toEqual([
      { name: 'Authentication', sort_order: 0 },
      { name: 'Organization / Pass Types', sort_order: 1 }
    ]);
    expect(result.requests).toHaveLength(3);
    expect(result.requests[0]).toMatchObject({
      name: 'API Grant',
      method: 'POST',
      folder_name: 'Authentication',
      body_type: 'json',
      comment: 'Authenticate using an API key.',
      tags: ''
    });
    expect(result.requests[1]).toMatchObject({
      name: 'List Pass Types',
      folder_name: 'Organization / Pass Types'
    });
    expect(result.requests[2]).toMatchObject({
      name: 'Root Request',
      folder_name: null,
      url: 'https://example.com/health'
    });
  });

  it('imports request scripts verbatim from Postman events', () => {
    const result = convertPostmanCollection(nestedFolderFixture);
    const apiGrant = result.requests.find((req) => req.name === 'API Grant');

    expect(apiGrant?.post_request_script).toContain('pm.collectionVariables.set');
    expect(apiGrant?.post_request_script).toContain('pm.response.json');
  });

  it('maps urlencoded and formdata body modes', () => {
    const result = convertPostmanCollection({
      info: { _postman_id: 'body-test' },
      item: [
        {
          name: 'Urlencoded',
          request: {
            method: 'POST',
            header: [],
            body: {
              mode: 'urlencoded',
              urlencoded: [
                { key: 'foo', value: 'bar' },
                { key: 'disabled', value: 'x', disabled: true }
              ]
            },
            url: 'https://example.com/form'
          }
        },
        {
          name: 'Multipart',
          request: {
            method: 'POST',
            header: [],
            body: {
              mode: 'formdata',
              formdata: [
                { key: 'textField', value: 'hello', type: 'text' },
                { key: 'fileField', type: 'file' }
              ]
            },
            url: 'https://example.com/upload'
          }
        }
      ]
    });

    const urlencoded = result.requests.find((req) => req.name === 'Urlencoded');
    const multipart = result.requests.find((req) => req.name === 'Multipart');

    expect(urlencoded?.body_type).toBe('urlencoded');
    expect(JSON.parse(urlencoded?.body ?? '[]')).toEqual([
      { key: 'foo', value: 'bar', enabled: true },
      { key: 'disabled', value: 'x', enabled: false }
    ]);
    expect(multipart?.body_type).toBe('multipart');
    expect(JSON.parse(multipart?.body ?? '[]')).toEqual([
      { key: 'textField', value: 'hello', enabled: true, type: 'text', files: [] },
      { key: 'fileField', value: '', enabled: true, type: 'file', files: [] }
    ]);
  });

  it('detects JSON raw bodies from Content-Type header', () => {
    const result = convertPostmanCollection({
      info: { _postman_id: 'json-body-test' },
      item: [
        {
          name: 'JSON Body',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: '{"ok":true}' },
            url: 'https://example.com/json'
          }
        }
      ]
    });

    expect(result.requests[0]?.body_type).toBe('json');
    expect(result.requests[0]?.body).toBe('{"ok":true}');
  });

  it('skips requests with unsupported HTTP methods', () => {
    const result = convertPostmanCollection({
      info: { _postman_id: 'method-test' },
      item: [
        {
          name: 'Valid',
          request: { method: 'GET', header: [], url: 'https://example.com' }
        },
        {
          name: 'Invalid',
          request: { method: 'TRACE', header: [], url: 'https://example.com/trace' }
        }
      ]
    });

    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]?.name).toBe('Valid');
  });

  it('falls back to Imported Collection when name is blank', () => {
    const result = convertPostmanCollection({
      info: { _postman_id: 'blank-name' },
      item: []
    });

    expect(result.name).toBe('Imported Collection');
  });

  it('produces output that passes validateCollectionExport', () => {
    const converted = convertPostmanCollection(pintailFixture);
    const validated = validateCollectionExport(converted);

    expect(validated.harborclientVersion).toBe(1);
    expect(validated.harborclientExport).toBe('collection');
    expect(validated.requests).toHaveLength(2);
  });

  it('throws when data is not a Postman collection', () => {
    expect(() =>
      convertPostmanCollection({ harborclientVersion: 1, name: 'X', requests: [] })
    ).toThrow('Invalid Postman collection file');
  });
});
