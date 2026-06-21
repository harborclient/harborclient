import { describe, expect, it } from 'vitest';
import {
  collectionExportContainsScripts,
  validateCollectionExport
} from '#/main/db/collectionData';

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
  comment: '',
  sort_order: 0
};

const validV1Export = {
  harborclientVersion: 1 as const,
  name: 'Imported',
  variables: [{ key: 'baseUrl', value: 'https://example.com', defaultValue: '', share: true }],
  headers: [validKeyValue],
  pre_request_script: '',
  post_request_script: '',
  requests: [validRequest]
};

describe('validateCollectionExport', () => {
  it('accepts a minimal valid format version 1 export', () => {
    const result = validateCollectionExport(validV1Export);

    expect(result.harborclientVersion).toBe(1);
    expect(result.name).toBe('Imported');
    expect(result.headers).toEqual([validKeyValue]);
    expect(result.requests).toHaveLength(1);
    expect(result.folders).toBeUndefined();
  });

  it('accepts a minimal valid format version 2 export with folders', () => {
    const result = validateCollectionExport({
      ...validV1Export,
      harborclientVersion: 2,
      folders: [{ name: 'API', sort_order: 0 }],
      requests: [{ ...validRequest, folder_name: 'API' }]
    });

    expect(result.harborclientVersion).toBe(2);
    expect(result.folders).toEqual([{ name: 'API', sort_order: 0 }]);
  });

  it('rejects duplicate folder names', () => {
    expect(() =>
      validateCollectionExport({
        ...validV1Export,
        harborclientVersion: 2,
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
        harborclientVersion: 2,
        folders: [
          { name: ' API ', sort_order: 0 },
          { name: 'API', sort_order: 1 }
        ],
        requests: []
      })
    ).toThrow('Invalid collection file: folder 2 has a duplicate name');
  });

  it('rejects non-object payloads', () => {
    expect(() => validateCollectionExport(null)).toThrow(
      'Invalid collection file: expected a JSON object'
    );
  });

  it('rejects unsupported format versions', () => {
    expect(() =>
      validateCollectionExport({ harborclientVersion: 3, name: 'Bad', requests: [] })
    ).toThrow('Invalid collection file: unsupported format version');
  });

  it('rejects missing collection names', () => {
    expect(() =>
      validateCollectionExport({ harborclientVersion: 1, name: '   ', requests: [] })
    ).toThrow('Invalid collection file: collection name is required');
  });

  it('rejects invalid request methods', () => {
    expect(() =>
      validateCollectionExport({
        harborclientVersion: 1,
        name: 'Bad Request',
        requests: [{ ...validRequest, name: 'X', method: 'INVALID' }]
      })
    ).toThrow('Invalid collection file: request 1 has an invalid method');
  });

  it('rejects invalid request body types', () => {
    expect(() =>
      validateCollectionExport({
        harborclientVersion: 1,
        name: 'Bad Body',
        requests: [{ ...validRequest, name: 'X', body_type: 'xml' }]
      })
    ).toThrow('Invalid collection file: request 1 has an invalid body type');
  });

  it('rejects malformed collection header items', () => {
    expect(() =>
      validateCollectionExport({
        harborclientVersion: 2,
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
      name: 'Vars',
      variables: [{ key: 'token' }, { key: '', value: '', defaultValue: '' }, 42],
      requests: []
    });

    expect(result.variables).toEqual([{ key: 'token', value: '', defaultValue: '', share: false }]);
  });
});
