import * as git from 'isomorphic-git';
import fs from 'fs';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitSyncManager } from '#/main/git/GitSyncManager';
import { pullMergeConflictMessage } from '#/main/git/slug';
import type { GitSettings } from '#/shared/types';

const cleanups: Array<() => void> = [];

/**
 * Repository-relative HarborClient prefix used by collection-scoped commit tests.
 */
const harborCollectionPrefix = '.harborclient';

/**
 * Minimal fetch result for mocked network-free pull tests.
 */
const mockFetchResult = {
  defaultBranch: null,
  fetchHead: null,
  fetchHeadDescription: null
};

/**
 * Writes a remote-tracking ref under refs/remotes/origin/.
 *
 * @param repoPath - Repository root path.
 * @param branch - Branch name (for example `main`).
 * @param oid - Commit oid the ref should point to.
 */
function writeOriginRef(repoPath: string, branch: string, oid: string): void {
  const refDir = join(repoPath, '.git', 'refs', 'remotes', 'origin');
  mkdirSync(refDir, { recursive: true });
  writeFileSync(join(refDir, branch), `${oid}\n`);
}

/**
 * Creates a temporary git repository with an initial commit on main.
 */
async function createTestRepo(): Promise<{ repoPath: string; manager: GitSyncManager }> {
  const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-sync-'));
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

  const settings: GitSettings = {
    repoPath,
    url: 'https://github.com/example/repo.git',
    branch: 'main',
    subdir: '.harborclient',
    auth: { kind: 'pat', username: 'token' }
  };

  cleanups.push(() => rmSync(repoPath, { recursive: true, force: true }));

  return { repoPath, manager: new GitSyncManager('test-connection', settings) };
}

/**
 * Creates a temporary git repository without a HarborClient subdirectory.
 */
async function createBareTestRepo(): Promise<{ repoPath: string; manager: GitSyncManager }> {
  const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-sync-'));

  await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
  await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Test' });
  await git.setConfig({ fs, dir: repoPath, path: 'user.email', value: 'test@example.com' });

  writeFileSync(join(repoPath, 'readme.txt'), 'root');
  await git.add({ fs, dir: repoPath, filepath: 'readme.txt' });
  await git.commit({
    fs,
    dir: repoPath,
    message: 'Initial',
    author: { name: 'Test', email: 'test@example.com' }
  });

  const settings: GitSettings = {
    repoPath,
    url: 'https://github.com/example/repo.git',
    branch: 'main',
    subdir: '.harborclient',
    auth: { kind: 'pat', username: 'token' }
  };

  cleanups.push(() => rmSync(repoPath, { recursive: true, force: true }));

  return { repoPath, manager: new GitSyncManager('test-connection', settings) };
}

