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

    await manager.commit('Add nested file');

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
    const collectionDirectory = join(
      repoPath,
      '.harborclient',
      'collections',
      `${collectionUuid}-api`
    );
    mkdirSync(collectionDirectory, { recursive: true });
    writeFileSync(
      join(collectionDirectory, 'collection.json'),
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
    writeFileSync(join(repoPath, '.harborclient', 'README.md'), '# Harbor notes', 'utf-8');

    await manager.commit('Add harbor-root markdown document');

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
    const jsonPath = join(repoPath, '.harborclient', 'collections', 'old.json');
    mkdirSync(join(repoPath, '.harborclient', 'collections'), { recursive: true });
    writeFileSync(jsonPath, '{}', 'utf-8');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/collections/old.json' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Add old.json',
      author: { name: 'Test', email: 'test@example.com' }
    });

    rmSync(jsonPath);

    await manager.commit('Remove old.json');

    const files = await git.listFiles({ fs, dir: repoPath, ref: 'HEAD' });
    expect(files).not.toContain('.harborclient/collections/old.json');
    expect(files).toContain('.harborclient/readme.txt');
  });

  it('reports harborRootExists false when the HarborClient subdirectory is missing', async () => {
    const { manager } = await createBareTestRepo();

    const status = await manager.getStatus();
    expect(status.harborRootExists).toBe(false);
    expect(status.harborSubdir).toBe('.harborclient');
  });

  it('rejects commit when the HarborClient subdirectory is missing', async () => {
    const { manager } = await createBareTestRepo();

    await expect(manager.commit('Initial HarborClient layout')).rejects.toThrow(
      'HarborClient subdirectory ".harborclient" does not exist in this repository.'
    );
  });

  it('creates the HarborClient layout and commits when createHarborRoot is true', async () => {
    const { repoPath, manager } = await createBareTestRepo();
    const harborRoot = join(repoPath, '.harborclient');

    await manager.commit('Initial HarborClient layout', { createHarborRoot: true });

    expect(existsSync(join(harborRoot, 'collections'))).toBe(true);
    expect(existsSync(join(harborRoot, 'environments'))).toBe(true);
    expect(existsSync(join(harborRoot, '.gitignore'))).toBe(true);

    const files = await git.listFiles({ fs, dir: repoPath, ref: 'HEAD' });
    expect(files).toContain('.harborclient/.gitignore');

    const status = await manager.getStatus();
    expect(status.harborRootExists).toBe(true);
    expect(status.changedCount).toBe(0);
  });

  it('rejects manual commits when nothing is staged', async () => {
    const { repoPath, manager } = await createTestRepo();
    writeFileSync(join(repoPath, '.harborclient', 'readme.txt'), 'unstaged edit');

    await expect(manager.commit('Manual commit', { autoAdd: false })).rejects.toThrow(
      'No staged changes to commit'
    );
  });

  it('commits only staged changes when auto add is disabled', async () => {
    const { repoPath, manager } = await createTestRepo();
    const stagedPath = '.harborclient/staged.txt';
    const unstagedPath = '.harborclient/unstaged.txt';

    writeFileSync(join(repoPath, stagedPath), 'staged');
    writeFileSync(join(repoPath, unstagedPath), 'unstaged');
    await git.add({ fs, dir: repoPath, filepath: stagedPath });

    await manager.commit('Manual staged commit', { autoAdd: false });

    const files = await git.listFiles({ fs, dir: repoPath, ref: 'HEAD' });
    expect(files).toContain(stagedPath);
    expect(files).not.toContain(unstagedPath);

    const status = await manager.getStatus();
    expect(status.stagedCount).toBe(0);
    expect(status.unstagedCount).toBeGreaterThan(0);
  });

  it('stages and unstages one request by uuid', async () => {
    const { repoPath, manager } = await createTestRepo();
    const collectionUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const requestUuid = '11111111-2222-4333-8444-555555555555';
    const requestRelPath = `.harborclient/collections/${collectionUuid}-demo/requests/${requestUuid}-get-users.json`;
    const requestAbsPath = join(repoPath, requestRelPath);

    mkdirSync(
      join(repoPath, '.harborclient', 'collections', `${collectionUuid}-demo`, 'requests'),
      {
        recursive: true
      }
    );
    writeFileSync(requestAbsPath, '{"name":"Get users"}', 'utf-8');

    await manager.stageRequest(collectionUuid, requestUuid);

    let matrix = await git.statusMatrix({ fs, dir: repoPath, filepaths: ['.harborclient'] });
    const stagedRow = matrix.find((row) => row[0] === requestRelPath);
    expect(stagedRow?.[2]).toBe(stagedRow?.[3]);

    const statuses = await manager.listRequestStatuses(collectionUuid);
    expect(statuses[requestUuid]?.displayStatus).toBe('staged');

    await manager.unstageRequest(collectionUuid, requestUuid);
    matrix = await git.statusMatrix({ fs, dir: repoPath, filepaths: ['.harborclient'] });
    const unstagedRow = matrix.find((row) => row[0] === requestRelPath);
    expect(unstagedRow?.[1]).toBe(unstagedRow?.[3]);
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

  it('returns commit detail with HarborClient file changes', async () => {
    const { repoPath, manager } = await createTestRepo();
    writeFileSync(join(repoPath, '.harborclient', 'readme.txt'), 'v2');
    await git.add({ fs, dir: repoPath, filepath: '.harborclient/readme.txt' });
    const oid = await git.commit({
      fs,
      dir: repoPath,
      message: 'Second',
      author: { name: 'Test', email: 'test@example.com' }
    });

    const detail = await manager.readCommitDetail(oid);

    expect(detail.message).toBe('Second');
    expect(detail.files).toEqual([
      { kind: 'file', path: '.harborclient/readme.txt', status: 'modified' }
    ]);
  });

  it('builds a working-tree diff for one request', async () => {
    const { repoPath, manager } = await createTestRepo();
    const collectionUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const requestUuid = '11111111-2222-4333-8444-555555555555';
    const requestRelPath = `.harborclient/collections/${collectionUuid}-demo/requests/${requestUuid}-get-users.json`;
    const requestAbsPath = join(repoPath, requestRelPath);

    mkdirSync(
      join(repoPath, '.harborclient', 'collections', `${collectionUuid}-demo`, 'requests'),
      { recursive: true }
    );
    writeFileSync(requestAbsPath, '{"name":"Get users","url":"https://example.com"}', 'utf-8');

    const diff = await manager.buildRequestDiff(collectionUuid, requestUuid, 'Get users');

    expect(diff.requestName).toBe('Get users');
    expect(diff.files).toHaveLength(1);
    expect(diff.files[0]?.path).toBe(requestRelPath);
  });

  it('returns one canonical diff when multiple stale request files share a uuid', async () => {
    const { repoPath, manager } = await createTestRepo();
    const collectionUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const requestUuid = '11111111-2222-4333-8444-555555555555';
    const requestsDir = join(
      repoPath,
      '.harborclient',
      'collections',
      `${collectionUuid}-demo`,
      'requests'
    );
    const canonicalRelPath = `.harborclient/collections/${collectionUuid}-demo/requests/${requestUuid}-untitled-request.json`;
    const staleRelPath = `.harborclient/collections/${collectionUuid}-demo/requests/${requestUuid}-echo-get.json`;
    const headRelPath = `.harborclient/collections/${collectionUuid}-demo/requests/${requestUuid}-echo.json`;

    mkdirSync(requestsDir, { recursive: true });
    writeFileSync(join(repoPath, headRelPath), '{"name":"Echo"}', 'utf-8');
    await git.add({ fs, dir: repoPath, filepath: headRelPath });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Add echo request',
      author: { name: 'Test', email: 'test@example.com' }
    });

    writeFileSync(join(repoPath, staleRelPath), '{"name":"Echo GET"}', 'utf-8');
    writeFileSync(join(repoPath, canonicalRelPath), '{"name":"Untitled Request"}', 'utf-8');

    const diff = await manager.buildRequestDiff(collectionUuid, requestUuid, 'Untitled Request');

    expect(diff.files).toHaveLength(1);
    expect(diff.files[0]?.path).toBe(canonicalRelPath);
    expect(diff.files[0]?.status).toBe('modified');
    expect(diff.files[0]?.diff).toContain('Echo');
    expect(diff.files[0]?.diff).toContain('Untitled Request');
  });

  it('reverts tracked modifications and removes untracked request files', async () => {
    const { repoPath, manager } = await createTestRepo();
    const collectionUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const requestUuid = '11111111-2222-4333-8444-555555555555';
    const requestRelPath = `.harborclient/collections/${collectionUuid}-demo/requests/${requestUuid}-get-users.json`;
    const requestAbsPath = join(repoPath, requestRelPath);

    mkdirSync(
      join(repoPath, '.harborclient', 'collections', `${collectionUuid}-demo`, 'requests'),
      { recursive: true }
    );
    writeFileSync(requestAbsPath, '{"name":"Get users"}', 'utf-8');
    await git.add({ fs, dir: repoPath, filepath: requestRelPath });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Add request',
      author: { name: 'Test', email: 'test@example.com' }
    });

    writeFileSync(requestAbsPath, '{"name":"Get users edited"}', 'utf-8');
    await manager.revertRequest(collectionUuid, requestUuid);

    expect(readFileSync(requestAbsPath, 'utf-8')).toBe('{"name":"Get users"}');

    const untrackedUuid = '22222222-3333-4444-8555-666666666666';
    const untrackedRelPath = `.harborclient/collections/${collectionUuid}-demo/requests/${untrackedUuid}-new-request.json`;
    const untrackedAbsPath = join(repoPath, untrackedRelPath);
    writeFileSync(untrackedAbsPath, '{"name":"Untracked request"}', 'utf-8');

    await manager.revertRequest(collectionUuid, untrackedUuid);
    expect(existsSync(untrackedAbsPath)).toBe(false);
  });
});
