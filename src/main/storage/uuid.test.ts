import { describe, expect, it } from 'vitest';
import {
  generateDocumentUuid,
  mintFreshCollectionExportUuids,
  mintFreshEnvironmentExportUuid,
  mintFreshRequestExportUuid,
  resolveImportUuid
} from '#/main/storage/uuid';
import type { CollectionExport, EnvironmentExport, RequestExport } from '#/shared/types';

const sampleCollectionExport: CollectionExport = {
  harborclientVersion: 1,
  harborclientExport: 'collection',
  uuid: '11111111-1111-4111-8111-111111111111',
  name: 'API',
  variables: [],
  headers: [],
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  folders: [
    {
      uuid: '55555555-5555-4555-8555-555555555555',
      name: 'Auth',
      sort_order: 0
    }
  ],
  requests: [
    {
      uuid: '22222222-2222-4222-8222-222222222222',
      name: 'Health',
      method: 'GET',
      url: 'https://example.com/health',
      headers: [],
      params: [],
      body: '',
      body_type: 'none',
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: '',
      sort_order: 0,
      folder_uuid: '55555555-5555-4555-8555-555555555555',
      folder_name: 'Auth'
    }
  ]
};

describe('generateDocumentUuid', () => {
  it('returns distinct RFC 4122 uuid strings', () => {
    const first = generateDocumentUuid();
    const second = generateDocumentUuid();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(second).not.toBe(first);
  });
});

describe('resolveImportUuid', () => {
  it('returns the trimmed payload uuid when present', () => {
    expect(resolveImportUuid(' 11111111-1111-4111-8111-111111111111 ')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
  });

  it('mints a uuid when the payload uuid is absent or blank', () => {
    expect(resolveImportUuid(undefined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(resolveImportUuid('   ')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});

describe('mintFreshCollectionExportUuids', () => {
  it('assigns new uuids to the collection, folders, and every request', () => {
    const copy = mintFreshCollectionExportUuids(sampleCollectionExport);

    expect(copy.uuid).not.toBe(sampleCollectionExport.uuid);
    expect(copy.folders?.[0]?.uuid).not.toBe(sampleCollectionExport.folders?.[0]?.uuid);
    expect(copy.requests[0]?.uuid).not.toBe(sampleCollectionExport.requests[0]?.uuid);
    expect(copy.requests[0]?.folder_uuid).toBe(copy.folders?.[0]?.uuid);
    expect(copy.name).toBe(sampleCollectionExport.name);
  });
});

describe('mintFreshRequestExportUuid', () => {
  it('assigns a new uuid while preserving request fields', () => {
    const request: RequestExport = {
      harborclientVersion: 1,
      harborclientExport: 'request',
      uuid: '33333333-3333-4333-8333-333333333333',
      name: 'Ping',
      method: 'GET',
      url: 'https://example.com/ping',
      headers: [],
      params: [],
      body: '',
      body_type: 'none',
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: ''
    };

    const copy = mintFreshRequestExportUuid(request);

    expect(copy.uuid).not.toBe(request.uuid);
    expect(copy.name).toBe('Ping');
  });
});

describe('mintFreshEnvironmentExportUuid', () => {
  it('assigns a new uuid while preserving environment fields', () => {
    const environment: EnvironmentExport = {
      harborclientVersion: 1,
      harborclientExport: 'environment',
      uuid: '44444444-4444-4444-8444-444444444444',
      name: 'Dev',
      variables: []
    };

    const copy = mintFreshEnvironmentExportUuid(environment);

    expect(copy.uuid).not.toBe(environment.uuid);
    expect(copy.name).toBe('Dev');
  });
});