describe('GitSyncManager', () => {
  afterEach(() => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  });

  it('returns zero ahead/behind when local matches origin ref', async () => {
    const { repoPath, manager } = await createTestRepo();
    const head = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
    writeOriginRef(repoPath, 'main', head);

    const status = await manager.getStatus();
    expect(status.syncKnown).toBe(true);
    expect(status.ahead).toBe(0);
    expect(status.behind).toBe(0);
    expect(status.harborRootExists).toBe(true);
    expect(status.harborSubdir).toBe('.harborclient');
  });

  it('reports unknown sync state when origin tracking ref is missing', async () => {
    const { manager } = await createTestRepo();

    const status = await manager.getStatus();
    expect(status.syncKnown).toBe(false);
    expect(status.ahead).toBe(0);
    expect(status.behind).toBe(0);
  });

  it('counts commits ahead of origin/main', async () => {
    const { repoPath, manager } = await createTestRepo();
    const initialHead = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
    writeOriginRef(repoPath, 'main', initialHead);

    writeFileSync(join(repoPath, '.harborclient', 'readme.txt'), 'v2');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/readme.txt' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Second',
      author: { name: 'Test', email: 'test@example.com' }
    });

    const status = await manager.getStatus();
    expect(status.syncKnown).toBe(true);
    expect(status.ahead).toBe(1);
    expect(status.behind).toBe(0);
  });

  it('counts commits behind origin/main', async () => {
    const { repoPath, manager } = await createTestRepo();
    const initialHead = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });

    writeFileSync(join(repoPath, '.harborclient', 'readme.txt'), 'v2');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/readme.txt' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Second',
      author: { name: 'Test', email: 'test@example.com' }
    });
    const remoteHead = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });

    writeOriginRef(repoPath, 'main', remoteHead);
    writeFileSync(join(repoPath, '.git', 'refs', 'heads', 'main'), `${initialHead}\n`);
    await git.checkout({ fs, dir: repoPath, ref: 'main' });

    const status = await manager.getStatus();
    expect(status.syncKnown).toBe(true);
    expect(status.ahead).toBe(0);
    expect(status.behind).toBe(1);
  });

  it('blocks pull when merge conflict markers already exist', async () => {
    const { repoPath, manager } = await createTestRepo();
    const conflictPath = join(repoPath, '.harborclient', 'collections', 'conflict.json');
    mkdirSync(join(repoPath, '.harborclient', 'collections'), { recursive: true });
    writeFileSync(
      conflictPath,
      '<<<<<<< HEAD\n{"name":"ours"}\n=======\n{"name":"theirs"}\n>>>>>>> branch',
      'utf-8'
    );

    const fetchSpy = vi.spyOn(git, 'fetch').mockResolvedValue(mockFetchResult);

    await expect(manager.pull()).rejects.toThrow(pullMergeConflictMessage(1));
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('maps diverged merge failures to a friendly conflict message', async () => {
    const { repoPath, manager } = await createTestRepo();
    const dataPath = join(repoPath, '.harborclient', 'data.json');
    writeFileSync(dataPath, '{"version":1}', 'utf-8');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/data.json' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Add data.json',
      author: { name: 'Test', email: 'test@example.com' }
    });

    const baseHead = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
    writeOriginRef(repoPath, 'main', baseHead);

    writeFileSync(dataPath, '{"version":"remote"}', 'utf-8');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/data.json' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Remote change',
      author: { name: 'Test', email: 'test@example.com' }
    });
    const remoteHead = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
    writeOriginRef(repoPath, 'main', remoteHead);

    writeFileSync(join(repoPath, '.git', 'refs', 'heads', 'main'), `${baseHead}\n`);
    await git.checkout({ fs, dir: repoPath, ref: 'main' });
    writeFileSync(dataPath, '{"version":"local"}', 'utf-8');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/data.json' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Local change',
      author: { name: 'Test', email: 'test@example.com' }
    });

    const fetchSpy = vi.spyOn(git, 'fetch').mockResolvedValue(mockFetchResult);

    await expect(manager.pull()).rejects.toThrow(/merge conflicts/);
    expect(fetchSpy).toHaveBeenCalledOnce();

    fetchSpy.mockRestore();
  });

  it('commits nested files under the HarborClient subdirectory', async () => {
    const { repoPath, manager } = await createTestRepo();
    const nestedDir = join(repoPath, '.harborclient', 'sub');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(nestedDir, 'nested.txt'), 'nested content');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/sub/nested.txt' });

    await manager.commit('Add nested file', { collectionPrefix: harborCollectionPrefix });

    const head = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
    const { blob } = await git.readBlob({
      fs,
      dir: repoPath,
      oid: head,
      filepath: '.harborclient/sub/nested.txt'
    });
    expect(Buffer.from(blob).toString('utf-8')).toBe('nested content');

    const status = await manager.getStatus();
    expect(status.changedCount).toBe(0);
  });

  it('commits harbor-root markdown documents under the HarborClient subdirectory', async () => {
    const { repoPath, manager } = await createTestRepo();
    const documentUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const collectionUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    writeFileSync(
      join(repoPath, '.harborclient', `${collectionUuid}-api.json`),
      JSON.stringify(
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
              color: null,
              content: '# Harbor notes'
            }
          ],
          created_at: new Date().toISOString()
        },
        null,
        2
      ),
      'utf-8'
    );
    writeFileSync(join(repoPath, '.harborclient', 'README.md'), '# Harbor notes', 'utf-8');
    await git.add({
      fs,
      dir: repoPath,
      filepath: `.harborclient/${collectionUuid}-api.json`
    });
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/README.md' });

    await manager.commit('Add harbor-root markdown document', {
      collectionPrefix: harborCollectionPrefix
    });

    const head = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
    const { blob } = await git.readBlob({
      fs,
      dir: repoPath,
      oid: head,
      filepath: '.harborclient/README.md'
    });
    expect(Buffer.from(blob).toString('utf-8')).toBe('# Harbor notes');

    const status = await manager.getStatus();
    expect(status.changedCount).toBe(0);
  });

  it('stages deleted files under the HarborClient subdirectory when committing', async () => {
    const { repoPath, manager } = await createTestRepo();
    const jsonPath = join(repoPath, '.harborclient', 'old.json');
    writeFileSync(jsonPath, '{}', 'utf-8');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/old.json' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Add old.json',
      author: { name: 'Test', email: 'test@example.com' }
    });

    rmSync(jsonPath);

    await manager.commit('Remove old.json', { collectionPrefix: harborCollectionPrefix });

    const files = await git.listFiles({ fs, dir: repoPath, ref: 'HEAD' });
    expect(files).not.toContain('.harborclient/old.json');
    expect(files).toContain('.harborclient/readme.txt');
  });

  it('reports harborRootExists false when the HarborClient subdirectory is missing', async () => {
    const { manager } = await createBareTestRepo();

    const status = await manager.getStatus();
    expect(status.harborRootExists).toBe(false);
    expect(status.harborSubdir).toBe('.harborclient');
  });

  it('rejects commit without a collection prefix', async () => {
    const { manager } = await createBareTestRepo();

    await expect(manager.commit('Initial HarborClient layout')).rejects.toThrow(
      'Collection prefix is required for git commit.'
    );
  });

  it('rejects commit when the HarborClient subdirectory is missing', async () => {
    const { manager } = await createBareTestRepo();

    await expect(
      manager.commit('Initial HarborClient layout', { collectionPrefix: harborCollectionPrefix })
    ).rejects.toThrow(
      'HarborClient subdirectory ".harborclient" does not exist in this repository.'
    );
  });

  it('creates the HarborClient layout and commits when createHarborRoot is true', async () => {
    const { repoPath, manager } = await createBareTestRepo();
    const harborRoot = join(repoPath, '.harborclient');

    await manager.commit('Initial HarborClient layout', {
      createHarborRoot: true,
      collectionPrefix: harborCollectionPrefix
    });

    expect(existsSync(harborRoot)).toBe(true);
    expect(existsSync(join(harborRoot, '.gitignore'))).toBe(true);
    expect(existsSync(join(harborRoot, 'collections'))).toBe(false);

    const files = await git.listFiles({ fs, dir: repoPath, ref: 'HEAD' });
    expect(files).toContain('.harborclient/.gitignore');

    const status = await manager.getStatus();
    expect(status.harborRootExists).toBe(true);
    expect(status.changedCount).toBe(0);
  });

  it('throws when there are no changes to commit', async () => {
    const { manager } = await createTestRepo();

    await expect(
      manager.commit('Empty commit', { collectionPrefix: harborCollectionPrefix })
    ).rejects.toThrow('No changes to commit.');
  });

  it('commits tracked modifications even when they were not pre-staged', async () => {
    const { repoPath, manager } = await createTestRepo();
    writeFileSync(join(repoPath, '.harborclient', 'readme.txt'), 'v2 unstaged edit');

    await manager.commit('Update readme', { collectionPrefix: harborCollectionPrefix });

    const head = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
    const { blob } = await git.readBlob({
      fs,
      dir: repoPath,
      oid: head,
      filepath: '.harborclient/readme.txt'
    });
    expect(Buffer.from(blob).toString('utf-8')).toBe('v2 unstaged edit');

    const status = await manager.getStatus();
    expect(status.changedCount).toBe(0);
  });

  it('excludes untracked files from commits', async () => {
    const { repoPath, manager } = await createTestRepo();
    const stagedPath = '.harborclient/staged.txt';
    const unstagedPath = '.harborclient/unstaged.txt';

    writeFileSync(join(repoPath, stagedPath), 'staged');
    writeFileSync(join(repoPath, unstagedPath), 'unstaged');
    await git.add({ fs, dir: repoPath, filepath: stagedPath });

    await manager.commit('Manual staged commit', {
      collectionPrefix: harborCollectionPrefix
    });

    const files = await git.listFiles({ fs, dir: repoPath, ref: 'HEAD' });
    expect(files).toContain(stagedPath);
    expect(files).not.toContain(unstagedPath);

    const status = await manager.getStatus();
    expect(status.stagedCount).toBe(0);
    expect(status.unstagedCount).toBe(0);
  });

  it('commits only changes under collectionPrefix', async () => {
    const { repoPath, manager } = await createTestRepo();
    const collectionA = '.harborclient/collection-a';
    const collectionB = '.harborclient/collection-b';
    mkdirSync(join(repoPath, '.harborclient', 'collection-a'), { recursive: true });
    mkdirSync(join(repoPath, '.harborclient', 'collection-b'), { recursive: true });
    writeFileSync(join(repoPath, '.harborclient', 'collection-a', 'req-a.json'), '{"a":1}');
    writeFileSync(join(repoPath, '.harborclient', 'collection-b', 'req-b.json'), '{"b":1}');
    await git.add({ fs, dir: repoPath, filepath: `${collectionA}/req-a.json` });
    await git.add({ fs, dir: repoPath, filepath: `${collectionB}/req-b.json` });

    await manager.commit('Add both collections', { collectionPrefix: harborCollectionPrefix });

    writeFileSync(
      join(repoPath, '.harborclient', 'collection-a', 'req-a.json'),
      '{"a":2,"updated":true}'
    );
    writeFileSync(
      join(repoPath, '.harborclient', 'collection-b', 'req-b.json'),
      '{"b":2,"updated":true}'
    );

    await manager.commit('Collection A only', { collectionPrefix: collectionA });

    const head = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
    const { blob: blobA } = await git.readBlob({
      fs,
      dir: repoPath,
      oid: head,
      filepath: `${collectionA}/req-a.json`
    });
    expect(Buffer.from(blobA).toString('utf-8')).toContain('"a":2');

    const status = await manager.getStatus();
    expect(status.changedCount).toBe(1);
    expect(readFileSync(join(repoPath, collectionB, 'req-b.json'), 'utf-8')).toContain('"b":2');
  });

  it('lists local branch names', async () => {
    const { manager } = await createTestRepo();

    const branches = await manager.listBranches();
    expect(branches).toContain('main');
  });

  it('creates a branch from the current commit and checks it out', async () => {
    const { manager } = await createTestRepo();

    await manager.createBranch('feature');

    const branches = await manager.listBranches();
    expect(branches).toContain('feature');
    const status = await manager.getStatus();
    expect(status.branch).toBe('feature');
  });

  it('preserves uncommitted changes when creating a branch', async () => {
    const { repoPath, manager } = await createTestRepo();
    writeFileSync(join(repoPath, '.harborclient', 'readme.txt'), 'uncommitted edit');

    await manager.createBranch('feature');

    const status = await manager.getStatus();
    expect(status.branch).toBe('feature');
    expect(status.changedCount).toBeGreaterThan(0);
  });

  it('rejects duplicate branch names', async () => {
    const { manager } = await createTestRepo();

    await expect(manager.createBranch('main')).rejects.toThrow('already exists');
  });

  it('checks out another branch when the working tree is clean', async () => {
    const { repoPath, manager } = await createTestRepo();
    await git.branch({ fs, dir: repoPath, ref: 'feature', checkout: false });

    await manager.checkoutBranch('feature');

    const status = await manager.getStatus();
    expect(status.branch).toBe('feature');
  });

  it('rejects checkout when there are uncommitted changes', async () => {
    const { repoPath, manager } = await createTestRepo();
    await git.branch({ fs, dir: repoPath, ref: 'feature', checkout: false });
    writeFileSync(join(repoPath, '.harborclient', 'readme.txt'), 'uncommitted edit');

    await expect(manager.checkoutBranch('feature')).rejects.toThrow(
      'Commit or discard your changes before switching branches.'
    );
  });

  it('deletes a local branch that is not checked out', async () => {
    const { repoPath, manager } = await createTestRepo();
    await git.branch({ fs, dir: repoPath, ref: 'feature', checkout: false });

    await manager.deleteBranch('feature');

    const branches = await manager.listBranches();
    expect(branches).not.toContain('feature');
    expect(branches).toContain('main');
  });

  it('rejects deleting the currently checked-out branch', async () => {
    const { manager } = await createTestRepo();

    await expect(manager.deleteBranch('main')).rejects.toThrow(
      'Cannot delete the currently checked-out branch.'
    );
  });

  it('rejects deleting a branch that does not exist', async () => {
    const { manager } = await createTestRepo();

    await expect(manager.deleteBranch('missing')).rejects.toThrow('does not exist');
  });

  it('pushes the currently checked-out branch', async () => {
    const { repoPath, manager } = await createTestRepo();
    await git.branch({ fs, dir: repoPath, ref: 'feature', checkout: true });

    let pushedRef: string | undefined;
    const pushSpy = vi.spyOn(git, 'push').mockImplementation(async (args) => {
      pushedRef = args.ref;
      return { ok: true, error: null, refs: {} };
    });

    await manager.push();

    expect(pushedRef).toBe('feature');
    expect(pushSpy).toHaveBeenCalledOnce();

    pushSpy.mockRestore();
  });

  it('returns graph log entries with parent links', async () => {
    const { repoPath, manager } = await createTestRepo();
    writeFileSync(join(repoPath, '.harborclient', 'readme.txt'), 'v2');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/readme.txt' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Second',
      author: { name: 'Test', email: 'test@example.com' }
    });

    const graph = await manager.graphLog(10);

    expect(graph.entries.length).toBeGreaterThanOrEqual(2);
    expect(graph.headCommitHash).toBe(graph.entries[0]?.hash);
    expect(graph.entries[0]?.parents.length).toBeGreaterThan(0);
  });

  it('returns an empty log and graph for a repository with no commits', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-sync-empty-'));
    cleanups.push(() => rmSync(repoPath, { recursive: true, force: true }));
    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };
    const manager = new GitSyncManager('test-connection', settings);

    await expect(manager.log()).resolves.toEqual([]);
    const graph = await manager.graphLog();
    expect(graph.entries).toEqual([]);
    expect(graph.headCommitHash).toBeNull();
  });

  it('returns commit detail with HarborClient file changes', async () => {
    const { repoPath, manager } = await createTestRepo();
    writeFileSync(
      join(repoPath, '.harborclient', 'environment-staging.json'),
      JSON.stringify({
        harborclientExport: 'environment',
        uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        name: 'Staging',
        variables: []
      })
    );
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/environment-staging.json' });
    const oid = await git.commit({
      fs,
      dir: repoPath,
      message: 'Second',
      author: { name: 'Test', email: 'test@example.com' }
    });

    const detail = await manager.readCommitDetail(oid);

    expect(detail.message).toBe('Second');
    expect(detail.files).toEqual([
      {
        kind: 'file',
        path: '.harborclient/environment-staging.json',
        status: 'added'
      }
    ]);
  });

  it('merges another local branch into the current branch', async () => {
    const { repoPath, manager } = await createTestRepo();
    writeFileSync(join(repoPath, '.harborclient', 'main.txt'), 'main');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/main.txt' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Main change',
      author: { name: 'Test', email: 'test@example.com' }
    });

    await git.branch({ fs, dir: repoPath, ref: 'feature', checkout: true });
    writeFileSync(join(repoPath, '.harborclient', 'feature.txt'), 'feature');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/feature.txt' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Feature change',
      author: { name: 'Test', email: 'test@example.com' }
    });

    await manager.checkoutBranch('main');
    const result = await manager.mergeBranch('feature');

    expect(result.conflictCount).toBe(0);
    const files = await git.listFiles({ fs, dir: repoPath, ref: 'HEAD' });
    expect(files).toContain('.harborclient/feature.txt');
  });

  it('rejects merging the current branch into itself', async () => {
    const { manager } = await createTestRepo();

    await expect(manager.mergeBranch('main')).rejects.toThrow(
      'Cannot merge the current branch into itself.'
    );
  });

  it('creates a merge commit for diverged branches without a configured identity', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-sync-merge-'));
    cleanups.push(() => rmSync(repoPath, { recursive: true, force: true }));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
    writeFileSync(join(repoPath, '.harborclient', 'base.txt'), 'base');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/base.txt' });
    const base = await git.commit({
      fs,
      dir: repoPath,
      message: 'Base',
      author: { name: 'Test', email: 'test@example.com' }
    });

    await git.branch({ fs, dir: repoPath, ref: 'feature', checkout: true });
    writeFileSync(join(repoPath, '.harborclient', 'feature.txt'), 'feature');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/feature.txt' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Feature change',
      author: { name: 'Test', email: 'test@example.com' }
    });

    await git.checkout({ fs, dir: repoPath, ref: 'main' });
    writeFileSync(join(repoPath, '.harborclient', 'main.txt'), 'main');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/main.txt' });
    const mainCommit = await git.commit({
      fs,
      dir: repoPath,
      message: 'Main change',
      author: { name: 'Test', email: 'test@example.com' }
    });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };
    const manager = new GitSyncManager('test-connection', settings);

    const result = await manager.mergeBranch('feature');

    expect(result.conflictCount).toBe(0);
    const head = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
    const { commit } = await git.readCommit({ fs, dir: repoPath, oid: head });
    expect(commit.parent).toEqual(expect.arrayContaining([mainCommit]));
    expect(commit.parent.length).toBe(2);
    expect(commit.author.name).toBe('HarborClient');
    expect(base).not.toBe(mainCommit);
  });

  it('reverts a modified tracked file to HEAD', async () => {
    const { repoPath, manager } = await createTestRepo();
    const filePath = '.harborclient/readme.txt';

    writeFileSync(join(repoPath, filePath), 'uncommitted edit');
    await manager.revertFile(filePath);

    expect(readFileSync(join(repoPath, filePath), 'utf-8')).toBe('v1');
    const status = await manager.getStatus();
    expect(status.changedCount).toBe(0);
  });

  it('reverts an added file by removing it from the working tree', async () => {
    const { repoPath, manager } = await createTestRepo();
    const filePath = '.harborclient/new.txt';

    writeFileSync(join(repoPath, filePath), 'new');
    await manager.revertFile(filePath);

    expect(existsSync(join(repoPath, filePath))).toBe(false);
    const status = await manager.getStatus();
    expect(status.changedCount).toBe(0);
  });

  it('reverts a deleted tracked file by restoring it from HEAD', async () => {
    const { repoPath, manager } = await createTestRepo();
    const filePath = '.harborclient/readme.txt';

    rmSync(join(repoPath, filePath));
    await manager.revertFile(filePath);

    expect(readFileSync(join(repoPath, filePath), 'utf-8')).toBe('v1');
    const status = await manager.getStatus();
    expect(status.changedCount).toBe(0);
  });
});
