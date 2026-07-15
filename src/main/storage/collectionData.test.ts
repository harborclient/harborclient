import { describe, expect, it } from 'vitest';
import { defaultOAuth2Config } from '#/shared/auth';
import {
  collectionExportContainsScripts,
  requestExportContainsScripts,
  validateCollectionExport,
  validateEnvironmentExport,
  validateRequestExport,
  validateRunResultsExport
} from './collectionData';

const validKeyValue = { key: 'Accept', value: 'application/json', enabled: true };

const validRequest = {
  name: 'Health',
  method: 'GET' as const,
  url: 'https://example.com/health',
  headers: [] as (typeof validKeyValue)[],
  params: [] as (typeof validKeyValue)[],
  body: '',
  body_type: 'none' as const,
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  comment: '',
  tags: '',
  sort_order: 0
};

const validV1Export = {
  harborclientVersion: 1 as const,
  harborclientExport: 'collection' as const,
  name: 'Imported',
  variables: [{ key: 'baseUrl', value: 'https://example.com', defaultValue: '', share: true }],
  headers: [validKeyValue],
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  requests: [validRequest]
};

const validRequestExport = {
  harborclientVersion: 1 as const,
  harborclientExport: 'request' as const,
  name: 'Health',
  method: 'GET' as const,
  url: 'https://example.com/health',
  headers: [] as (typeof validKeyValue)[],
  params: [] as (typeof validKeyValue)[],
  body: '',
  body_type: 'none' as const,
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  comment: '',
  tags: ''
};

