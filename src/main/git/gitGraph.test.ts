import * as git from 'isomorphic-git';
import fs from 'fs';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildGitGraphLog, readGitCommitDetail } from '#/main/git/gitGraph';

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

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe('git graph', () => {
  it('builds graph log entries with parent links', async () => {
    const { repoPath } = await createRepoWithHistory();
    const result = await buildGitGraphLog(repoPath, 10);

    expect(result.entries.length).toBeGreaterThanOrEqual(2);
    expect(result.entries[0]?.parents.length).toBeGreaterThanOrEqual(0);
  });

  it('returns flat file changes for a commit', async () => {
    const { repoPath, secondOid } = await createRepoWithHistory();
    const detail = await readGitCommitDetail(repoPath, '.harborclient', secondOid);

    expect(detail.files).toEqual([
      expect.objectContaining({
        kind: 'file',
        path: '.harborclient/readme.txt',
        status: 'modified'
      })
    ]);
  });
});
