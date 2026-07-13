import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import {
  assertExportFilenameAvailable,
  collectionFilePath,
  documentFileName,
  ensureHarborclientLayout,
  environmentFilePath,
  exportFileName,
  isGitignoredHarborExportFileName,
  listCollectionFilesOnDisk,
  readAllEnvironments,
  readCollectionFile,
  resolveHarborclientRoot,
  writeCollectionFile,
  writeDocumentsToHarborRoot,
  writeEnvironmentFile
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
  it('round-trips a collection export as a single root JSON file', () => {
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
      ]
    });

    writeCollectionFile(root, exportData);
    const filePath = collectionFilePath(root, exportData.name);
    expect(existsSync(filePath)).toBe(true);
    expect(existsSync(join(root, 'collections'))).toBe(false);

    const loaded = readCollectionFile(filePath);
    expect(loaded.name).toBe('API');
    expect(loaded.requests).toHaveLength(1);
    expect(loaded.requests[0]?.name).toBe('Health');
    expect(loaded.variables.find((v) => v.key === 'private')?.value).toBe('');
    expect(existsSync(join(root, '.gitignore'))).toBe(true);

    rmSync(root, { recursive: true, force: true });
  });

  it('removes the previous slug file when a collection is renamed', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));

    writeCollectionFile(root, buildTestCollectionExport({ name: 'Old Name' }));
    const oldPath = collectionFilePath(root, 'Old Name');
    expect(existsSync(oldPath)).toBe(true);

    writeCollectionFile(root, buildTestCollectionExport({ name: 'New Name' }));
    const newPath = collectionFilePath(root, 'New Name');
    expect(existsSync(newPath)).toBe(true);
    expect(existsSync(oldPath)).toBe(false);

    rmSync(root, { recursive: true, force: true });
  });

  it('lists collection files on disk by export discriminator', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    writeCollectionFile(root, buildTestCollectionExport());
    writeEnvironmentFile(root, {
      harborclientVersion: 1,
      harborclientExport: 'environment',
      uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      name: 'Staging',
      variables: []
    });

    expect(listCollectionFilesOnDisk(root)).toHaveLength(1);
    expect(exportFileName('collection', 'API')).toBe('collection-api.json');
    expect(exportFileName('environment', 'Staging')).toBe('environment-staging.json');

    rmSync(root, { recursive: true, force: true });
  });

  it('rejects export names that would match harbor gitignore globs', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    expect(isGitignoredHarborExportFileName('collection-local.json')).toBe(true);
    expect(isGitignoredHarborExportFileName('local-api.json')).toBe(true);
    expect(isGitignoredHarborExportFileName('collection-api.json')).toBe(false);

    expect(() =>
      assertExportFilenameAvailable(
        root,
        'collection',
        'Local',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      )
    ).toThrow(/ignored by the HarborClient .gitignore/i);

    rmSync(root, { recursive: true, force: true });
  });

  it('rejects case-insensitive duplicate collection export filenames', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    writeCollectionFile(
      root,
      buildTestCollectionExport({
        uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'API'
      })
    );

    expect(() =>
      assertExportFilenameAvailable(
        root,
        'collection',
        'api',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      )
    ).toThrow(/already exists/i);

    rmSync(root, { recursive: true, force: true });
  });

  it('allows the same slug across different export kinds', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    writeCollectionFile(
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

  it('throws a descriptive error when a collection file contains invalid JSON', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-layout-'));
    const filePath = collectionFilePath(root, 'API');
    writeFileSync(filePath, '<<<<<<< HEAD\n{ invalid\n', 'utf-8');

    expect(() => readCollectionFile(filePath)).toThrow(/Failed to parse JSON/);

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

  it('mirrors markdown documents to the harbor root', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-harbor-docs-'));
    const collectionUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const documents = [
      {
        uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'README.md',
        content: '# Notes',
        sort_order: 0,
        folder_name: null,
        color: null
      }
    ];

    writeCollectionFile(
      root,
      buildTestCollectionExport({
        documents
      })
    );
    writeDocumentsToHarborRoot(root, collectionUuid, documents);

    const filePath = join(root, documentFileName('README.md'));
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, 'utf-8')).toBe('# Notes');

    rmSync(root, { recursive: true, force: true });
  });

  it('rejects case-insensitive duplicate document filenames across collections', () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-doc-collision-'));
    const collectionA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const collectionB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const documentA = {
      uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'README.md',
      content: '# A',
      sort_order: 0,
      folder_name: null,
      color: null
    };

    writeCollectionFile(
      root,
      buildTestCollectionExport({
        uuid: collectionA,
        name: 'API',
        documents: [documentA]
      })
    );
    writeDocumentsToHarborRoot(root, collectionA, [documentA]);

    writeCollectionFile(
      root,
      buildTestCollectionExport({
        uuid: collectionB,
        name: 'Docs'
      })
    );

    expect(() =>
      writeDocumentsToHarborRoot(root, collectionB, [
        {
          uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
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
});