describe('validateCollectionExport', () => {
  it('accepts optional document uuids on collection, request, folder, and environment exports', () => {
    const collection = validateCollectionExport({
      ...validV1Export,
      uuid: '11111111-1111-4111-8111-111111111111',
      folders: [{ uuid: '55555555-5555-4555-8555-555555555555', name: 'API', sort_order: 0 }],
      requests: [
        {
          ...validRequest,
          uuid: '22222222-2222-4222-8222-222222222222',
          folder_uuid: '55555555-5555-4555-8555-555555555555',
          folder_name: 'API'
        }
      ]
    });
    expect(collection.uuid).toBe('11111111-1111-4111-8111-111111111111');
    expect(collection.requests[0]?.uuid).toBe('22222222-2222-4222-8222-222222222222');
    expect(collection.folders?.[0]?.uuid).toBe('55555555-5555-4555-8555-555555555555');
    expect(collection.requests[0]?.folder_uuid).toBe('55555555-5555-4555-8555-555555555555');

    const request = validateRequestExport({
      ...validRequestExport,
      uuid: '33333333-3333-4333-8333-333333333333'
    });
    expect(request.uuid).toBe('33333333-3333-4333-8333-333333333333');

    const environment = validateEnvironmentExport({
      harborclientVersion: 1,
      harborclientExport: 'environment',
      uuid: '44444444-4444-4444-8444-444444444444',
      name: 'Dev',
      variables: []
    });
    expect(environment.uuid).toBe('44444444-4444-4444-8444-444444444444');
  });

  it('accepts a minimal valid format version 1 export', () => {
    const result = validateCollectionExport(validV1Export);

    expect(result.harborclientVersion).toBe(1);
    expect(result.harborclientExport).toBe('collection');
    expect(result.name).toBe('Imported');
    expect(result.headers).toEqual([validKeyValue]);
    expect(result.requests).toHaveLength(1);
    expect(result.folders).toEqual([]);
  });

  it('accepts a valid export with folders', () => {
    const result = validateCollectionExport({
      ...validV1Export,
      folders: [{ name: 'API', sort_order: 0 }],
      requests: [{ ...validRequest, folder_name: 'API' }]
    });

    expect(result.harborclientVersion).toBe(1);
    expect(result.folders).toHaveLength(1);
    expect(result.folders?.[0]).toMatchObject({ name: 'API', sort_order: 0, color: null });
  });

  it('rejects legacy format version 2 exports', () => {
    expect(() =>
      validateCollectionExport({
        ...validV1Export,
        harborclientVersion: 2,
        folders: [{ name: 'API', sort_order: 0 }],
        requests: [{ ...validRequest, folder_name: 'API' }]
      })
    ).toThrow('Invalid collection file: unsupported format version');
  });

  it('rejects duplicate folder names', () => {
    expect(() =>
      validateCollectionExport({
        ...validV1Export,
        folders: [
          { name: 'API', sort_order: 0 },
          { name: 'API', sort_order: 1 }
        ],
        requests: []
      })
    ).toThrow('Invalid collection file: folder 2 has a duplicate name');
  });

  it('rejects duplicate folder names after whitespace normalization', () => {
    expect(() =>
      validateCollectionExport({
        ...validV1Export,
        folders: [
          { name: ' API ', sort_order: 0 },
          { name: 'API', sort_order: 1 }
        ],
        requests: []
      })
    ).toThrow('Invalid collection file: folder 2 has a duplicate name');
  });

  it('rejects duplicate folder uuids', () => {
    expect(() =>
      validateCollectionExport({
        ...validV1Export,
        folders: [
          { uuid: '55555555-5555-4555-8555-555555555555', name: 'API', sort_order: 0 },
          { uuid: '55555555-5555-4555-8555-555555555555', name: 'Auth', sort_order: 1 }
        ],
        requests: []
      })
    ).toThrow('Invalid collection file: folder 2 has a duplicate uuid');
  });

  it('rejects non-object payloads', () => {
    expect(() => validateCollectionExport(null)).toThrow(
      'Invalid collection file: expected a JSON object'
    );
  });

  it('rejects unsupported format versions', () => {
    expect(() =>
      validateCollectionExport({
        harborclientVersion: 3,
        harborclientExport: 'collection',
        name: 'Bad',
        requests: []
      })
    ).toThrow('Invalid collection file: unsupported format version');
  });

  it('rejects wrong harborclientExport discriminator', () => {
    expect(() =>
      validateCollectionExport({ ...validV1Export, harborclientExport: 'request' })
    ).toThrow('Invalid collection file: not a HarborClient collection export');
  });

  it('rejects missing collection names', () => {
    expect(() =>
      validateCollectionExport({
        harborclientVersion: 1,
        harborclientExport: 'collection',
        name: '   ',
        requests: []
      })
    ).toThrow('Invalid collection file: collection name is required');
  });

  it('rejects invalid request methods', () => {
    expect(() =>
      validateCollectionExport({
        harborclientVersion: 1,
        harborclientExport: 'collection',
        name: 'Bad Request',
        requests: [{ ...validRequest, name: 'X', method: 'INVALID' }]
      })
    ).toThrow('Invalid collection file: request 1 has an invalid method');
  });

  it('rejects invalid request body types', () => {
    expect(() =>
      validateCollectionExport({
        harborclientVersion: 1,
        harborclientExport: 'collection',
        name: 'Bad Body',
        requests: [{ ...validRequest, name: 'X', body_type: 'xml' }]
      })
    ).toThrow('Invalid collection file: request 1 has an invalid body type');
  });

  it('rejects malformed collection header items', () => {
    expect(() =>
      validateCollectionExport({
        harborclientVersion: 1,
        harborclientExport: 'collection',
        name: 'Test',
        variables: [],
        headers: [{ key: 123, value: null }],
        requests: []
      })
    ).toThrow('Invalid collection file: collection headers are malformed');
  });

  it('rejects malformed request header items', () => {
    expect(() =>
      validateCollectionExport({
        harborclientVersion: 1,
        harborclientExport: 'collection',
        name: 'Test',
        requests: [
          {
            ...validRequest,
            headers: [{ key: 123, value: 'x', enabled: true }]
          }
        ]
      })
    ).toThrow('Invalid collection file: request 1 has invalid headers');
  });

  it('rejects malformed request param items', () => {
    expect(() =>
      validateCollectionExport({
        harborclientVersion: 1,
        harborclientExport: 'collection',
        name: 'Test',
        requests: [
          {
            ...validRequest,
            params: [{ key: 'q', value: null, enabled: true }]
          }
        ]
      })
    ).toThrow('Invalid collection file: request 1 has invalid params');
  });

  it('detects collection-level scripts', () => {
    expect(collectionExportContainsScripts(validV1Export)).toBe(false);
    expect(
      collectionExportContainsScripts({
        ...validV1Export,
        pre_request_script: 'console.log("pre");'
      })
    ).toBe(true);
    expect(
      collectionExportContainsScripts({
        ...validV1Export,
        post_request_script: '   console.log("post");   '
      })
    ).toBe(true);
  });

  it('detects request-level scripts', () => {
    expect(
      collectionExportContainsScripts({
        ...validV1Export,
        requests: [{ ...validRequest, pre_request_script: 'console.log("req");' }]
      })
    ).toBe(true);
    expect(
      collectionExportContainsScripts({
        ...validV1Export,
        requests: [{ ...validRequest, post_request_script: 'console.log("req");' }]
      })
    ).toBe(true);
    expect(
      collectionExportContainsScripts({
        ...validV1Export,
        requests: [{ ...validRequest, pre_request_script: '   ', post_request_script: '\n' }]
      })
    ).toBe(false);
  });

  it('normalizes lenient variable rows and filters empty entries', () => {
    const result = validateCollectionExport({
      harborclientVersion: 1,
      harborclientExport: 'collection',
      name: 'Vars',
      variables: [{ key: 'token' }, { key: '', value: '', defaultValue: '' }, 42],
      requests: []
    });

    expect(result.variables).toEqual([{ key: 'token', value: '', defaultValue: '', share: false }]);
  });

  it('accepts collection auth without oauth2 and normalizes defaults', () => {
    const result = validateCollectionExport({
      ...validV1Export,
      auth: {
        type: 'bearer',
        basic: { username: '', password: '' },
        bearer: { token: '{{idToken}}' }
      },
      requests: []
    });

    expect(result.auth?.type).toBe('bearer');
    expect(result.auth?.bearer.token).toBe('{{idToken}}');
    expect(result.auth?.oauth2).toEqual(defaultOAuth2Config());
  });

  it('accepts minimal bearer-only collection auth', () => {
    const result = validateCollectionExport({
      ...validV1Export,
      auth: {
        type: 'bearer',
        bearer: { token: 'tok' }
      },
      requests: []
    });

    expect(result.auth?.type).toBe('bearer');
    expect(result.auth?.bearer.token).toBe('tok');
    expect(result.auth?.basic).toEqual({ username: '', password: '' });
    expect(result.auth?.oauth2).toEqual(defaultOAuth2Config());
  });

  it('accepts request auth without oauth2 and normalizes defaults', () => {
    const result = validateCollectionExport({
      ...validV1Export,
      requests: [
        {
          ...validRequest,
          auth: {
            type: 'none',
            basic: { username: '', password: '' },
            bearer: { token: '' }
          }
        }
      ]
    });

    expect(result.requests[0]?.auth?.type).toBe('none');
    expect(result.requests[0]?.auth?.oauth2).toEqual(defaultOAuth2Config());
  });
});

