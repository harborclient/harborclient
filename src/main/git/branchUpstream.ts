import * as git from 'isomorphic-git';
import fs from 'fs';

/**
 * Writes local branch upstream tracking config so CLI `git push` works without `-u`.
 *
 * Mirrors what `git push -u origin <branch>` records:
 * `branch.<branch>.remote` and `branch.<branch>.merge`.
 *
 * @param repoPath - Absolute path to the git working tree.
 * @param branch - Local branch name to track (defaults to `main` when blank).
 * @param remote - Remote name to track (defaults to `origin`).
 */
export async function ensureBranchUpstream(
  repoPath: string,
  branch: string,
  remote = 'origin'
): Promise<void> {
  const trimmedBranch = branch.trim() || 'main';
  await git.setConfig({
    fs,
    dir: repoPath,
    path: `branch.${trimmedBranch}.remote`,
    value: remote
  });
  await git.setConfig({
    fs,
    dir: repoPath,
    path: `branch.${trimmedBranch}.merge`,
    value: `refs/heads/${trimmedBranch}`
  });
}
