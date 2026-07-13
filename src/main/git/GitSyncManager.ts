import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs, { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { buildGitOnAuth, resolveGitAuthForHost } from '#/main/git/gitAuth';
import { ensureHarborclientLayout, resolveHarborclientRoot } from '#/main/git/fileLayout';
import {
  buildDocumentStatusesForCollection,
  buildRequestStatusesForCollection,
  countStagedAndUnstaged,
  documentRowsForUuid,
  hasStagedChanges,
  loadHarborStatusMatrix,
  requestRowsForUuid,
  resolveDocumentDiffPaths,
  resolveRequestDiffPaths,
  type GitMatrixRow
} from '#/main/git/gitRequestStatus';
import { countConflictFiles, pullMergeConflictMessage } from '#/main/git/slug';
import { buildSingleResourceDiff } from '#/main/git/gitDiff';
import {
  buildGitGraphLog,
  buildCommitResourceDiff,
  readGitCommitDetail
} from '#/main/git/gitGraph';
import type {
  GitCommitDetail,
  GitGraphLogResult,
  GitLogEntry,
  GitRequestDiffResult,
  GitRequestFileStatus,
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
   * Returns per-request git status for one collection.
   *
   * @param collectionUuid - Stable collection uuid.
   */
  async listRequestStatuses(collectionUuid: string): Promise<Record<string, GitRequestFileStatus>> {
    const harborSubdir = this.harborSubdir();
    const matrix = await loadHarborStatusMatrix(this.#repoPath, harborSubdir);
    return buildRequestStatusesForCollection(matrix, harborSubdir, collectionUuid);
  }

  /**
   * Returns per-document git status for one collection.
   *
   * @param collectionUuid - Stable collection uuid.
   */
  async listDocumentStatuses(
    collectionUuid: string
  ): Promise<Record<string, GitRequestFileStatus>> {
    const harborSubdir = this.harborSubdir();
    const matrix = await loadHarborStatusMatrix(this.#repoPath, harborSubdir);
    return buildDocumentStatusesForCollection(matrix, this.#repoPath, harborSubdir, collectionUuid);
  }

  /**
   * Stages all working-tree changes for one request in a collection.
   *
   * @param collectionUuid - Stable collection uuid.
   * @param requestUuid - Stable request uuid.
   */
  async stageRequest(collectionUuid: string, requestUuid: string): Promise<void> {
    const harborSubdir = this.harborSubdir();
    const matrix = await loadHarborStatusMatrix(this.#repoPath, harborSubdir);
    const rows = requestRowsForUuid(matrix, harborSubdir, collectionUuid, requestUuid);

    if (rows.length === 0) {
      throw new Error('Request has no git-tracked files to stage.');
    }

    for (const row of rows) {
      await this.stageMatrixRow(row);
    }
  }

  /**
   * Stages all working-tree changes for one markdown document in a collection.
   *
   * @param collectionUuid - Stable collection uuid.
   * @param documentUuid - Stable document uuid.
   */
  async stageDocument(collectionUuid: string, documentUuid: string): Promise<void> {
    const harborSubdir = this.harborSubdir();
    const matrix = await loadHarborStatusMatrix(this.#repoPath, harborSubdir);
    const rows = await documentRowsForUuid(
      matrix,
      this.#repoPath,
      harborSubdir,
      collectionUuid,
      documentUuid
    );

    if (rows.length === 0) {
      throw new Error('Document has no git-tracked files to stage.');
    }

    for (const row of rows) {
      await this.stageMatrixRow(row);
    }
  }

  /**
   * Unstages all staged changes for one markdown document in a collection.
   *
   * @param collectionUuid - Stable collection uuid.
   * @param documentUuid - Stable document uuid.
   */
  async unstageDocument(collectionUuid: string, documentUuid: string): Promise<void> {
    const harborSubdir = this.harborSubdir();
    const matrix = await loadHarborStatusMatrix(this.#repoPath, harborSubdir);
    const rows = await documentRowsForUuid(
      matrix,
      this.#repoPath,
      harborSubdir,
      collectionUuid,
      documentUuid
    );

    if (rows.length === 0) {
      throw new Error('Document has no staged changes to remove.');
    }

    let unstagedAny = false;
    for (const row of rows) {
      const [filepath, head, , stage] = row;
      if (stage === head) {
        continue;
      }

      if (head === 0) {
        await git.remove({ fs, dir: this.#repoPath, filepath });
      } else {
        await git.resetIndex({ fs, dir: this.#repoPath, filepath });
      }
      unstagedAny = true;
    }

    if (!unstagedAny) {
      throw new Error('Document has no staged changes to remove.');
    }
  }

  /**
   * Unstages all staged changes for one request in a collection.
   *
   * @param collectionUuid - Stable collection uuid.
   * @param requestUuid - Stable request uuid.
   */
  async unstageRequest(collectionUuid: string, requestUuid: string): Promise<void> {
    const harborSubdir = this.harborSubdir();
    const matrix = await loadHarborStatusMatrix(this.#repoPath, harborSubdir);
    const rows = requestRowsForUuid(matrix, harborSubdir, collectionUuid, requestUuid);

    if (rows.length === 0) {
      throw new Error('Request has no staged changes to remove.');
    }

    let unstagedAny = false;
    for (const row of rows) {
      const [filepath, head, , stage] = row;
      if (stage === head) {
        continue;
      }

      if (head === 0) {
        await git.remove({ fs, dir: this.#repoPath, filepath });
      } else {
        await git.resetIndex({ fs, dir: this.#repoPath, filepath });
      }
      unstagedAny = true;
    }

    if (!unstagedAny) {
      throw new Error('Request has no staged changes to remove.');
    }
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
          'No staged changes to commit. Use Add on requests or enable Auto add in Git settings.'
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
   * Builds a parent-to-commit diff for one request or document in a commit.
   *
   * @param oid - Commit object id.
   * @param collectionUuid - Stable collection uuid.
   * @param resourceUuid - Stable request or document uuid.
   * @param kind - Whether the resource is a request or markdown document.
   * @param resourceName - Display name shown in the diff modal.
   */
  async buildCommitResourceDiff(
    oid: string,
    collectionUuid: string,
    resourceUuid: string,
    kind: 'request' | 'document',
    resourceName: string
  ): Promise<GitRequestDiffResult> {
    return buildCommitResourceDiff(
      this.#repoPath,
      this.harborSubdir(),
      oid,
      collectionUuid,
      resourceUuid,
      kind,
      resourceName
    );
  }

  /**
   * Builds a working-tree diff for one request's git-tracked files.
   *
   * @param collectionUuid - Stable collection uuid.
   * @param requestUuid - Stable request uuid.
   * @param requestName - Display name shown in the diff modal.
   */
  async buildRequestDiff(
    collectionUuid: string,
    requestUuid: string,
    requestName: string
  ): Promise<GitRequestDiffResult> {
    const harborSubdir = this.harborSubdir();
    const matrix = await loadHarborStatusMatrix(this.#repoPath, harborSubdir);
    const rows = requestRowsForUuid(matrix, harborSubdir, collectionUuid, requestUuid);
    const { headPath, workPath } = resolveRequestDiffPaths(rows, requestUuid, requestName);
    const entry = await buildSingleResourceDiff({
      repoPath: this.#repoPath,
      headPath,
      workPath,
      maxCharsPerFile: 12_000
    });

    return {
      requestName,
      files: entry != null ? [entry] : []
    };
  }

  /**
   * Builds a working-tree diff for one markdown document's git-tracked files.
   *
   * @param collectionUuid - Stable collection uuid.
   * @param documentUuid - Stable document uuid.
   * @param documentName - Display name shown in the diff modal.
   */
  async buildDocumentDiff(
    collectionUuid: string,
    documentUuid: string,
    documentName: string
  ): Promise<GitRequestDiffResult> {
    const harborSubdir = this.harborSubdir();
    const matrix = await loadHarborStatusMatrix(this.#repoPath, harborSubdir);
    const rows = await documentRowsForUuid(
      matrix,
      this.#repoPath,
      harborSubdir,
      collectionUuid,
      documentUuid
    );
    const { headPath, workPath } = resolveDocumentDiffPaths(rows, harborSubdir, documentName);
    const entry = await buildSingleResourceDiff({
      repoPath: this.#repoPath,
      headPath,
      workPath,
      maxCharsPerFile: 12_000
    });

    return {
      requestName: documentName,
      files: entry != null ? [entry] : []
    };
  }

  /**
   * Discards working-tree and index changes for one request's git-tracked files.
   *
   * @param collectionUuid - Stable collection uuid.
   * @param requestUuid - Stable request uuid.
   */
  async revertRequest(collectionUuid: string, requestUuid: string): Promise<void> {
    const harborSubdir = this.harborSubdir();
    const matrix = await loadHarborStatusMatrix(this.#repoPath, harborSubdir);
    const rows = requestRowsForUuid(matrix, harborSubdir, collectionUuid, requestUuid);

    if (rows.length === 0) {
      throw new Error('Request has no changes to revert.');
    }

    let revertedAny = false;
    for (const row of rows) {
      const [filepath, head] = row;
      if (head === 0) {
        const fullPath = join(this.#repoPath, filepath);
        if (existsSync(fullPath)) {
          unlinkSync(fullPath);
        }
        try {
          await git.remove({ fs, dir: this.#repoPath, filepath });
        } catch {
          // File may already be absent from the index.
        }
        revertedAny = true;
        continue;
      }

      await git.checkout({
        fs,
        dir: this.#repoPath,
        ref: 'HEAD',
        filepaths: [filepath],
        force: true
      });
      revertedAny = true;
    }

    if (!revertedAny) {
      throw new Error('Request has no changes to revert.');
    }
  }

  /**
   * Discards working-tree and index changes for one markdown document's git-tracked files.
   *
   * @param collectionUuid - Stable collection uuid.
   * @param documentUuid - Stable document uuid.
   */
  async revertDocument(collectionUuid: string, documentUuid: string): Promise<void> {
    const harborSubdir = this.harborSubdir();
    const matrix = await loadHarborStatusMatrix(this.#repoPath, harborSubdir);
    const rows = await documentRowsForUuid(
      matrix,
      this.#repoPath,
      harborSubdir,
      collectionUuid,
      documentUuid
    );

    if (rows.length === 0) {
      throw new Error('Document has no changes to revert.');
    }

    let revertedAny = false;
    for (const row of rows) {
      const [filepath, head] = row;
      if (head === 0) {
        const fullPath = join(this.#repoPath, filepath);
        if (existsSync(fullPath)) {
          unlinkSync(fullPath);
        }
        try {
          await git.remove({ fs, dir: this.#repoPath, filepath });
        } catch {
          // File may already be absent from the index.
        }
        revertedAny = true;
        continue;
      }

      await git.checkout({
        fs,
        dir: this.#repoPath,
        ref: 'HEAD',
        filepaths: [filepath],
        force: true
      });
      revertedAny = true;
    }

    if (!revertedAny) {
      throw new Error('Document has no changes to revert.');
    }
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