describe('validateRequestExport', () => {
  it('accepts a minimal valid request export', () => {
    const result = validateRequestExport(validRequestExport);

    expect(result.harborclientVersion).toBe(1);
    expect(result.harborclientExport).toBe('request');
    expect(result.name).toBe('Health');
    expect(result).not.toHaveProperty('folder_name');
    expect(result).not.toHaveProperty('folder_id');
    expect(result).not.toHaveProperty('sort_order');
  });

  it('rejects non-object payloads', () => {
    expect(() => validateRequestExport(null)).toThrow(
      'Invalid request file: expected a JSON object'
    );
  });

  it('rejects wrong harborclientExport discriminator', () => {
    expect(() =>
      validateRequestExport({ ...validRequestExport, harborclientExport: 'collection' })
    ).toThrow('Invalid request file: not a HarborClient request export');
  });

  it('rejects unsupported format versions', () => {
    expect(() => validateRequestExport({ ...validRequestExport, harborclientVersion: 2 })).toThrow(
      'Invalid request file: unsupported format version'
    );
  });

  it('rejects missing request names', () => {
    expect(() => validateRequestExport({ ...validRequestExport, name: '   ' })).toThrow(
      'Invalid request file: request name is required'
    );
  });

  it('rejects invalid request methods', () => {
    expect(() => validateRequestExport({ ...validRequestExport, method: 'INVALID' })).toThrow(
      'Invalid request file: request has an invalid method'
    );
  });

  it('detects request-level scripts', () => {
    expect(requestExportContainsScripts(validRequestExport)).toBe(false);
    expect(
      requestExportContainsScripts({
        ...validRequestExport,
        pre_request_script: 'console.log("pre");'
      })
    ).toBe(true);
  });

  it('preserves script reference arrays and strips expanded on validate', () => {
    const result = validateRequestExport({
      ...validRequestExport,
      pre_request_scripts: [
        { id: 's1', enabled: true, kind: 'inline', code: 'console.log("one");', expanded: true },
        {
          id: 's2',
          enabled: true,
          kind: 'snippet',
          snippetUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        }
      ],
      post_request_scripts: [
        { id: 's3', enabled: false, kind: 'inline', code: 'console.log("post");', expanded: false }
      ]
    });

    expect(result.pre_request_scripts).toHaveLength(2);
    expect(result.pre_request_scripts?.[0]).not.toHaveProperty('expanded');
    expect(result.pre_request_scripts?.[1]?.kind).toBe('snippet');
    expect(result.post_request_scripts).toHaveLength(1);
    expect(result.post_request_scripts?.[0]?.enabled).toBe(false);
  });
});

