import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import {
  collectionDir,
  documentFileName,
  ensureHarborclientLayout,
  exportedDocumentToStoredRow,
  legacyDocumentsDir,
  manifestToCollectionExport,
  migrateFrontmatterHarborDocuments,
  migrateLegacyDocumentsFromCollectionDir,
  migrateUuidPrefixedHarborDocuments,
  readCollectionFromDir,
  readDocumentMetadataFromCollectionDir,
  readDocumentsFromHarborRoot,
  readAllEnvironments,
  resolveHarborclientRoot,
  writeCollectionToDir,
  writeDocumentsToHarborRoot,
  type CollectionManifest
} from '#/main/git/fileLayout';
import type { ExportedDocument } from '#/shared/types';

/**
 * Writes collection.json document metadata and harbor-root markdown content for tests.
 *
 * @param root - HarborClient data root.
 * @param collectionUuid - Stable collection uuid.
 * @param collectionName - Collection display name.
 * @param documents - Document export rows to persist.
 */
function writeTestHarborDocuments(
  root: string,
  collectionUuid: string,
  collectionName: string,
  documents: ExportedDocument[]
): void {
  const dir = collectionDir(root, collectionUuid, collectionName);
  const manifest: CollectionManifest = {
    harborclientVersion: 1,
    harborclientExport: 'collection',
    uuid: collectionUuid,
    name: collectionName,
    variables: [],
    headers: [],
    pre_request_script: '',
    post_request_script: '',
    folders: [],
    documents: documents.map(exportedDocumentToStoredRow),
    created_at: new Date().toISOString()
  };
  writeCollectionToDir(dir, manifest, []);
  writeDocumentsToHarborRoot(root, collectionUuid, documents);
}

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

  it('removes the previous slug file when a request is renamed', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    ensureHarborclientLayout(root);

    const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const requestUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
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

    const baseRequest = {
      uuid: requestUuid,
      name: 'Untitled Request',
      method: 'GET' as const,
      url: '',
      headers: [],
      params: [],
      auth: defaultAuth(),
      body: '',
      body_type: 'none' as const,
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: '',
      sort_order: 0,
      folder_name: null
    };

    const dir = collectionDir(root, uuid, manifest.name);
    writeCollectionToDir(dir, manifest, [baseRequest]);

    const requestsPath = join(dir, 'requests');
    expect(readdirSync(requestsPath)).toEqual([
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-untitled-request.json'
    ]);

    writeCollectionToDir(dir, manifest, [
      {
        ...baseRequest,
        name: 'Echo Get',
        url: 'https://echo.harborclient.com/get'
      }
    ]);

    expect(readdirSync(requestsPath)).toEqual([
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-echo-get.json'
    ]);

    const { requests } = readCollectionFromDir(dir);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.name).toBe('Echo Get');
    expect(requests[0]?.url).toBe('https://echo.harborclient.com/get');

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

  it('resolves blank or dot subdirectories to the repository root', () => {
    expect(resolveHarborclientRoot('/tmp/repo', '')).toBe('/tmp/repo');
    expect(resolveHarborclientRoot('/tmp/repo', '   ')).toBe('/tmp/repo');
    expect(resolveHarborclientRoot('/tmp/repo', '.')).toBe('/tmp/repo');
    expect(resolveHarborclientRoot('/tmp/repo', '.harborclient')).toBe('/tmp/repo/.harborclient');
  });

  it('reads request files with string-encoded script reference columns', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-string-scripts-'));
    ensureHarborclientLayout(root);
    const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const requestUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const dir = collectionDir(root, uuid, 'API');
    mkdirSync(join(dir, 'requests'), { recursive: true });
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
    writeFileSync(
      join(dir, 'requests', `${requestUuid}-health.json`),
      JSON.stringify({
        harborclientVersion: 1,
        harborclientExport: 'request',
        uuid: requestUuid,
        name: 'Health',
        method: 'GET',
        url: 'https://example.com/health',
        headers: [],
        params: [],
        body_type: 'none',
        body: '',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: '[]',
        post_request_scripts: '[]',
        comment: '',
        tags: '',
        sort_order: 0,
        folder_name: null
      }),
      'utf-8'
    );

    const { requests } = readCollectionFromDir(dir);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.name).toBe('Health');

    rmSync(root, { recursive: true, force: true });
  });

  it('round-trips harbor-root markdown documents without YAML frontmatter', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-harbor-docs-'));
    ensureHarborclientLayout(root);

    const collectionUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const documentUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    writeTestHarborDocuments(root, collectionUuid, 'API', [
      {
        uuid: documentUuid,
        name: 'README.md',
        content: '# Notes',
        sort_order: 0,
        folder_name: null,
        color: null
      }
    ]);

    const fileName = documentFileName('README.md');
    const filePath = join(root, fileName);
    expect(existsSync(filePath)).toBe(true);
    expect(fileName).toBe('README.md');

    const raw = readFileSync(filePath, 'utf-8');
    expect(raw).toBe('# Notes');
    expect(raw).not.toContain('collection_uuid:');

    const dir = collectionDir(root, collectionUuid, 'API');
    const metadata = readDocumentMetadataFromCollectionDir(dir);
    expect(metadata).toEqual([
      expect.objectContaining({
        uuid: documentUuid,
        name: 'README.md'
      })
    ]);

    const documents = readDocumentsFromHarborRoot(root, collectionUuid);
    expect(documents).toEqual([
      expect.objectContaining({
        uuid: documentUuid,
        name: 'README.md',
        content: '# Notes'
      })
    ]);

    rmSync(root, { recursive: true, force: true });
  });

  it('migrates legacy collection documents/ files to the harbor root', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-legacy-docs-'));
    ensureHarborclientLayout(root);

    const collectionUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const documentUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const dir = collectionDir(root, collectionUuid, 'API');
    writeCollectionToDir(
      dir,
      {
        harborclientVersion: 1,
        harborclientExport: 'collection',
        uuid: collectionUuid,
        name: 'API',
        variables: [],
        headers: [],
        pre_request_script: '',
        post_request_script: '',
        folders: [],
        created_at: new Date().toISOString()
      },
      []
    );
    const legacyDir = legacyDocumentsDir(dir);
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(
      join(legacyDir, 'notes.md'),
      [
        '---',
        `uuid: ${documentUuid}`,
        'folder_uuid: null',
        'sort_order: 0',
        '---',
        '',
        '# Legacy'
      ].join('\n'),
      'utf-8'
    );

    migrateLegacyDocumentsFromCollectionDir(dir, collectionUuid, root);

    const fileName = documentFileName('notes.md');
    expect(existsSync(join(root, fileName))).toBe(true);
    expect(fileName).toBe('notes.md');
    expect(existsSync(legacyDir)).toBe(false);

    const documents = readDocumentsFromHarborRoot(root, collectionUuid);
    expect(documents[0]?.content.trim()).toBe('# Legacy');

    rmSync(root, { recursive: true, force: true });
  });

  it('appends .md when the document name omits the extension', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-doc-ext-'));
    ensureHarborclientLayout(root);

    const collectionUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const documentUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    writeTestHarborDocuments(root, collectionUuid, 'API', [
      {
        uuid: documentUuid,
        name: 'Notes',
        content: '# Notes',
        sort_order: 0,
        folder_name: null,
        color: null
      }
    ]);

    expect(documentFileName('Notes')).toBe('Notes.md');
    expect(existsSync(join(root, 'Notes.md'))).toBe(true);

    rmSync(root, { recursive: true, force: true });
  });

  it('rejects case-insensitive duplicate document filenames across the harbor root', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-doc-collision-'));
    ensureHarborclientLayout(root);

    const collectionA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const collectionB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const documentA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const documentB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    writeTestHarborDocuments(root, collectionA, 'API', [
      {
        uuid: documentA,
        name: 'README.md',
        content: '# A',
        sort_order: 0,
        folder_name: null,
        color: null
      }
    ]);

    const dirB = collectionDir(root, collectionB, 'Docs');
    writeCollectionToDir(
      dirB,
      {
        harborclientVersion: 1,
        harborclientExport: 'collection',
        uuid: collectionB,
        name: 'Docs',
        variables: [],
        headers: [],
        pre_request_script: '',
        post_request_script: '',
        folders: [],
        created_at: new Date().toISOString()
      },
      []
    );

    expect(() =>
      writeDocumentsToHarborRoot(root, collectionB, [
        {
          uuid: documentB,
          name: 'readme.md',
          content: '# B',
          sort_order: 0,
          folder_name: null,
          color: null
        }
      ])
    ).toThrow(/already exists/i);

    rmSync(root, { recursive: true, force: true });
  });

  it('migrates UUID-prefixed harbor-root markdown files to case-preserving names', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-doc-migrate-'));
    ensureHarborclientLayout(root);

    const collectionUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const documentUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const legacyFileName = `${documentUuid}-readme.md`;
    const dir = collectionDir(root, collectionUuid, 'API');
    writeCollectionToDir(
      dir,
      {
        harborclientVersion: 1,
        harborclientExport: 'collection',
        uuid: collectionUuid,
        name: 'API',
        variables: [],
        headers: [],
        pre_request_script: '',
        post_request_script: '',
        folders: [],
        documents: [
          {
            uuid: documentUuid,
            name: 'README.md',
            folder_uuid: null,
            sort_order: 0,
            color: null
          }
        ],
        created_at: new Date().toISOString()
      },
      []
    );

    writeFileSync(join(root, legacyFileName), '# Harbor', 'utf-8');

    migrateUuidPrefixedHarborDocuments(root);

    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, legacyFileName))).toBe(false);
    expect(readFileSync(join(root, 'README.md'), 'utf-8')).toBe('# Harbor');

    const documents = readDocumentsFromHarborRoot(root, collectionUuid);
    expect(documents[0]?.name).toBe('README.md');
    expect(documents[0]?.content.trim()).toBe('# Harbor');

    rmSync(root, { recursive: true, force: true });
  });

  it('migrates legacy YAML frontmatter into collection.json and strips markdown files', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-doc-frontmatter-'));
    ensureHarborclientLayout(root);

    const collectionUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const documentUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const dir = collectionDir(root, collectionUuid, 'API');
    writeCollectionToDir(
      dir,
      {
        harborclientVersion: 1,
        harborclientExport: 'collection',
        uuid: collectionUuid,
        name: 'API',
        variables: [],
        headers: [],
        pre_request_script: '',
        post_request_script: '',
        folders: [],
        created_at: new Date().toISOString()
      },
      []
    );

    writeFileSync(
      join(root, 'README.md'),
      [
        '---',
        `uuid: ${documentUuid}`,
        `collection_uuid: ${collectionUuid}`,
        'name: README.md',
        'folder_uuid: null',
        'sort_order: 0',
        '---',
        '',
        '# Clean body'
      ].join('\n'),
      'utf-8'
    );

    migrateFrontmatterHarborDocuments(root);

    expect(readFileSync(join(root, 'README.md'), 'utf-8')).toBe('# Clean body');
    const metadata = readDocumentMetadataFromCollectionDir(dir);
    expect(metadata).toEqual([
      expect.objectContaining({
        uuid: documentUuid,
        name: 'README.md'
      })
    ]);

    rmSync(root, { recursive: true, force: true });
  });
});
