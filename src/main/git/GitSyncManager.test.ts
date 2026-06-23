import * as git from 'isomorphic-git';
import fs from 'fs';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
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
});
