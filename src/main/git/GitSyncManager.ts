import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs, { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { buildGitOnAuth, resolveGitAuth, resolveGitAuthForHost } from './gitAuth';
import { ensureHarborclientLayout, resolveHarborclientRoot } from './fileLayout';
import {
  analyzeMatrixRow,
  countStagedAndUnstaged,
  loadHarborStatusMatrix,
  type GitMatrixRow,
  type GitRequestRowFlags
} from './gitRequestStatus';
import { countConflictFiles, pullMergeConflictMessage } from './slug';
import { buildGitGraphLog, readGitCommitDetail } from './gitGraph';
import { validateRemoteCredentials, type GitRemoteValidationResult } from './gitRemoteValidation';
import { formatGitHttpError, type GitHttpOperation } from '#/shared/gitHttpErrors';
import { normalizeGitHostKey } from '#/shared/gitUrl';
import { parseGitHubRepo } from '#/shared/plugin/githubRaw';
import { getGitIdentity } from './gitIdentities';
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
   * Commits the collection's tracked changes.
   *
   * Stages modifications and deletions of already-tracked files under the
   * collection prefix (git commit -a semantics) and commits them. Untracked
   * files are never swept in here; they become tracked when created (Auto track)
   * or via an explicit Add, independent of committing.
   *
   * @param message - Commit message.
   * @param options - Collection scope and HarborClient layout bootstrap.
   */
  async commit(
    message: string,
    options?: {
      createHarborRoot?: boolean;
      collectionPrefix?: string;
      /**
       * Extra repository-relative filepaths to include (for example harbor-root
       * markdown documents owned by the collection but outside the folder prefix).
       */
      additionalFilepaths?: string[];
      author?: { name?: string; email?: string };
    }
  ): Promise<void> {
    const subdir = this.harborSubdir();
    const harborRoot = resolveHarborclientRoot(this.#repoPath, subdir);
    const collectionPrefix = options?.collectionPrefix?.replace(/\\/g, '/').replace(/\/+$/, '');

    if (!collectionPrefix) {
      throw new Error('Collection prefix is required for git commit.');
    }

    let bootstrapped = false;
    if (!existsSync(harborRoot)) {
      if (!options?.createHarborRoot) {
        throw new Error(`HarborClient subdirectory "${subdir}" does not exist in this repository.`);
      }
      ensureHarborclientLayout(harborRoot);
      await this.stageFile(`${subdir}/.gitignore`);
      bootstrapped = true;
    }

    let stagedTracked = await this.stageTrackedChanges(collectionPrefix);
    for (const filepath of options?.additionalFilepaths ?? []) {
      const trimmed = filepath.trim().replace(/\\/g, '/');
      if (!trimmed || trimmed === collectionPrefix || trimmed.startsWith(`${collectionPrefix}/`)) {
        continue;
      }
      if (await this.stageTrackedChanges(trimmed)) {
        stagedTracked = true;
      }
    }
    if (!stagedTracked && !bootstrapped) {
      throw new Error('No changes to commit.');
    }

    const trimmed = message.trim();
    if (!trimmed) {
      throw new Error('Commit message is required.');
    }

    await git.commit({
      fs,
      dir: this.#repoPath,
      message: trimmed,
      author: await this.resolveAuthor(options?.author)
    });
  }

  /**
   * Fetches from the configured remote over HTTPS.
   */
  async fetch(): Promise<void> {
    try {
      await git.fetch({
        fs,
        http,
        dir: this.#repoPath,
        url: this.#settings.url,
        ref: this.#settings.branch,
        singleBranch: true,
        onAuth: buildGitOnAuth(this.#connectionId)
      });
    } catch (err) {
      throw this.wrapRemoteError(err, 'fetch');
    }
  }

  /**
   * Pulls (fetch + merge) from the configured remote.
   */
  async pull(): Promise<void> {
    const existingStatus = await this.getStatus();
    if (existingStatus.conflictCount > 0) {
      throw new Error(pullMergeConflictMessage(existingStatus.conflictCount));
    }

    try {
      await this.fetch();
    } catch (err) {
      // fetch() already formats HTTP errors; rethrow as pull when still generic.
      throw this.wrapRemoteError(err, 'pull');
    }

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
      throw this.wrapRemoteError(err, 'pull');
    }
  }

  /**
   * Pushes commits to the configured remote.
   */
  async push(): Promise<void> {
    const branch = (await this.currentBranch()) ?? this.#settings.branch;
    try {
      await git.push({
        fs,
        http,
        dir: this.#repoPath,
        url: this.#settings.url,
        ref: branch,
        onAuth: buildGitOnAuth(this.#connectionId)
      });
    } catch (err) {
      throw this.wrapRemoteError(err, 'push');
    }
  }

  /**
   * Rewraps a remote git HTTP error with an actionable user-facing message.
   *
   * Already-formatted HarborClient messages are returned unchanged so nested
   * pull→fetch failures are not double-prefixed. GitHub 404s include the
   * signed-in account and org SSO hint when available.
   *
   * @param err - Error thrown by isomorphic-git or a nested sync helper.
   * @param operation - Remote operation label for the formatted message.
   * @returns Error with a user-facing message.
   */
  private wrapRemoteError(err: unknown, operation: GitHttpOperation): Error {
    const host = this.resolveSettingsHost();
    const message = formatGitHttpError(err, operation, {
      githubLogin: host ? getGitIdentity(host)?.githubLogin : null,
      owner: parseGitHubRepo(this.#settings.url)?.owner ?? null
    });
    if (err instanceof Error && err.message === message) {
      return err;
    }
    return new Error(message);
  }

  /**
   * Resolves the normalized host key for this connection's remote URL.
   *
   * @returns Lowercase hostname, or null when the URL is unparseable.
   */
  private resolveSettingsHost(): string | null {
    return normalizeGitHostKey(this.#settings.url);
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
   * @param options - Optional commit author override from app settings.
   */
  async mergeBranch(
    name: string,
    options?: { author?: { name?: string; email?: string } }
  ): Promise<{ conflictCount: number }> {
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

    const author = await this.resolveAuthor(options?.author);

    try {
      await git.merge({
        fs,
        dir: this.#repoPath,
        ours: branch,
        theirs: trimmed,
        abortOnConflict: false,
        author,
        committer: author
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
    const matrix = await loadHarborStatusMatrix(this.#repoPath, this.harborSubdir());

    const result: Record<string, GitRequestRowFlags> = {};
    for (const row of matrix) {
      const [filepath] = row;
      if (filepath !== normalizedPrefix && !filepath.startsWith(`${normalizedPrefix}/`)) {
        continue;
      }
      const flags = analyzeMatrixRow(row);
      if (flags != null) {
        result[filepath] = flags;
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
   * Returns recent commit log entries annotated with push status when known.
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
    const branch = await this.currentBranch();
    const { syncKnown, aheadOids } =
      branch != null
        ? await this.collectAheadOids(branch, depth)
        : { syncKnown: false, aheadOids: new Set<string>() };

    return commits.map((entry) => {
      const base: GitLogEntry = {
        oid: entry.oid,
        message: entry.commit.message.split('\n')[0] ?? '',
        author: entry.commit.author.name,
        timestamp: new Date(entry.commit.author.timestamp * 1000).toISOString()
      };
      if (!syncKnown) {
        return base;
      }
      return {
        ...base,
        pushedToOrigin: !aheadOids.has(entry.oid)
      };
    });
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
   * Validates credentials against the configured remote (REST for GitHub, refs otherwise).
   *
   * Empty remotes succeed with {@link GitRemoteValidationResult.emptyRemote} set.
   * GitHub probes also report {@link GitRemoteValidationResult.canPush}.
   *
   * @returns Validation outcome including empty-remote and optional push capability.
   */
  async testCredentials(): Promise<GitRemoteValidationResult> {
    const host = this.resolveSettingsHost();
    return validateRemoteCredentials(
      this.#settings.url,
      this.#settings.branch,
      () => resolveGitAuth(this.#connectionId),
      { githubLogin: host ? getGitIdentity(host)?.githubLogin : null }
    );
  }

  /**
   * Validates credentials for a shared git host identity.
   *
   * @param host - Normalized lowercase git host key.
   * @returns Validation outcome including empty-remote and optional push capability.
   */
  async testCredentialsForHost(host: string): Promise<GitRemoteValidationResult> {
    return validateRemoteCredentials(
      this.#settings.url,
      this.#settings.branch,
      () => resolveGitAuthForHost(host),
      { githubLogin: getGitIdentity(host)?.githubLogin }
    );
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
   * Collects commit OIDs that are ahead of the origin tracking ref.
   *
   * Uses the same refs as {@link countAheadBehind}. When sync is known and local
   * matches origin, returns an empty set. When the origin ref is missing or
   * comparison fails, returns `syncKnown: false`.
   *
   * @param branch - Current branch name.
   * @param maxDepth - Maximum number of ahead commits to collect.
   * @returns Whether sync comparison succeeded, plus the set of unpushed OIDs.
   */
  private async collectAheadOids(
    branch: string,
    maxDepth: number
  ): Promise<{ syncKnown: boolean; aheadOids: Set<string> }> {
    const unknown = { syncKnown: false as const, aheadOids: new Set<string>() };

    try {
      const localOid = await git.resolveRef({ fs, dir: this.#repoPath, ref: 'HEAD' });
      const remoteOid = await git.resolveRef({
        fs,
        dir: this.#repoPath,
        ref: `refs/remotes/origin/${branch}`
      });

      if (localOid === remoteOid) {
        return { syncKnown: true, aheadOids: new Set() };
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

      const aheadOids = new Set<string>();
      const commits = await git.log({
        fs,
        dir: this.#repoPath,
        ref: localOid,
        depth: maxDepth
      });
      for (const commit of commits) {
        if (commit.oid === baseOid) {
          break;
        }
        aheadOids.add(commit.oid);
      }
      return { syncKnown: true, aheadOids };
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
   * Resolves commit author from app override, git config, or HarborClient defaults.
   *
   * @param override - Optional app-level author name and email.
   */
  private async resolveAuthor(override?: {
    name?: string;
    email?: string;
  }): Promise<{ name: string; email: string }> {
    const overrideName = override?.name?.trim() ?? '';
    const overrideEmail = override?.email?.trim() ?? '';
    if (overrideName && overrideEmail) {
      return { name: overrideName, email: overrideEmail };
    }

    try {
      const name = await git.getConfig({ fs, dir: this.#repoPath, path: 'user.name' });
      const email = await git.getConfig({ fs, dir: this.#repoPath, path: 'user.email' });
      if (typeof name === 'string' && typeof email === 'string' && name && email) {
        return { name, email };
      }
    } catch {
      // Fall through to defaults.
    }
    return { name: 'HarborClient', email: 'contact@harborclient.com' };
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
   * Stages modifications and deletions of already-tracked files under a
   * repository-relative prefix (git add -u semantics). Untracked files are
   * skipped so they are only committed once they have been tracked explicitly.
   *
   * @param relPath - Path relative to repo root.
   * @returns Whether any tracked change under the prefix is staged afterward.
   */
  private async stageTrackedChanges(relPath: string): Promise<boolean> {
    const prefix = relPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const matrix = await loadHarborStatusMatrix(this.#repoPath, this.harborSubdir());

    let staged = false;
    for (const row of matrix) {
      const [filepath] = row;
      if (filepath !== prefix && !filepath.startsWith(`${prefix}/`)) {
        continue;
      }
      const flags = analyzeMatrixRow(row as GitMatrixRow);
      if (flags == null || flags.isUntracked) {
        continue;
      }
      await this.stageMatrixRow(row as GitMatrixRow);
      staged = true;
    }
    return staged;
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
