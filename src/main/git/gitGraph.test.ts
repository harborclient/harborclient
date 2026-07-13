import * as git from 'isomorphic-git';
import fs from 'fs';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildCommitResourceDiff,
  buildGitGraphLog,
  readGitCommitDetail
} from '#/main/git/gitGraph';

const cleanups: Array<() => void> = [];

/**
 * Creates a temporary repository with two commits under `.harborclient`.
 */
async function createRepoWithHistory(): Promise<{ repoPath: string; secondOid: string }> {
  const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-graph-'));
  mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

  await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
  await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Test' });
  await git.setConfig({ fs, dir: repoPath, path: 'user.email', value: 'test@example.com' });

  writeFileSync(join(repoPath, '.harborclient', 'readme.txt'), 'v1');
  await git.add({ fs, dir: repoPath, filepath: '.harborclient/readme.txt' });
  await git.commit({
    fs,
    dir: repoPath,
    message: 'Initial',
    author: { name: 'Test', email: 'test@example.com' }
  });

  writeFileSync(join(repoPath, '.harborclient', 'readme.txt'), 'v2');
  await git.add({ fs, dir: repoPath, filepath: '.harborclient/readme.txt' });
  const secondOid = await git.commit({
    fs,
    dir: repoPath,
    message: 'Second commit',
    author: { name: 'Test', email: 'test@example.com' }
  });

  cleanups.push(() => rmSync(repoPath, { recursive: true, force: true }));

  return { repoPath, secondOid };
}

/**
 * Creates a repository with one commit that adds a request and markdown document.
 */
async function createRepoWithResources(): Promise<{
  repoPath: string;
  commitOid: string;
  collectionUuid: string;
  requestUuid: string;
  documentUuid: string;
}> {
  const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-commit-resources-'));
  const collectionUuid = '54339c18-aa14-4f3f-965e-2b14e1b7112c';
  const requestUuid = '71c3dbd8-831a-41c5-a701-86b3c521fff5';
  const documentUuid = '81d4ece9-942b-52d6-b812-97c4d6320aa6';
  const collectionDir = join(
    repoPath,
    '.harborclient',
    'collections',
    `${collectionUuid}-git-test`
  );
  const requestsDir = join(collectionDir, 'requests');

  mkdirSync(requestsDir, { recursive: true });

  await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
  await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Test' });
  await git.setConfig({ fs, dir: repoPath, path: 'user.email', value: 'test@example.com' });

  writeFileSync(
    join(requestsDir, `${requestUuid}-echo.json`),
    JSON.stringify(
      {
        harborclientVersion: 1,
        harborclientExport: 'request',
        uuid: requestUuid,
        name: 'Echo',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: ''
      },
      null,
      2
    ),
    'utf-8'
  );

  writeFileSync(
    join(collectionDir, 'collection.json'),
    JSON.stringify(
      {
        harborclientVersion: 1,
        harborclientExport: 'collection',
        uuid: collectionUuid,
        name: 'Git Test',
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
      null,
      2
    ),
    'utf-8'
  );

  writeFileSync(join(repoPath, '.harborclient', 'README.md'), '# Harbor', 'utf-8');

  await git.add({ fs, dir: repoPath, filepath: '.harborclient' });
  const commitOid = await git.commit({
    fs,
    dir: repoPath,
    message: 'Add resources',
    author: { name: 'Test', email: 'test@example.com' }
  });

  cleanups.push(() => rmSync(repoPath, { recursive: true, force: true }));

  return { repoPath, commitOid, collectionUuid, requestUuid, documentUuid };
}

describe('gitGraph', () => {
  afterEach(() => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  });

  it('buildGitGraphLog returns parent links and head metadata', async () => {
    const { repoPath, secondOid } = await createRepoWithHistory();

    const result = await buildGitGraphLog(repoPath, 10);

    expect(result.headCommitHash).toBe(secondOid);
    expect(result.currentBranch).toBe('main');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]?.hash).toBe(secondOid);
    expect(result.entries[0]?.parents).toHaveLength(1);
    expect(result.entries[0]?.message).toBe('Second commit');
  });

  it('readGitCommitDetail lists modified HarborClient files against the parent', async () => {
    const { repoPath, secondOid } = await createRepoWithHistory();

    const detail = await readGitCommitDetail(repoPath, '.harborclient', secondOid);

    expect(detail.oid).toBe(secondOid);
    expect(detail.message).toBe('Second commit');
    expect(detail.files).toEqual([
      {
        kind: 'file',
        path: '.harborclient/readme.txt',
        status: 'modified'
      }
    ]);
  });

  it('readGitCommitDetail groups request and document resources with metadata', async () => {
    const { repoPath, commitOid, collectionUuid, requestUuid, documentUuid } =
      await createRepoWithResources();

    const detail = await readGitCommitDetail(repoPath, '.harborclient', commitOid);

    expect(detail.files).toHaveLength(3);
    expect(detail.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'document',
          documentUuid,
          collectionUuid,
          name: 'README.md',
          status: 'added'
        }),
        expect.objectContaining({
          kind: 'request',
          requestUuid,
          collectionUuid,
          name: 'Echo',
          method: 'GET',
          status: 'added'
        }),
        expect.objectContaining({
          kind: 'file',
          path: expect.stringContaining('collection.json'),
          status: 'added'
        })
      ])
    );
  });

  it('buildCommitResourceDiff returns parent-to-commit request diff text', async () => {
    const { repoPath, commitOid, collectionUuid, requestUuid } = await createRepoWithResources();

    const diff = await buildCommitResourceDiff(
      repoPath,
      '.harborclient',
      commitOid,
      collectionUuid,
      requestUuid,
      'request',
      'Echo'
    );

    expect(diff.requestName).toBe('Echo');
    expect(diff.files).toHaveLength(1);
    expect(diff.files[0]?.status).toBe('added');
    expect(diff.files[0]?.diff).toContain('Echo');
    expect(diff.files[0]?.diff).toContain('+++ ');
  });
});
