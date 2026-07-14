import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs, { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { buildGitOnAuth, resolveGitAuthForHost } from '#/main/git/gitAuth';
import { ensureHarborclientLayout, resolveHarborclientRoot } from '#/main/git/fileLayout';
import {
  analyzeMatrixRow,
  countStagedAndUnstaged,
  hasStagedChanges,
  loadHarborStatusMatrix,
  type GitMatrixRow,
  type GitRequestRowFlags
} from '#/main/git/gitRequestStatus';
import { countConflictFiles, pullMergeConflictMessage } from '#/main/git/slug';
import { buildGitGraphLog, readGitCommitDetail } from '#/main/git/gitGraph';
import type {
  GitCommitDetail,
  GitGraphLogResult,
  GitLogEntry,
  GitSettings,
  SourceControlStatus
} from '#/shared/types';

/**
 * Git operations for a single linked repository working tree.
 */
export class GitSyncManager {
  readonly #repoPath: string;
  readonly #settings: GitSettings;
  readonly #connectionId: string;

  /**
   * @param connectionId - Git connection id for auth resolution.
   * @param settings - Git connection settings including repo path and remote url.
   */
  constructor(connectionId: string, settings: GitSettings) {
    this.#connectionId = connectionId;
    this.#settings = settings;
    this.#repoPath = settings.repoPath;
  }

  /**
   * Absolute repository root used as isomorphic-git dir.
   */
  get repoDir(): string {
    return this.#repoPath;
  }

  /**
   * Returns local source-control status without network access.
   */
  async getStatus(): Promise<SourceControlStatus> {
    const harborSubdir = this.harborSubdir();
    const harborRoot = resolveHarborclientRoot(this.#repoPath, harborSubdir);
    const matrix = await loadHarborStatusMatrix(this.#repoPath, harborSubdir);
    const { changedCount, stagedCount, unstagedCount } = countStagedAndUnstaged(matrix);
    const modifiedJsonFiles: string[] = [];

    for (const row of matrix) {
      const [filepath, head, workdir, stage] = row;
      if (head !== workdir || head !== stage || workdir !== stage) {
        if (filepath.endsWith('.json')) {
          modifiedJsonFiles.push(join(this.#repoPath, filepath));
        }
      }
    }

    const branch = await this.currentBranch();
    const { ahead, behind, syncKnown } =
      branch != null
        ? await this.countAheadBehind(branch)
        : { ahead: 0, behind: 0, syncKnown: false };

    return {
      changedCount,
      stagedCount,
      unstagedCount,
      branch,
      ahead,
      behind,
      syncKnown,
      conflictCount: await countConflictFiles(modifiedJsonFiles),
      harborRootExists: existsSync(harborRoot),
      harborSubdir
    };
  }

  /**
   * Stages all changes under the HarborClient subdirectory and commits, or commits
   * only staged changes when auto-add is disabled.
   *
   * @param message - Commit message.
   * @param options - Commit behavior and HarborClient layout bootstrap.
   */
  async commit(
    message: string,
    options?: { createHarborRoot?: boolean; autoAdd?: boolean }
  ): Promise<void> {
    const subdir = this.harborSubdir();
    const harborRoot = resolveHarborclientRoot(this.#repoPath, subdir);
    const autoAdd = options?.autoAdd !== false;

    if (!existsSync(harborRoot)) {
      if (!options?.createHarborRoot) {
        throw new Error(`HarborClient subdirectory "${subdir}" does not exist in this repository.`);
      }
      ensureHarborclientLayout(harborRoot);
    }

    if (autoAdd) {
      await this.stagePath(subdir);
    } else {
      const matrix = await loadHarborStatusMatrix(this.#repoPath, subdir);
      if (!hasStagedChanges(matrix)) {
        throw new Error(
          'No staged changes to commit. Stage files or enable Auto add in Git settings.'
        );
      }
    }

    const trimmed = message.trim();
    if (!trimmed) {
      throw new Error('Commit message is required.');
    }

    await git.commit({
      fs,
      dir: this.#repoPath,
      message: trimmed,
      author: await this.resolveAuthor()
    });
  }

  /**
   * Fetches from the configured remote over HTTPS.
   */
  async fetch(): Promise<void> {
    await git.fetch({
      fs,
      http,
      dir: this.#repoPath,
      url: this.#settings.url,
      ref: this.#settings.branch,
      singleBranch: true,
      onAuth: buildGitOnAuth(this.#connectionId)
    });
  }

  /**
   * Pulls (fetch + merge) from the configured remote.
   */
  async pull(): Promise<void> {
    const existingStatus = await this.getStatus();
    if (existingStatus.conflictCount > 0) {
      throw new Error(pullMergeConflictMessage(existingStatus.conflictCount));
    }

    await this.fetch();
    const branch = await git.currentBranch({ fs, dir: this.#repoPath });
    if (!branch) {
      throw new Error('Cannot pull: repository is not on a branch.');
    }

    try {
      await git.merge({
        fs,
        dir: this.#repoPath,
        ours: branch,
        theirs: `origin/${this.#settings.branch}`,
        abortOnConflict: false
      });
    } catch (err) {
      const mergeConflictCount = countJsonMergeConflicts(err);
      if (mergeConflictCount > 0) {
        throw new Error(pullMergeConflictMessage(mergeConflictCount));
      }
      throw err;
    }
  }

  /**
   * Pushes commits to the configured remote.
   */
  async push(): Promise<void> {
    const branch = (await this.currentBranch()) ?? this.#settings.branch;
    await git.push({
      fs,
      http,
      dir: this.#repoPath,
      url: this.#settings.url,
      ref: branch,
      onAuth: buildGitOnAuth(this.#connectionId)
    });
  }

  /**
   * Returns local branch names in the repository.
   */
  async listBranches(): Promise<string[]> {
    const branches = await git.listBranches({ fs, dir: this.#repoPath });
    return [...branches].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Creates a new branch from the current commit and checks it out.
   *
   * @param name - Branch name to create.
   */
  async createBranch(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Branch name is required.');
    }

    const existing = await this.listBranches();
    if (existing.includes(trimmed)) {
      throw new Error(`Branch "${trimmed}" already exists.`);
    }

    await git.branch({
      fs,
      dir: this.#repoPath,
      ref: trimmed,
      checkout: true
    });
  }

  /**
   * Deletes a local branch that is not currently checked out.
   *
   * @param name - Branch name to delete.
   */
  async deleteBranch(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Branch name is required.');
    }

    const branch = await git.currentBranch({ fs, dir: this.#repoPath });
    if (branch === trimmed) {
      throw new Error('Cannot delete the currently checked-out branch.');
    }

    const existing = await this.listBranches();
    if (!existing.includes(trimmed)) {
      throw new Error(`Branch "${trimmed}" does not exist.`);
    }

    await git.deleteBranch({ fs, dir: this.#repoPath, ref: trimmed });
  }

  /**
   * Merges another local branch into the current branch.
   *
   * Conflict markers are written to disk when merges cannot complete cleanly.
   * Returns the number of JSON files containing conflict markers afterward.
   *
   * @param name - Local branch name to merge into the current branch.
   */
  async mergeBranch(name: string): Promise<{ conflictCount: number }> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Branch name is required.');
    }

    const branch = await git.currentBranch({ fs, dir: this.#repoPath });
    if (!branch) {
      throw new Error('Cannot merge: repository is not on a branch.');
    }

    if (trimmed === branch) {
      throw new Error('Cannot merge the current branch into itself.');
    }

    const existing = await this.listBranches();
    if (!existing.includes(trimmed)) {
      throw new Error(`Branch "${trimmed}" does not exist.`);
    }

    try {
      await git.merge({
        fs,
        dir: this.#repoPath,
        ours: branch,
        theirs: trimmed,
        abortOnConflict: false
      });
    } catch (err) {
      const mergeConflictCount = countJsonMergeConflicts(err);
      if (mergeConflictCount === 0) {
        throw err;
      }
    }

    const status = await this.getStatus();
    return { conflictCount: status.conflictCount };
  }

  /**
   * Stages one repository-relative file after conflict resolution.
   *
   * @param filepath - Path relative to the repository root.
   */
  async stageFile(filepath: string): Promise<void> {
    const trimmed = filepath.trim();
    if (!trimmed) {
      throw new Error('File path is required.');
    }

    await git.add({ fs, dir: this.#repoPath, filepath: trimmed });
  }

  /**
   * Unstages one repository-relative file, resetting the index entry to HEAD.
   *
   * @param filepath - Path relative to the repository root.
   */
  async unstageFile(filepath: string): Promise<void> {
    const trimmed = filepath.trim();
    if (!trimmed) {
      throw new Error('File path is required.');
    }

    await git.resetIndex({ fs, dir: this.#repoPath, filepath: trimmed });
  }

  /**
   * Discards working-tree and index changes for one repository-relative file.
   *
   * New files are removed from disk; tracked files are restored from HEAD.
   *
   * @param filepath - Path relative to the repository root.
   */
  async revertFile(filepath: string): Promise<void> {
    const trimmed = filepath.trim();
    if (!trimmed) {
      throw new Error('File path is required.');
    }

    const matrix = (await git.statusMatrix({
      fs,
      dir: this.#repoPath,
      filepaths: [trimmed]
    })) as GitMatrixRow[];
    const row = matrix.find(([path]) => path === trimmed);
    if (row == null) {
      throw new Error('File is not changed.');
    }

    const [, head, workdir, stage] = row;
    if (head === workdir && workdir === stage) {
      throw new Error('File has no changes to revert.');
    }

    if (head === 0) {
      if (workdir !== 0) {
        const fullPath = join(this.#repoPath, trimmed);
        if (existsSync(fullPath)) {
          rmSync(fullPath);
        }
      }
      if (stage !== 0) {
        await git.resetIndex({ fs, dir: this.#repoPath, filepath: trimmed });
      }
      return;
    }

    await git.checkout({
      fs,
      dir: this.#repoPath,
      filepaths: [trimmed],
      force: true
    });
    await git.resetIndex({ fs, dir: this.#repoPath, filepath: trimmed });
  }

  /**
   * Returns per-file git change flags for paths under a repository-relative prefix.
   *
   * @param prefix - Repository-relative folder prefix (for example `.harborclient/collection-api`).
   */
  async getPathFlagsUnderPrefix(prefix: string): Promise<Record<string, GitRequestRowFlags>> {
    const normalizedPrefix = prefix.replace(/\\/g, '/').replace(/\/+$/, '');
    const matrix = (await git.statusMatrix({
      fs,
      dir: this.#repoPath,
      filter: (filepath) =>
        filepath === normalizedPrefix || filepath.startsWith(`${normalizedPrefix}/`)
    })) as GitMatrixRow[];

    const result: Record<string, GitRequestRowFlags> = {};
    for (const row of matrix) {
      const flags = analyzeMatrixRow(row);
      if (flags != null) {
        result[row[0]] = flags;
      }
    }
    return result;
  }

  /**
   * Reads raw text from a repository-relative file.
   *
   * @param filepath - Path relative to the repository root.
   */
  async readRepoFile(filepath: string): Promise<string> {
    const trimmed = filepath.trim();
    if (!trimmed) {
      throw new Error('File path is required.');
    }

    const fullPath = join(this.#repoPath, trimmed);
    const { readFile } = await import('fs/promises');
    return readFile(fullPath, 'utf-8');
  }

  /**
   * Writes raw text to a repository-relative file.
   *
   * @param filepath - Path relative to the repository root.
   * @param content - Full file contents to write.
   */
  async writeRepoFile(filepath: string, content: string): Promise<void> {
    const trimmed = filepath.trim();
    if (!trimmed) {
      throw new Error('File path is required.');
    }

    const fullPath = join(this.#repoPath, trimmed);
    const { writeFile } = await import('fs/promises');
    await writeFile(fullPath, content, 'utf-8');
  }

  /**
   * Checks out an existing local branch when the working tree is clean.
   *
   * @param name - Branch name to check out.
   */
  async checkoutBranch(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Branch name is required.');
    }

    const status = await this.getStatus();
    if (status.changedCount > 0) {
      throw new Error('Commit or discard your changes before switching branches.');
    }

    const existing = await this.listBranches();
    if (!existing.includes(trimmed)) {
      throw new Error(`Branch "${trimmed}" does not exist.`);
    }

    await git.checkout({
      fs,
      dir: this.#repoPath,
      ref: trimmed
    });
  }

  /**
   * Returns recent commit log entries.
   *
   * @param depth - Maximum number of commits.
   */
  async log(depth = 20): Promise<GitLogEntry[]> {
    // A repository with no commits (unborn HEAD) has no history to walk. Resolve
    // HEAD first so we can return an empty log instead of letting `git.log` throw
    // NotFoundError for the not-yet-created branch ref.
    try {
      await git.resolveRef({ fs, dir: this.#repoPath, ref: 'HEAD' });
    } catch {
      return [];
    }

    const commits = await git.log({ fs, dir: this.#repoPath, depth });
    return commits.map((entry) => ({
      oid: entry.oid,
      message: entry.commit.message.split('\n')[0] ?? '',
      author: entry.commit.author.name,
      timestamp: new Date(entry.commit.author.timestamp * 1000).toISOString()
    }));
  }

  /**
   * Returns graph-ready commit history with parent links and branch refs.
   *
   * @param depth - Maximum number of commits to include.
   */
  async graphLog(depth = 100): Promise<GitGraphLogResult> {
    return buildGitGraphLog(this.#repoPath, depth);
  }

  /**
   * Returns detailed metadata and HarborClient file changes for one commit.
   *
   * @param oid - Commit object id.
   */
  async readCommitDetail(oid: string): Promise<GitCommitDetail> {
    return readGitCommitDetail(this.#repoPath, this.harborSubdir(), oid);
  }

  /**
   * Validates credentials by attempting a fetch.
   */
  async testCredentials(): Promise<void> {
    await this.fetch();
  }

  /**
   * Validates credentials for a shared git host identity.
   *
   * @param host - Normalized lowercase git host key.
   */
  async testCredentialsForHost(host: string): Promise<void> {
    await git.fetch({
      fs,
      http,
      dir: this.#repoPath,
      url: this.#settings.url,
      ref: this.#settings.branch,
      singleBranch: true,
      onAuth: async () => resolveGitAuthForHost(host)
    });
  }

  /**
   * Counts local commits ahead of and behind the cached origin tracking ref.
   *
   * Uses refs/remotes/origin/{branch} updated by fetch/pull; no network access.
   *
   * @param branch - Current branch name.
   * @returns Ahead/behind counts relative to the origin tracking ref, plus whether
   *   the remote tracking ref was available for comparison.
   */
  private async countAheadBehind(
    branch: string
  ): Promise<{ ahead: number; behind: number; syncKnown: boolean }> {
    const unknown = { ahead: 0, behind: 0, syncKnown: false as const };

    try {
      const localOid = await git.resolveRef({ fs, dir: this.#repoPath, ref: 'HEAD' });
      const remoteOid = await git.resolveRef({
        fs,
        dir: this.#repoPath,
        ref: `refs/remotes/origin/${branch}`
      });

      if (localOid === remoteOid) {
        return { ahead: 0, behind: 0, syncKnown: true };
      }

      const mergeBases = await git.findMergeBase({
        fs,
        dir: this.#repoPath,
        oids: [localOid, remoteOid]
      });
      const baseOid = mergeBases[0];
      if (baseOid == null) {
        return unknown;
      }

      const ahead = await this.countCommitsSince(localOid, baseOid);
      const behind = await this.countCommitsSince(remoteOid, baseOid);
      return { ahead, behind, syncKnown: true };
    } catch {
      return unknown;
    }
  }

  /**
   * Counts commits reachable from ref, stopping when stopOid is reached.
   *
   * @param ref - Commit oid or ref name to walk from.
   * @param stopOid - Merge-base oid to stop at (exclusive).
   * @returns Number of commits between ref and stopOid.
   */
  private async countCommitsSince(ref: string, stopOid: string): Promise<number> {
    let count = 0;
    const commits = await git.log({ fs, dir: this.#repoPath, ref, depth: 50 });
    for (const commit of commits) {
      if (commit.oid === stopOid) {
        break;
      }
      count += 1;
    }
    return count;
  }

  /**
   * Returns the current branch name, if any.
   */
  private async currentBranch(): Promise<string | null> {
    try {
      const branch = await git.currentBranch({ fs, dir: this.#repoPath });
      return branch ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Resolves commit author from git config or falls back to HarborClient defaults.
   */
  private async resolveAuthor(): Promise<{ name: string; email: string }> {
    try {
      const name = await git.getConfig({ fs, dir: this.#repoPath, path: 'user.name' });
      const email = await git.getConfig({ fs, dir: this.#repoPath, path: 'user.email' });
      if (typeof name === 'string' && typeof email === 'string' && name && email) {
        return { name, email };
      }
    } catch {
      // Fall through to defaults.
    }
    return { name: 'HarborClient', email: 'harborclient@local' };
  }

  /**
   * Returns the configured HarborClient subdirectory relative to the repository root.
   */
  private harborSubdir(): string {
    const trimmed = this.#settings.subdir.trim();
    return trimmed && trimmed !== '.' ? trimmed : '.';
  }

  /**
   * Stages one changed matrix row.
   *
   * @param row - statusMatrix row for a single file.
   */
  private async stageMatrixRow(row: GitMatrixRow): Promise<void> {
    const [filepath, , workdir, stage] = row;
    if (workdir === stage) {
      return;
    }

    if (workdir === 0) {
      await git.remove({ fs, dir: this.#repoPath, filepath });
    } else {
      await git.add({ fs, dir: this.#repoPath, filepath });
    }
  }

  /**
   * Stages all changes under a repository-relative path (adds, modifications, deletions).
   *
   * @param relPath - Path relative to repo root.
   */
  private async stagePath(relPath: string): Promise<void> {
    const prefix = relPath.replace(/\\/g, '/');
    const matrix = await git.statusMatrix({
      fs,
      dir: this.#repoPath,
      filter: (filepath) => filepath === prefix || filepath.startsWith(`${prefix}/`)
    });

    for (const row of matrix) {
      await this.stageMatrixRow(row as GitMatrixRow);
    }
  }
}

/**
 * Returns the number of JSON paths reported in a merge conflict error.
 *
 * @param err - Error thrown by `git.merge` when conflicts occur.
 * @returns Count of `.json` filepaths in the merge error payload, or zero when not applicable.
 */
function countJsonMergeConflicts(err: unknown): number {
  if (
    typeof err !== 'object' ||
    err == null ||
    !('code' in err) ||
    (err as { code: string }).code !== 'MergeConflictError' ||
    !('data' in err)
  ) {
    return 0;
  }

  const filepaths = (err as { data?: { filepaths?: unknown } }).data?.filepaths;
  if (!Array.isArray(filepaths)) {
    return 0;
  }

  return filepaths.filter((filepath): filepath is string => {
    return typeof filepath === 'string' && filepath.endsWith('.json');
  }).length;
}
