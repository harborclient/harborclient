import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as git from 'isomorphic-git';
import fs from 'fs';
import { describe, expect, it } from 'vitest';
import {
  analyzeMatrixRow,
  buildDocumentStatusesForCollection,
  buildRequestStatusesForCollection,
  countStagedAndUnstaged,
  deriveRequestStatus,
  isRequestPathForCollection,
  parseRequestUuidFromPath,
  resolveRequestDiffPaths,
  readDocumentIdentityFromMatrixRow
} from '#/main/git/gitRequestStatus';
import { collectionDir, isHarborDocumentPath, writeCollectionToDir } from '#/main/git/fileLayout';

describe('gitRequestStatus', () => {
  const collectionUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const requestUuid = '11111111-2222-3333-4444-555555555555';
  const requestPath = `.harborclient/collections/${collectionUuid}-demo/requests/${requestUuid}-get-users.json`;

  it('detects request paths for a collection uuid', () => {
    expect(isRequestPathForCollection(requestPath, '.harborclient', collectionUuid)).toBe(true);
    expect(
      isRequestPathForCollection(
        '.harborclient/collections/bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee-demo/requests/x.json',
        '.harborclient',
        collectionUuid
      )
    ).toBe(false);
  });

  it('parses request uuid from repository-relative paths', () => {
    expect(parseRequestUuidFromPath(requestPath)).toBe(requestUuid);
  });

  it('classifies untracked request files as unstaged', () => {
    const flags = analyzeMatrixRow([requestPath, 0, 2, 0]);
    expect(flags).toEqual({
      hasStagedChanges: false,
      hasUnstagedChanges: true,
      isUntracked: true
    });

    const status = deriveRequestStatus([flags!]);
    expect(status).toEqual({
      displayStatus: 'unstaged',
      canAdd: true,
      canRemove: false
    });
  });

  it('classifies tracked unstaged modifications as uncommitted', () => {
    const flags = analyzeMatrixRow([requestPath, 1, 2, 1]);
    const status = deriveRequestStatus([flags!]);
    expect(status).toEqual({
      displayStatus: 'uncommitted',
      canAdd: true,
      canRemove: false
    });
  });

  it('classifies staged-only changes as staged', () => {
    const flags = analyzeMatrixRow([requestPath, 1, 1, 2]);
    const status = deriveRequestStatus([flags!]);
    expect(status).toEqual({
      displayStatus: 'staged',
      canAdd: false,
      canRemove: true
    });
  });

  it('classifies tracked staged modifications as staged', () => {
    const flags = analyzeMatrixRow([requestPath, 1, 2, 2]);
    const status = deriveRequestStatus([flags!]);
    expect(status).toEqual({
      displayStatus: 'staged',
      canAdd: false,
      canRemove: true
    });
  });

  it('classifies staged new files with later edits as uncommitted', () => {
    const flags = analyzeMatrixRow([requestPath, 0, 2, 1]);
    const status = deriveRequestStatus([flags!]);
    expect(status).toEqual({
      displayStatus: 'uncommitted',
      canAdd: true,
      canRemove: true
    });
  });

  it('prefers unstaged working-tree edits over staged state', () => {
    const staged = analyzeMatrixRow([requestPath, 1, 1, 2]);
    const unstaged = analyzeMatrixRow([requestPath, 1, 2, 1]);
    const status = deriveRequestStatus([staged!, unstaged!]);
    expect(status.displayStatus).toBe('uncommitted');
    expect(status.canAdd).toBe(true);
    expect(status.canRemove).toBe(true);
  });

  it('builds per-request statuses for one collection', () => {
    const otherRequestUuid = '99999999-8888-7777-6666-555555555555';
    const otherPath = `.harborclient/collections/${collectionUuid}-demo/requests/${otherRequestUuid}-other.json`;
    const matrix = [
      [requestPath, 0, 2, 0],
      [otherPath, 1, 1, 2]
    ] as Array<[string, number, number, number]>;

    const statuses = buildRequestStatusesForCollection(matrix, '.harborclient', collectionUuid);
    expect(statuses[requestUuid]?.displayStatus).toBe('unstaged');
    expect(statuses[otherRequestUuid]?.displayStatus).toBe('staged');
  });

  it('counts staged and unstaged files separately', () => {
    const matrix = [
      [requestPath, 0, 2, 0],
      ['.harborclient/readme.txt', 1, 1, 2]
    ] as Array<[string, number, number, number]>;

    expect(countStagedAndUnstaged(matrix)).toEqual({
      changedCount: 2,
      stagedCount: 1,
      unstagedCount: 1
    });
  });

  it('detects harbor-root markdown document paths', () => {
    const documentPath = '.harborclient/README.md';

    expect(isHarborDocumentPath(documentPath, '.harborclient')).toBe(true);
    expect(
      isHarborDocumentPath('.harborclient/collections/foo/collection.json', '.harborclient')
    ).toBe(false);
  });

  it('reads document identity from collection.json metadata in the working tree', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'hc-git-doc-identity-'));
    const documentUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const documentPath = '.harborclient/README.md';

    const harborRoot = join(repoPath, '.harborclient');
    mkdirSync(harborRoot, { recursive: true });
    const dir = collectionDir(harborRoot, collectionUuid, 'Demo');
    writeCollectionToDir(
      dir,
      {
        harborclientVersion: 1,
        harborclientExport: 'collection',
        uuid: collectionUuid,
        name: 'Demo',
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
    writeFileSync(join(repoPath, '.harborclient', 'README.md'), '# Notes', 'utf-8');

    const identity = await readDocumentIdentityFromMatrixRow(repoPath, '.harborclient', [
      documentPath,
      0,
      2,
      0
    ]);
    expect(identity).toEqual({
      uuid: documentUuid,
      collection_uuid: collectionUuid
    });

    rmSync(repoPath, { recursive: true, force: true });
  });

  it('builds per-document statuses for one collection from harbor-root markdown files', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'hc-git-doc-status-'));
    const documentUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const documentPath = '.harborclient/README.md';

    const harborRoot = join(repoPath, '.harborclient');
    mkdirSync(harborRoot, { recursive: true });
    const dir = collectionDir(harborRoot, collectionUuid, 'Demo');
    writeCollectionToDir(
      dir,
      {
        harborclientVersion: 1,
        harborclientExport: 'collection',
        uuid: collectionUuid,
        name: 'Demo',
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
    writeFileSync(join(repoPath, '.harborclient', 'README.md'), '# Notes', 'utf-8');

    const matrix = [[documentPath, 0, 2, 0]] as Array<[string, number, number, number]>;
    const statuses = await buildDocumentStatusesForCollection(
      matrix,
      repoPath,
      '.harborclient',
      collectionUuid
    );

    expect(statuses[documentUuid]?.displayStatus).toBe('unstaged');

    rmSync(repoPath, { recursive: true, force: true });
  });

  it('reads document identity from HEAD when the working tree file is deleted', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'hc-git-doc-head-'));
    const documentUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const documentPath = '.harborclient/README.md';

    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
    const harborRoot = join(repoPath, '.harborclient');
    mkdirSync(harborRoot, { recursive: true });
    const dir = collectionDir(harborRoot, collectionUuid, 'Demo');
    writeCollectionToDir(
      dir,
      {
        harborclientVersion: 1,
        harborclientExport: 'collection',
        uuid: collectionUuid,
        name: 'Demo',
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
    writeFileSync(join(repoPath, '.harborclient', 'README.md'), '# Notes', 'utf-8');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Add README',
      author: { name: 'Test', email: 'test@example.com' }
    });
    rmSync(join(repoPath, '.harborclient', 'README.md'));

    const identity = await readDocumentIdentityFromMatrixRow(repoPath, '.harborclient', [
      documentPath,
      1,
      0,
      1
    ]);
    expect(identity).toEqual({
      uuid: documentUuid,
      collection_uuid: collectionUuid
    });

    rmSync(repoPath, { recursive: true, force: true });
  });

  it('prefers the canonical request file name when multiple stale files share a uuid', () => {
    const canonicalPath = `.harborclient/collections/${collectionUuid}-demo/requests/${requestUuid}-untitled-request.json`;
    const stalePath = `.harborclient/collections/${collectionUuid}-demo/requests/${requestUuid}-echo-get.json`;
    const headPath = `.harborclient/collections/${collectionUuid}-demo/requests/${requestUuid}-echo.json`;

    const resolved = resolveRequestDiffPaths(
      [
        [headPath, 1, 1, 1],
        [stalePath, 0, 2, 0],
        [canonicalPath, 0, 2, 0]
      ],
      requestUuid,
      'Untitled Request'
    );

    expect(resolved).toEqual({
      headPath,
      workPath: canonicalPath
    });
  });

  it('falls back to the first non-deleted request path when the canonical name is absent', () => {
    const stalePath = `.harborclient/collections/${collectionUuid}-demo/requests/${requestUuid}-echo-get.json`;

    const resolved = resolveRequestDiffPaths(
      [[stalePath, 0, 2, 0]],
      requestUuid,
      'Untitled Request'
    );

    expect(resolved).toEqual({
      headPath: null,
      workPath: stalePath
    });
  });
});
