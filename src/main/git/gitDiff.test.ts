import * as git from 'isomorphic-git';
import fs, { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildGitDiff, buildSingleResourceDiff } from '#/main/git/gitDiff';

const cleanups: Array<() => void> = [];

/**
 * Creates a temporary git repository with an initial HarborClient commit.
 */
async function createTestRepo(): Promise<{ repoPath: string }> {
  const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-diff-'));
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

  cleanups.push(() => rmSync(repoPath, { recursive: true, force: true }));
  return { repoPath };
}

describe('buildGitDiff', () => {
  afterEach(() => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  });

  it('returns added file diffs under the HarborClient tree', async () => {
    const { repoPath } = await createTestRepo();
    writeFileSync(join(repoPath, '.harborclient', 'new.json'), '{"name":"new"}');

    const diff = await buildGitDiff({
      repoPath,
      harborSubdir: '.harborclient'
    });

    expect(diff.changedFileCount).toBe(1);
    expect(diff.files).toHaveLength(1);
    expect(diff.files[0]).toMatchObject({
      path: '.harborclient/new.json',
      status: 'added',
      binary: false
    });
    expect(diff.files[0]?.diff).toContain('new');
  });

  it('reports added and deleted files', async () => {
    const { repoPath } = await createTestRepo();
    writeFileSync(join(repoPath, '.harborclient', 'new.json'), '{"name":"new"}');
    rmSync(join(repoPath, '.harborclient', 'readme.txt'));

    const diff = await buildGitDiff({
      repoPath,
      harborSubdir: '.harborclient'
    });

    expect(diff.changedFileCount).toBe(2);
    const statuses = diff.files.map((file) => file.status).sort();
    expect(statuses).toEqual(['added', 'deleted']);
  });

  it('marks binary files without diff text', async () => {
    const { repoPath } = await createTestRepo();
    const binary = Buffer.from([0, 1, 2, 3, 0, 5]);
    writeFileSync(join(repoPath, '.harborclient', 'blob.bin'), Uint8Array.from(binary));

    const diff = await buildGitDiff({
      repoPath,
      harborSubdir: '.harborclient'
    });

    const binaryEntry = diff.files.find((file) => file.path.endsWith('blob.bin'));
    expect(binaryEntry).toMatchObject({
      status: 'added',
      binary: true
    });
    expect(binaryEntry?.diff).toBeUndefined();
  });

  it('truncates output when total character budget is exceeded', async () => {
    const { repoPath } = await createTestRepo();
    writeFileSync(join(repoPath, '.harborclient', 'large.txt'), 'x'.repeat(500));

    const diff = await buildGitDiff({
      repoPath,
      harborSubdir: '.harborclient',
      maxTotalChars: 40,
      maxCharsPerFile: 40
    });

    expect(diff.truncated).toBe(true);
    expect(diff.files[0]?.truncated).toBe(true);
    expect(diff.files[0]?.diff?.length).toBeLessThanOrEqual(40);
  });
});

describe('buildSingleResourceDiff', () => {
  afterEach(() => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  });

  it('returns one added entry for a new working-tree file', async () => {
    const { repoPath } = await createTestRepo();
    const path = '.harborclient/new.json';
    writeFileSync(join(repoPath, '.harborclient', 'new.json'), '{"name":"new"}');

    const entry = await buildSingleResourceDiff({
      repoPath,
      headPath: null,
      workPath: path
    });

    expect(entry).toMatchObject({
      path,
      status: 'added',
      binary: false
    });
    expect(entry?.diff).toContain('new');
  });

  it('compares HEAD and working content across different paths for a rename', async () => {
    const { repoPath } = await createTestRepo();
    const headPath = '.harborclient/old-name.json';
    const workPath = '.harborclient/new-name.json';

    writeFileSync(join(repoPath, '.harborclient', 'old-name.json'), '{"name":"old"}');
    await git.add({ fs, dir: repoPath, filepath: headPath });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Add old file',
      author: { name: 'Test', email: 'test@example.com' }
    });

    writeFileSync(join(repoPath, '.harborclient', 'new-name.json'), '{"name":"new"}');

    const entry = await buildSingleResourceDiff({
      repoPath,
      headPath,
      workPath
    });

    expect(entry).toMatchObject({
      path: workPath,
      status: 'modified',
      binary: false
    });
    expect(entry?.diff).toContain('old');
    expect(entry?.diff).toContain('new');
  });

  it('returns null when both paths are absent', async () => {
    const { repoPath } = await createTestRepo();

    const entry = await buildSingleResourceDiff({
      repoPath,
      headPath: null,
      workPath: null
    });

    expect(entry).toBeNull();
  });
});
