import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { validateCollectionExport } from '#/main/storage/collectionData';
import {
  convertBrunoCollection,
  isBrunoCollectionDirectory,
  isBrunoCollectionManifest
} from '#/main/import/bruno';

const fixtureDir = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'bruno-sample');
const manifest = JSON.parse(readFileSync(join(fixtureDir, 'bruno.json'), 'utf-8'));

const pintailFixture = {
  info: {
    _postman_id: 'c04ab761-e6ce-4c46-bf94-5d5ff31ad50b',
    name: 'Pintail',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: []
};

const harborclientFixture = {
  harborclientVersion: 1,
  harborclientExport: 'collection',
  name: 'Native Collection',
  variables: [],
  headers: [],
  pre_request_script: '',
  post_request_script: '',
  folders: [],
  requests: []
};

describe('isBrunoCollectionManifest', () => {
  it('returns true for a valid bruno.json manifest', () => {
    expect(isBrunoCollectionManifest(manifest)).toBe(true);
  });

  it('returns false for Postman and HarborClient exports', () => {
    expect(isBrunoCollectionManifest(pintailFixture)).toBe(false);
    expect(isBrunoCollectionManifest(harborclientFixture)).toBe(false);
  });

  it('returns false for invalid manifests', () => {
    expect(isBrunoCollectionManifest(null)).toBe(false);
    expect(isBrunoCollectionManifest({ type: 'collection' })).toBe(false);
    expect(isBrunoCollectionManifest({ type: 'environment', name: 'Dev' })).toBe(false);
    expect(isBrunoCollectionManifest({ type: 'collection', name: '   ' })).toBe(false);
  });
});

describe('isBrunoCollectionDirectory', () => {
  it('returns true for the sample fixture directory', () => {
    expect(isBrunoCollectionDirectory(fixtureDir)).toBe(true);
  });

  it('returns false when bruno.json is missing', () => {
    expect(isBrunoCollectionDirectory(join(fixtureDir, 'users'))).toBe(false);
  });
});

describe('convertBrunoCollection', () => {
  it('converts the sample collection into a valid HarborClient export', () => {
    const converted = convertBrunoCollection(fixtureDir, manifest);
    expect(() => validateCollectionExport(converted)).not.toThrow();

    expect(converted.name).toBe('Bruno Sample API');
    expect(converted.harborclientExport).toBe('collection');
    expect(converted.harborclientVersion).toBe(1);
  });

  it('maps collection-level settings from collection.bru', () => {
    const converted = convertBrunoCollection(fixtureDir, manifest);

    expect(converted.auth?.type).toBe('bearer');
    expect(converted.auth?.bearer.token).toBe('{{collectionToken}}');
    expect(converted.headers).toEqual([
      { key: 'X-Collection-Header', value: 'bruno-import', enabled: true }
    ]);
    expect(converted.variables).toEqual([
      {
        key: 'collectionToken',
        value: 'secret-coll-token',
        defaultValue: '',
        share: true
      }
    ]);
    expect(converted.pre_request_script).toContain('collection pre');
    expect(converted.post_request_script).toContain('collection post');
  });

  it('flattens nested folders and imports HTTP requests', () => {
    const converted = convertBrunoCollection(fixtureDir, manifest);

    expect((converted.folders ?? []).map((folder) => folder.name).sort()).toEqual([
      'nested / child',
      'users'
    ]);
    expect(converted.requests).toHaveLength(2);

    const listUsers = converted.requests.find((request) => request.name === 'List Users');
    expect(listUsers).toMatchObject({
      method: 'GET',
      url: '{{baseUrl}}/users',
      folder_name: 'users',
      body_type: 'none',
      pre_request_script: expect.stringContaining('req.setHeader')
    });
    expect(listUsers?.params).toEqual([{ key: 'page', value: '1', enabled: true }]);
    expect(listUsers?.comment).toContain('Fetch all users');

    const ping = converted.requests.find((request) => request.name === 'Ping');
    expect(ping).toMatchObject({
      method: 'GET',
      url: 'https://api.example.com/ping',
      folder_name: 'nested / child',
      body_type: 'json',
      auth: {
        type: 'bearer',
        bearer: { token: 'req-token' }
      }
    });
    expect(ping?.body).toContain('"ping": true');
  });

  it('throws for invalid manifests', () => {
    expect(() => convertBrunoCollection(fixtureDir, { type: 'folder', name: 'x' })).toThrow(
      'Invalid Bruno collection manifest'
    );
  });
});
