import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import {
  assertCollectionDirAvailable,
  assertDocumentFilenameAvailable,
  assertExportFilenameAvailable,
  classifyHarborChangePath,
  collectionDirPath,
  collectionManifestPath,
  displayNameFromHarborChange,
  documentFileName,
  ensureHarborclientLayout,
  environmentFilePath,
  exportFileName,
  isGitignoredHarborExportFileName,
  listCollectionFoldersOnDisk,
  readAllEnvironments,
  readCollectionFromFolder,
  resolveHarborclientRoot,
  writeCollectionToFolder
} from '#/main/git/fileLayout';
import type { CollectionExport } from '#/shared/types';

/**
 * Builds a minimal collection export for layout tests.
 *
 * @param overrides - Optional export field overrides.
 */
function buildTestCollectionExport(overrides: Partial<CollectionExport> = {}): CollectionExport {
  return {
    harborclientVersion: 1,
    harborclientExport: 'collection',
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'API',
    variables: [],
    headers: [],
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    folders: [],
    requests: [],
    documents: [],
    ...overrides
  };
}

describe('git file layout', () => {
  it('round-trips a collection export as a folder with per-request JSON files', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    ensureHarborclientLayout(root);

    const exportData = buildTestCollectionExport({
      variables: [
        { key: 'shared', value: 'visible', defaultValue: '', share: true },
        { key: 'private', value: 'secret', defaultValue: '', share: false }
      ],
      requests: [
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
          comment: '',
          tags: '',
          sort_order: 0,
          folder_name: null
        }
      ],
      documents: [
        {
          uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          name: 'README.md',
          content: '# Notes',
          sort_order: 0,
          folder_name: null,
          color: null
        }
      ]
    });

    const dirPath = writeCollectionToFolder(root, exportData);
    expect(existsSync(dirPath)).toBe(true);
    expect(existsSync(collectionManifestPath(dirPath))).toBe(true);
    expect(existsSync(join(dirPath, 'req-health.json'))).toBe(true);
    expect(existsSync(join(dirPath, documentFileName('README.md')))).toBe(true);

    const loaded = readCollectionFromFolder(dirPath);
    expect(loaded.name).toBe('API');
    expect(loaded.requests).toHaveLength(1);
    expect(loaded.requests[0]?.name).toBe('Health');
    expect(loaded.documents?.[0]?.content).toBe('# Notes');
    expect(loaded.variables.find((v) => v.key === 'private')?.value).toBe('');
    expect(existsSync(join(root, '.gitignore'))).toBe(true);

    const manifest = JSON.parse(readFileSync(collectionManifestPath(dirPath), 'utf-8')) as {
      requests: string[];
    };
    expect(manifest.requests).toEqual(['req-health.json']);

    rmSync(root, { recursive: true, force: true });
  });

  it('removes the previous collection folder when a collection is renamed', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    const oldDirPath = writeCollectionToFolder(
      root,
      buildTestCollectionExport({ uuid, name: 'Old Name' })
    );
    expect(existsSync(oldDirPath)).toBe(true);

    const newDirPath = writeCollectionToFolder(
      root,
      buildTestCollectionExport({ uuid, name: 'New Name' }),
      { previousDirPath: oldDirPath }
    );
    expect(existsSync(newDirPath)).toBe(true);
    expect(existsSync(oldDirPath)).toBe(false);

    rmSync(root, { recursive: true, force: true });
  });

  it('preserves request filenames for unchanged request uuids', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    const exportData = buildTestCollectionExport({
      requests: [
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
          comment: '',
          tags: '',
          sort_order: 0,
          folder_name: null
        }
      ]
    });

    const dirPath = writeCollectionToFolder(root, exportData);
    writeCollectionToFolder(root, {
      ...exportData,
      requests: [
        {
          ...exportData.requests[0]!,
          url: 'https://example.com/health-check'
        }
      ]
    });

    expect(existsSync(join(dirPath, 'req-health.json'))).toBe(true);
    expect(readdirSync(dirPath).filter((name) => name.startsWith('req-'))).toEqual([
      'req-health.json'
    ]);

    rmSync(root, { recursive: true, force: true });
  });

  it('lists collection folders on disk by manifest discriminator', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    writeCollectionToFolder(root, buildTestCollectionExport());
    writeFileSync(environmentFilePath(root, 'Staging'), '{"harborclientExport":"environment"}');

    expect(listCollectionFoldersOnDisk(root)).toHaveLength(1);
    expect(exportFileName('collection', 'API')).toBe('collection-api.json');
    expect(exportFileName('environment', 'Staging')).toBe('environment-staging.json');

    rmSync(root, { recursive: true, force: true });
  });

  it('rejects collection folder names that would match harbor gitignore globs', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    expect(isGitignoredHarborExportFileName('collection-local.json')).toBe(true);
    expect(isGitignoredHarborExportFileName('local-api.json')).toBe(true);
    expect(isGitignoredHarborExportFileName('collection-api.json')).toBe(false);

    expect(() =>
      assertCollectionDirAvailable(root, 'Local', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    ).toThrow(/ignored by the HarborClient .gitignore/i);

    rmSync(root, { recursive: true, force: true });
  });

  it('rejects case-insensitive duplicate collection folder names', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    writeCollectionToFolder(
      root,
      buildTestCollectionExport({
        uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'API'
      })
    );

    expect(() =>
      assertCollectionDirAvailable(root, 'api', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    ).toThrow(/already exists/i);

    rmSync(root, { recursive: true, force: true });
  });

  it('allows the same slug across different export kinds', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    writeCollectionToFolder(
      root,
      buildTestCollectionExport({
        uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Prod'
      })
    );

    expect(() =>
      assertExportFilenameAvailable(
        root,
        'environment',
        'Prod',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      )
    ).not.toThrow();

    rmSync(root, { recursive: true, force: true });
  });

  it('throws a descriptive error when collection manifest JSON is invalid', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    const dirPath = collectionDirPath(root, 'API');
    mkdirSync(dirPath, { recursive: true });
    writeFileSync(collectionManifestPath(dirPath), '<<<<<<< HEAD\n{ invalid\n', 'utf-8');

    expect(() => readCollectionFromFolder(dirPath)).toThrow(/Failed to parse JSON/);

    rmSync(root, { recursive: true, force: true });
  });

  it('throws a descriptive error when an environment file contains invalid JSON', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    writeFileSync(environmentFilePath(root, 'Staging'), '<<<<<<< HEAD\n{ invalid\n', 'utf-8');

    expect(() => readAllEnvironments(root)).toThrow(/Failed to parse JSON/);

    rmSync(root, { recursive: true, force: true });
  });

  it('resolves blank or dot subdirectories to the repository root', () => {
    expect(resolveHarborclientRoot('/tmp/repo', '')).toBe('/tmp/repo');
    expect(resolveHarborclientRoot('/tmp/repo', '   ')).toBe('/tmp/repo');
    expect(resolveHarborclientRoot('/tmp/repo', '.')).toBe('/tmp/repo');
    expect(resolveHarborclientRoot('/tmp/repo', '.harborclient')).toBe('/tmp/repo/.harborclient');
  });

  it('classifies collection-scoped request and document paths for git UI filtering', () => {
    const requestPath = '.harborclient/collection-api/req-health.json';
    const documentPath = '.harborclient/collection-api/README.md';
    const manifestPath = '.harborclient/collection-api/collection.json';

    expect(classifyHarborChangePath(requestPath, '.harborclient')).toMatchObject({
      kind: 'request',
      collectionDir: 'collection-api'
    });
    expect(classifyHarborChangePath(documentPath, '.harborclient')).toMatchObject({
      kind: 'document',
      collectionDir: 'collection-api'
    });
    expect(classifyHarborChangePath(manifestPath, '.harborclient')).toMatchObject({
      kind: 'collectionMeta'
    });
    expect(classifyHarborChangePath('.harborclient/.gitignore', '.harborclient')).toMatchObject({
      kind: 'other',
      fileName: '.gitignore'
    });
  });

  it('resolves display names from request JSON and collection manifest metadata', () => {
    const requestMeta = displayNameFromHarborChange(
      { kind: 'request', collectionDir: 'collection-api', fileName: 'req-health.json' },
      JSON.stringify({ name: 'Health Check', method: 'GET' })
    );
    expect(requestMeta).toEqual({
      displayName: 'Health Check',
      resourceKind: 'request',
      method: 'GET'
    });

    const documentMeta = displayNameFromHarborChange(
      { kind: 'document', collectionDir: 'collection-api', fileName: 'README.md' },
      null,
      JSON.stringify({
        documents: [{ file: 'README.md', uuid: 'x', name: 'Read Me', folder_uuid: null }]
      })
    );
    expect(documentMeta).toEqual({
      displayName: 'Read Me',
      resourceKind: 'document'
    });
  });

  it('rejects duplicate document filenames inside one collection folder', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-doc-collision-'));
    const dirPath = writeCollectionToFolder(
      root,
      buildTestCollectionExport({
        documents: [
          {
            uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            name: 'README.md',
            content: '# A',
            sort_order: 0,
            folder_name: null,
            color: null
          }
        ]
      })
    );

    expect(() =>
      assertDocumentFilenameAvailable(dirPath, 'readme.md', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')
    ).toThrow(/already exists in this collection/i);

    rmSync(root, { recursive: true, force: true });
  });
});
