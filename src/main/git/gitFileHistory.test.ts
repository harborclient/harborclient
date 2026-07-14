import * as git from 'isomorphic-git';
import fs, { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildFileCommitDiff, readFileCommitHistory } from '#/main/git/gitFileHistory';

const cleanups: Array<() => void> = [];

/**
 * Creates a temporary git repository with two commits touching one request file.
 */
async function createHistoryRepo(): Promise<{
  repoPath: string;
  filepath: string;
  firstOid: string;
  secondOid: string;
}> {
  const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-file-history-'));
  const filepath = '.harborclient/collection-api/req-get-users.json';
  mkdirSync(join(repoPath, '.harborclient', 'collection-api'), { recursive: true });

  await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
  await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Test' });
  await git.setConfig({ fs, dir: repoPath, path: 'user.email', value: 'test@example.com' });

  writeFileSync(join(repoPath, filepath), '{"url":"v1"}');
  await git.add({ fs, dir: repoPath, filepath });
  const firstOid = await git.commit({
    fs,
    dir: repoPath,
    message: 'Add request v1',
    author: { name: 'Test', email: 'test@example.com' }
  });

  writeFileSync(join(repoPath, filepath), '{"url":"v2"}');
  await git.add({ fs, dir: repoPath, filepath });
  const secondOid = await git.commit({
    fs,
    dir: repoPath,
    message: 'Update request v2',
    author: { name: 'Test', email: 'test@example.com' }
  });

  cleanups.push(() => rmSync(repoPath, { recursive: true, force: true }));
  return { repoPath, filepath, firstOid, secondOid };
}

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe('gitFileHistory', () => {
  it('returns commit history for one file path', async () => {
    const { repoPath, filepath, firstOid, secondOid } = await createHistoryRepo();

    const history = await readFileCommitHistory(repoPath, filepath, 10);

    expect(history).toHaveLength(2);
    expect(history.map((entry) => entry.oid)).toEqual([secondOid, firstOid]);
    expect(history[0]?.message).toBe('Update request v2');
  });

  it('builds a diff between two commits for one file', async () => {
    const { repoPath, filepath, firstOid, secondOid } = await createHistoryRepo();

    const diff = await buildFileCommitDiff({
      repoPath,
      filepath,
      commitA: firstOid,
      commitB: secondOid
    });

    expect(diff.binary).toBe(false);
    expect(diff.diff).toContain('v1');
    expect(diff.diff).toContain('v2');
  });
});
