import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs, { existsSync } from 'fs';
import { join } from 'path';
import { buildGitOnAuth } from '#/main/git/gitAuth';
import { ensureHarborclientLayout, resolveHarborclientRoot } from '#/main/git/fileLayout';
import { countConflictFiles, pullMergeConflictMessage } from '#/main/git/slug';
import type { GitLogEntry, GitSettings, SourceControlStatus } from '#/shared/types';

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

    const matrix = await git.statusMatrix({ fs, dir: this.#repoPath, filepaths: [harborSubdir] });
    let changedCount = 0;
    const modifiedJsonFiles: string[] = [];
    for (const row of matrix) {
      const [filepath, head, workdir, stage] = row;
      if (head !== workdir || head !== stage || workdir !== stage) {
        changedCount += 1;
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

    const status = {
      changedCount,
      branch,
      ahead,
      behind,
      syncKnown,
      conflictCount: await countConflictFiles(modifiedJsonFiles),
      harborRootExists: existsSync(harborRoot),
      harborSubdir
    };
    return status;
  }

  /**
   * Stages all changes under the HarborClient subdirectory and commits.
   *
   * @param message - Commit message.
   * @param options - When `createHarborRoot` is true, creates the HarborClient layout if missing.
   */
  async commit(message: string, options?: { createHarborRoot?: boolean }): Promise<void> {
    const subdir = this.harborSubdir();
    const harborRoot = resolveHarborclientRoot(this.#repoPath, subdir);

    if (!existsSync(harborRoot)) {
      if (!options?.createHarborRoot) {
        throw new Error(`HarborClient subdirectory "${subdir}" does not exist in this repository.`);
      }
      ensureHarborclientLayout(harborRoot);
    }

    await this.stagePath(subdir);

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
    await git.push({
      fs,
      http,
      dir: this.#repoPath,
      url: this.#settings.url,
      ref: this.#settings.branch,
      onAuth: buildGitOnAuth(this.#connectionId)
    });
  }

  /**
   * Returns recent commit log entries.
   *
   * @param depth - Maximum number of commits.
   */
  async log(depth = 20): Promise<GitLogEntry[]> {
    const commits = await git.log({ fs, dir: this.#repoPath, depth });
    return commits.map((entry) => ({
      oid: entry.oid,
      message: entry.commit.message.split('\n')[0] ?? '',
      author: entry.commit.author.name,
      timestamp: new Date(entry.commit.author.timestamp * 1000).toISOString()
    }));
  }

  /**
   * Validates credentials by attempting a fetch.
   */
  async testCredentials(): Promise<void> {
    await this.fetch();
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
    return this.#settings.subdir.trim() || '.harborclient';
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
      const [filepath, , workdir, stage] = row;
      if (workdir === stage) {
        continue;
      }

      if (workdir === 0) {
        await git.remove({ fs, dir: this.#repoPath, filepath });
      } else {
        await git.add({ fs, dir: this.#repoPath, filepath });
      }
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
