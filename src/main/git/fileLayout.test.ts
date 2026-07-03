import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import {
  collectionDir,
  ensureHarborclientLayout,
  manifestToCollectionExport,
  readCollectionFromDir,
  readAllEnvironments,
  writeCollectionToDir,
  type CollectionManifest
} from '#/main/git/fileLayout';

describe('git file layout', () => {
  it('round-trips collection manifest and request files', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    ensureHarborclientLayout(root);

    const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const manifest: CollectionManifest = {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid,
      name: 'API',
      variables: [
        { key: 'shared', value: 'visible', defaultValue: '', share: true },
        { key: 'private', value: 'secret', defaultValue: '', share: false }
      ],
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
      auth: defaultAuth(),
      pre_request_script: 'pre',
      post_request_script: 'post',
      folders: [],
      created_at: '2026-01-01T00:00:00.000Z'
    };

    const dir = collectionDir(root, uuid, manifest.name);
    writeCollectionToDir(dir, manifest, [
      {
        uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Health',
        method: 'GET',
        url: 'https://example.com/health',
        headers: [],
        params: [],
        auth: defaultAuth(),
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
        sort_order: 0,
        folder_name: null
      }
    ]);

    const collectionJson = JSON.parse(readFileSync(join(dir, 'collection.json'), 'utf-8'));
    expect(collectionJson.variables.find((v: { key: string }) => v.key === 'private').value).toBe(
      ''
    );

    const { manifest: loadedManifest, requests } = readCollectionFromDir(dir);
    const exported = manifestToCollectionExport(loadedManifest, requests);

    expect(exported.name).toBe('API');
    expect(exported.requests.length).toBe(1);
    expect(exported.requests[0]?.name).toBe('Health');
    expect(exported.requests[0]?.pre_request_scripts).toBeUndefined();
    expect(exported.requests[0]?.tags).toBe('');
    expect(existsSync(join(root, '.gitignore'))).toBe(true);

    rmSync(root, { recursive: true, force: true });
  });

  it('round-trips script arrays and tags in request files', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    ensureHarborclientLayout(root);

    const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const preScripts = [
      {
        id: 'pre-1',
        enabled: true,
        kind: 'inline' as const,
        code: 'console.log("pre");'
      }
    ];
    const manifest: CollectionManifest = {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid,
      name: 'API',
      variables: [],
      headers: [],
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      folders: [],
      created_at: '2026-01-01T00:00:00.000Z'
    };

    const dir = collectionDir(root, uuid, manifest.name);
    writeCollectionToDir(dir, manifest, [
      {
        uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Health',
        method: 'GET',
        url: 'https://example.com/health',
        headers: [],
        params: [],
        auth: defaultAuth(),
        body: '',
        body_type: 'none',
        pre_request_script: 'console.log("pre");',
        post_request_script: '',
        pre_request_scripts: preScripts,
        post_request_scripts: [],
        comment: '',
        tags: 'api, smoke',
        sort_order: 0,
        folder_name: null
      }
    ]);

    const requestFile = join(dir, 'requests', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-health.json');
    const requestJson = JSON.parse(readFileSync(requestFile, 'utf-8'));
    expect(requestJson.pre_request_scripts).toEqual(preScripts);
    expect(requestJson.tags).toBe('api, smoke');

    const { requests } = readCollectionFromDir(dir);
    const exported = manifestToCollectionExport(manifest, requests);
    expect(exported.requests[0]?.pre_request_scripts).toEqual(preScripts);
    expect(exported.requests[0]?.tags).toBe('api, smoke');

    rmSync(root, { recursive: true, force: true });
  });

  it('throws a descriptive error when collection.json contains invalid JSON', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    ensureHarborclientLayout(root);
    const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const dir = collectionDir(root, uuid, 'API');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'collection.json'), '<<<<<<< HEAD\n{ invalid\n', 'utf-8');

    expect(() => readCollectionFromDir(dir)).toThrow(/Failed to parse JSON in .*collection\.json/);

    rmSync(root, { recursive: true, force: true });
  });

  it('throws a descriptive error when a request file contains invalid JSON', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    ensureHarborclientLayout(root);
    const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const dir = collectionDir(root, uuid, 'API');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'collection.json'),
      JSON.stringify({
        harborclientVersion: 1,
        harborclientExport: 'collection',
        uuid,
        name: 'API',
        variables: [],
        headers: [],
        folders: [],
        created_at: '2026-01-01T00:00:00.000Z'
      }),
      'utf-8'
    );
    const requestsDir = join(dir, 'requests');
    mkdirSync(requestsDir, { recursive: true });
    writeFileSync(
      join(requestsDir, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-health.json'),
      '<<<<<<< HEAD\n{ invalid\n',
      'utf-8'
    );

    expect(() => readCollectionFromDir(dir)).toThrow(
      /Failed to parse JSON in .*bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-health\.json/
    );

    rmSync(root, { recursive: true, force: true });
  });

  it('throws a descriptive error when an environment file contains invalid JSON', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    ensureHarborclientLayout(root);
    const envDir = join(root, 'environments');
    writeFileSync(
      join(envDir, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc-local.json'),
      '<<<<<<< HEAD\n{ invalid\n',
      'utf-8'
    );

    expect(() => readAllEnvironments(root)).toThrow(
      /Failed to parse JSON in .*cccccccc-cccc-4ccc-8ccc-cccccccccccc-local\.json/
    );

    rmSync(root, { recursive: true, force: true });
  });
});