describe('validateEnvironmentExport', () => {
  const validEnvironmentExport = {
    harborclientVersion: 1 as const,
    harborclientExport: 'environment' as const,
    name: 'Staging',
    variables: [
      { key: 'baseUrl', value: 'https://staging.example.com', defaultValue: '', share: true }
    ]
  };

  it('accepts a minimal valid environment export', () => {
    const result = validateEnvironmentExport(validEnvironmentExport);

    expect(result.harborclientVersion).toBe(1);
    expect(result.harborclientExport).toBe('environment');
    expect(result.name).toBe('Staging');
    expect(result.variables).toHaveLength(1);
  });

  it('rejects non-object payloads', () => {
    expect(() => validateEnvironmentExport(null)).toThrow(
      'Invalid environment file: expected a JSON object'
    );
  });

  it('rejects wrong harborclientExport discriminator', () => {
    expect(() =>
      validateEnvironmentExport({ ...validEnvironmentExport, harborclientExport: 'collection' })
    ).toThrow('Invalid environment file: not a HarborClient environment export');
  });

  it('rejects unsupported format versions', () => {
    expect(() =>
      validateEnvironmentExport({ ...validEnvironmentExport, harborclientVersion: 2 })
    ).toThrow('Invalid environment file: unsupported format version');
  });

  it('rejects missing environment names', () => {
    expect(() => validateEnvironmentExport({ ...validEnvironmentExport, name: '   ' })).toThrow(
      'Invalid environment file: environment name is required'
    );
  });
});

const validRunResultsExport = {
  harborclientVersion: 1 as const,
  harborclientExport: 'collection-run-results' as const,
  delay: 100,
  stopOnFailure: false,
  environment: { mode: 'active' as const, id: null, name: 'Active environment' },
  collection: {
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Demo API'
  },
  results: [
    {
      requestId: 1,
      requestName: 'Health',
      requestMethod: 'GET' as const,
      status: 'passed' as const,
      testsPassed: 1,
      testsFailed: 0
    }
  ]
};

describe('validateRunResultsExport', () => {
  it('accepts a valid collection run-results export', () => {
    const result = validateRunResultsExport(validRunResultsExport);
    expect(result.harborclientExport).toBe('collection-run-results');
    expect(result.results).toHaveLength(1);
  });

  it('rejects non-object payloads', () => {
    expect(() => validateRunResultsExport(null)).toThrow(
      'Invalid run results file: expected a JSON object'
    );
  });

  it('rejects wrong harborclientExport discriminator', () => {
    expect(() =>
      validateRunResultsExport({ ...validRunResultsExport, harborclientExport: 'collection' })
    ).toThrow('Invalid run results file: not a HarborClient run results export');
  });

  it('rejects request run exports without request metadata', () => {
    expect(() =>
      validateRunResultsExport({
        ...validRunResultsExport,
        harborclientExport: 'request-run-results'
      })
    ).toThrow(
      'Invalid run results file: request: request metadata is required for request run results'
    );
  });
});
