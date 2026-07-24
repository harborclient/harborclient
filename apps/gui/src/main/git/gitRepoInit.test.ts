import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as git from 'isomorphic-git';
import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { ensureBranchUpstream } from './branchUpstream';

describe('git repository detection and initialization', () => {
  it('returns false when a directory is not a git repository', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hc-git-not-repo-'));
    try {
      let isRepo = false;
      try {
        const root = await git.findRoot({ fs, filepath: dir });
        isRepo = root === dir;
      } catch {
        isRepo = false;
      }
      expect(isRepo).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('initializes a repository, sets the default branch, adds origin, and tracks upstream', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hc-git-init-'));
    const remoteUrl = 'https://github.com/example/repo.git';
    const branch = 'main';

    try {
      await git.init({ fs, dir, defaultBranch: branch });
      await git.addRemote({
        fs,
        dir,
        remote: 'origin',
        url: remoteUrl,
        force: true
      });
      await ensureBranchUpstream(dir, branch);

      const root = await git.findRoot({ fs, filepath: dir });
      expect(root).toBe(dir);
      expect(existsSync(join(dir, '.git'))).toBe(true);

      const remotes = await git.listRemotes({ fs, dir });
      expect(remotes).toEqual([{ remote: 'origin', url: remoteUrl }]);

      const currentBranch = await git.currentBranch({ fs, dir });
      expect(currentBranch).toBe(branch);

      const upstreamRemote = await git.getConfig({ fs, dir, path: 'branch.main.remote' });
      const upstreamMerge = await git.getConfig({ fs, dir, path: 'branch.main.merge' });
      expect(upstreamRemote).toBe('origin');
      expect(upstreamMerge).toBe('refs/heads/main');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not set upstream tracking when init has no remote URL', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hc-git-init-no-remote-'));
    const branch = 'main';

    try {
      await git.init({ fs, dir, defaultBranch: branch });

      const upstreamRemote = await git.getConfig({ fs, dir, path: 'branch.main.remote' });
      const upstreamMerge = await git.getConfig({ fs, dir, path: 'branch.main.merge' });
      expect(upstreamRemote).toBeUndefined();
      expect(upstreamMerge).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
