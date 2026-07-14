import { shell } from 'electron';
import * as git from 'isomorphic-git';
import fs, { existsSync, rmSync, statSync } from 'fs';
import { spawn } from 'child_process';
import { GitStorage } from '#/main/storage/GitStorage';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import {
  beginGitHubOAuth,
  beginHostGitHubOAuth,
  beginHostGitHubOAuthForUrl,
  listGitIdentities,
  requireGitHost,
  revokeGitHubOAuth,
  revokeHost,
  saveGitPat,
  saveHostPat,
  testHostCredentials
} from '#/main/git/gitAuth';
import {
  cancelGitHubOAuthCompletion,
  cancelHostGitHubOAuthCompletion,
  scheduleGitHubOAuthCompletion,
  scheduleHostGitHubOAuthCompletion,
  testGitCredentials
} from '#/main/git/gitOAuthScheduler';
import { normalizeGitRemoteToHttps } from '#/shared/gitUrl';
import { buildGitDiff, makeCollectionScopedFilter, type GitDiffResult } from '#/main/git/gitDiff';
import { resolveHarborclientRoot } from '#/main/git/fileLayout';
import { collectionDirName } from '#/main/git/slug';
import { buildFileCommitDiff, readFileCommitHistory } from '#/main/git/gitFileHistory';
import { readSuggestedGitAuthor } from '#/main/git/gitAuthorSuggestion';
import type {
  GitCommitsResult,
  GitFileDiffResult,
  GitFileInfoResult,
  GitRepoInfoResult,
  GitRequestDiffFileEntry
} from '#/shared/types';
import type { Collection } from '#/shared/types';
import { getGeneralSettings } from '#/main/settings/generalSettings';

/**
 * Returns a RoutingStorage instance or throws when git IPC is unavailable.
 *
 * @param db - Top-level database handle from IPC registration.
 */
function requireRoutingStorage(db: IStorage): RoutingStorage {
  if (!(db instanceof RoutingStorage)) {
    throw new Error('Git operations require RoutingStorage.');
  }
  return db;
}

/**
 * Returns a mounted GitStorage for a connection id.
 *
 * @param db - Top-level database handle.
 * @param connectionId - Git connection id.
 */
function requireGitStorage(db: IStorage, connectionId: string): GitStorage {
  return requireRoutingStorage(db).requireGitStorage(connectionId);
}

/**
 * Runs a git sync operation and reloads the local registry, preserving the
 * original sync error when reload fails (for example after merge conflicts leave
 * invalid JSON on disk).
 *
 * @param gitDb - Git-backed database for the connection.
 * @param router - Routing database used to reconcile the registry.
 * @param connectionId - Git connection id.
 * @param sync - Pull or push operation to execute.
 */
async function syncAndReloadGitRegistry(
  gitDb: GitStorage,
  router: RoutingStorage,
  connectionId: string,
  sync: () => Promise<void>
): Promise<void> {
  let syncError: unknown;
  try {
    await sync();
  } catch (err) {
    syncError = err;
  }

  try {
    await gitDb.reloadFromDisk();
    await router.reconcileGitRegistry(connectionId);
  } catch (reloadError) {
    if (syncError != null) {
      console.warn('Failed to reload git registry after sync error:', reloadError);
      throw syncError;
    }
    throw reloadError;
  }

  if (syncError != null) {
    throw syncError;
  }
}

/**
 * Resolved git-backed collection context for AI and IPC helpers.
 */
interface ResolvedGitCollection {
  /**
   * Hydrated collection record from routing storage.
   */
  collection: Collection;

  /**
   * Mounted git storage backend for the collection connection.
   */
  gitDb: GitStorage;

  /**
   * Git connection id for the collection.
   */
  connectionId: string;
}

/**
 * Resolves a collection uuid to its git-backed storage context.
 *
 * @param db - Top-level database handle.
 * @param collectionUuid - Stable collection uuid.
 */
async function resolveGitCollection(
  db: IStorage,
  collectionUuid: string
): Promise<ResolvedGitCollection | { error: string }> {
  const router = requireRoutingStorage(db);
  const collection = await router.findCollectionByUuid(collectionUuid.trim());
  if (!collection) {
    return { error: `Collection not found for uuid "${collectionUuid}".` };
  }

  const connectionId = collection.connectionId?.trim();
  if (!connectionId) {
    return {
      error: `Collection "${collection.name}" is not stored in a git-backed connection.`
    };
  }

  return {
    collection,
    gitDb: requireGitStorage(db, connectionId),
    connectionId
  };
}

/**
 * Reads the origin remote URL for a repository, normalized to HTTPS.
 *
 * @param repoPath - Absolute repository root path.
 */
async function readRepoRemoteUrl(repoPath: string): Promise<string | null> {
  try {
    const remotes = await git.listRemotes({ fs, dir: repoPath });
    const origin = remotes.find((remote) => remote.remote === 'origin') ?? remotes[0];
    return origin ? normalizeGitRemoteToHttps(origin.url) : null;
  } catch {
    return null;
  }
}

/**
 * Registers IPC handlers for git source-control operations.
 *
 * @param db - Top-level database handle shared by collection handlers.
 */
export function registerGitHandlers(db: IStorage): void {
  // Lists git sync status for all git-backed connections.
  handle('git:statuses', ipcArgSchemas.none, async () => {
    const router = requireRoutingStorage(db);
    return router.listGitStatuses();
  });

  // Lists saved git host identities.
  handle('git:listIdentities', ipcArgSchemas.none, async () => listGitIdentities());

  // Suggests commit author name/email from repo-local and global git config.
  handle('git:suggestedAuthor', ipcArgSchemas.gitSuggestedAuthor, async (_event, connectionId) => {
    const repoPath = connectionId
      ? requireGitStorage(db, connectionId).syncManager.repoDir
      : undefined;
    return readSuggestedGitAuthor(repoPath);
  });

  // Commits local changes for one git-backed collection.
  handle(
    'git:commit',
    ipcArgSchemas.gitCommit,
    async (_event, connectionId, collectionUuid, message, createHarborRoot) => {
      const gitDb = requireGitStorage(db, connectionId);
      const collection = await gitDb.findCollectionByUuid(collectionUuid.trim());
      if (!collection) {
        throw new Error(`Collection not found for uuid "${collectionUuid}".`);
      }
      const collectionPrefix = gitDb.getCollectionRepoRelativePath(collection.id);
      const { gitCommitAuthorName, gitCommitAuthorEmail } = getGeneralSettings();
      await gitDb.syncManager.commit(message, {
        createHarborRoot,
        collectionPrefix,
        author: { name: gitCommitAuthorName, email: gitCommitAuthorEmail }
      });
    }
  );

  // Returns local branch names for a git connection.
  handle('git:listBranches', ipcArgSchemas.gitListBranches, async (_event, connectionId) => {
    const gitDb = requireGitStorage(db, connectionId);
    return gitDb.syncManager.listBranches();
  });

  // Creates a new branch and checks it out, then reloads the local registry.
  handle('git:createBranch', ipcArgSchemas.gitCreateBranch, async (_event, connectionId, name) => {
    const router = requireRoutingStorage(db);
    const gitDb = requireGitStorage(db, connectionId);
    await syncAndReloadGitRegistry(gitDb, router, connectionId, () =>
      gitDb.syncManager.createBranch(name)
    );
  });

  // Deletes a local branch that is not currently checked out.
  handle('git:deleteBranch', ipcArgSchemas.gitDeleteBranch, async (_event, connectionId, name) => {
    const gitDb = requireGitStorage(db, connectionId);
    await gitDb.syncManager.deleteBranch(name);
  });

  // Fetches from the configured remote without merging.
  handle('git:fetch', ipcArgSchemas.connectionId, async (_event, connectionId) => {
    const gitDb = requireGitStorage(db, connectionId);
    await gitDb.syncManager.fetch();
  });

  // Checks out an existing branch when the working tree is clean, then reloads.
  handle(
    'git:checkoutBranch',
    ipcArgSchemas.gitCheckoutBranch,
    async (_event, connectionId, name) => {
      const router = requireRoutingStorage(db);
      const gitDb = requireGitStorage(db, connectionId);
      await syncAndReloadGitRegistry(gitDb, router, connectionId, () =>
        gitDb.syncManager.checkoutBranch(name)
      );
    }
  );

  // Merges another local branch into the current branch and reloads the registry.
  handle('git:merge', ipcArgSchemas.gitMergeBranch, async (_event, connectionId, name) => {
    const router = requireRoutingStorage(db);
    const gitDb = requireGitStorage(db, connectionId);
    const { gitCommitAuthorName, gitCommitAuthorEmail } = getGeneralSettings();
    const result = await gitDb.syncManager.mergeBranch(name, {
      author: { name: gitCommitAuthorName, email: gitCommitAuthorEmail }
    });

    try {
      await gitDb.reloadFromDisk();
      await router.reconcileGitRegistry(connectionId);
    } catch (reloadError) {
      if (result.conflictCount === 0) {
        throw reloadError;
      }
      console.warn('Failed to reload git registry after merge conflicts:', reloadError);
    }

    return result;
  });

  // Reads raw text from one repository-relative conflict file.
  handle('git:readConflictFile', ipcArgSchemas.gitReadConflictFile, async (_event, args) => {
    const gitDb = requireGitStorage(db, args.connectionId);
    const content = await gitDb.syncManager.readRepoFile(args.filePath);
    return { path: args.filePath, content };
  });

  // Writes one repository-relative conflict file and stages it.
  handle('git:writeConflictFile', ipcArgSchemas.gitWriteConflictFile, async (_event, args) => {
    const gitDb = requireGitStorage(db, args.connectionId);
    await gitDb.syncManager.writeRepoFile(args.filePath, args.content);
    await gitDb.syncManager.stageFile(args.filePath);
  });

  // Launches the configured external merge editor for one conflicted file.
  handle(
    'git:openExternalMergeEditor',
    ipcArgSchemas.gitOpenExternalMergeEditor,
    async (_event, args) => {
      const { externalMergeEditorPath } = getGeneralSettings();
      const executable = externalMergeEditorPath.trim();
      if (!executable) {
        throw new Error('No external merge editor configured in Settings → Git.');
      }

      const gitDb = requireGitStorage(db, args.connectionId);
      const absolutePath = `${gitDb.syncManager.repoDir}/${args.filePath.replace(/\\/g, '/')}`;
      if (!existsSync(absolutePath)) {
        throw new Error(`Conflict file not found: ${args.filePath}`);
      }

      await new Promise<void>((resolve, reject) => {
        const child = spawn(executable, [absolutePath], {
          detached: true,
          stdio: 'ignore'
        });
        child.once('error', reject);
        child.unref();
        resolve();
      });
    }
  );

  // Pulls remote changes and reloads the local registry.
  handle('git:pull', ipcArgSchemas.connectionId, async (_event, connectionId) => {
    const router = requireRoutingStorage(db);
    const gitDb = requireGitStorage(db, connectionId);
    await syncAndReloadGitRegistry(gitDb, router, connectionId, () => gitDb.syncManager.pull());
  });

  // Pushes local commits and reloads the local registry (hooks may change disk).
  handle('git:push', ipcArgSchemas.connectionId, async (_event, connectionId) => {
    const router = requireRoutingStorage(db);
    const gitDb = requireGitStorage(db, connectionId);
    await syncAndReloadGitRegistry(gitDb, router, connectionId, () => gitDb.syncManager.push());
  });

  // Returns recent commit history for a git connection.
  handle('git:log', ipcArgSchemas.gitLog, async (_event, connectionId, depth) => {
    const gitDb = requireGitStorage(db, connectionId);
    return gitDb.syncManager.log(depth ?? 20);
  });

  // Returns graph-ready commit history for a git connection.
  handle('git:graphLog', ipcArgSchemas.gitGraphLog, async (_event, connectionId, depth) => {
    const gitDb = requireGitStorage(db, connectionId);
    return gitDb.syncManager.graphLog(depth ?? 100);
  });

  // Returns detailed metadata and changed files for one commit.
  handle('git:commitDetail', ipcArgSchemas.gitCommitDetail, async (_event, connectionId, oid) => {
    const gitDb = requireGitStorage(db, connectionId);
    return gitDb.syncManager.readCommitDetail(oid);
  });

  // Returns a diff for one HarborClient file in a specific commit.
  handle('git:commitFileDiff', ipcArgSchemas.gitCommitFileDiff, async (_event, args) => {
    const gitDb = requireGitStorage(db, args.connectionId);
    const repoPath = gitDb.syncManager.repoDir;
    const commitOid = args.commitOid.trim();
    const filePath = args.filePath.trim();
    const { commit } = await git.readCommit({ fs, dir: repoPath, oid: commitOid });
    const parentOid = commit.parent[0] ?? null;
    const diff = await buildFileCommitDiff({
      repoPath,
      filepath: filePath,
      commitA: parentOid,
      commitB: commitOid,
      maxChars: args.maxChars
    });

    return {
      path: diff.path,
      status: args.status,
      diff: diff.diff ?? undefined,
      binary: diff.binary,
      truncated: diff.truncated,
      hasConflict: false,
      ...(args.displayName != null ? { displayName: args.displayName } : {}),
      ...(args.resourceKind != null ? { resourceKind: args.resourceKind } : {}),
      ...(args.method != null ? { method: args.method } : {})
    } satisfies GitRequestDiffFileEntry;
  });

  // Returns uncommitted HarborClient-tree diffs for a git-backed collection.
  handle('git:diff', ipcArgSchemas.gitDiff, async (_event, args) => {
    const resolved = await resolveGitCollection(db, args.collectionUuid);
    if ('error' in resolved) {
      return JSON.stringify({ error: resolved.error });
    }

    const { collection, gitDb, connectionId } = resolved;
    const status = await gitDb.syncManager.getStatus();
    const collectionDir = collectionDirName(collection.name);
    const diff = await buildGitDiff({
      repoPath: gitDb.syncManager.repoDir,
      harborSubdir: status.harborSubdir,
      maxFiles: args.maxFiles,
      maxCharsPerFile: args.maxCharsPerFile,
      maxTotalChars: args.maxTotalChars,
      stagedOnly: args.stagedOnly ?? false,
      excludeUntracked: args.excludeUntracked ?? false,
      enrichDisplayNames: true,
      filepathFilter: makeCollectionScopedFilter(status.harborSubdir, collectionDir)
    });

    return JSON.stringify({
      ...diff,
      connectionId
    } satisfies GitDiffResult);
  });

  // Returns git repository metadata for one git-backed collection.
  handle('git:repoInfo', ipcArgSchemas.gitRepoInfo, async (_event, args) => {
    const router = requireRoutingStorage(db);
    const resolved = await resolveGitCollection(db, args.collectionUuid);
    if ('error' in resolved) {
      return JSON.stringify({ error: resolved.error });
    }

    const { collection, gitDb, connectionId } = resolved;
    const providerCollection = await gitDb.findCollectionByUuid(collection.uuid);
    if (!providerCollection) {
      return JSON.stringify({
        error: `Collection not found for uuid "${collection.uuid}".`
      });
    }

    const status = await gitDb.syncManager.getStatus();
    const repoPath = gitDb.syncManager.repoDir;
    const harborDataPath = resolveHarborclientRoot(repoPath, status.harborSubdir);
    const collectionDir = collectionDirName(collection.name);
    const [repoUrl, requests, documents, uncommittedItems, diff] = await Promise.all([
      readRepoRemoteUrl(repoPath),
      gitDb.listRequests(providerCollection.id),
      gitDb.listDocuments(providerCollection.id),
      router.getGitItemStatuses(connectionId, collection.uuid),
      buildGitDiff({
        repoPath,
        harborSubdir: status.harborSubdir,
        maxFiles: 100,
        enrichDisplayNames: true,
        filepathFilter: makeCollectionScopedFilter(status.harborSubdir, collectionDir)
      })
    ]);

    const items = [
      ...requests.map((request) => ({
        uuid: request.uuid,
        name: request.name,
        kind: 'request' as const,
        repoPath: gitDb.getItemRepoPath(providerCollection.id, request.uuid),
        method: request.method
      })),
      ...documents.map((document) => ({
        uuid: document.uuid,
        name: document.name,
        kind: 'document' as const,
        repoPath: gitDb.getItemRepoPath(providerCollection.id, document.uuid)
      }))
    ];

    return JSON.stringify({
      connectionId,
      collectionUuid: collection.uuid,
      collectionName: collection.name,
      repoUrl,
      repoPath,
      harborDataPath,
      harborSubdir: status.harborSubdir,
      status,
      items,
      uncommittedItems,
      uncommittedFiles: diff.files.map((file) => ({
        path: file.path,
        status: file.status
      }))
    } satisfies GitRepoInfoResult);
  });

  // Returns recent commit history for the repository that contains a collection.
  handle('git:collectionCommits', ipcArgSchemas.gitCollectionCommits, async (_event, args) => {
    const resolved = await resolveGitCollection(db, args.collectionUuid);
    if ('error' in resolved) {
      return JSON.stringify({ error: resolved.error });
    }

    const { collection, gitDb, connectionId } = resolved;
    const commits = await gitDb.syncManager.log(args.depth ?? 20);
    return JSON.stringify({
      connectionId,
      collectionUuid: collection.uuid,
      commits
    } satisfies GitCommitsResult);
  });

  // Returns per-file git metadata and commit history for one saved request.
  handle('git:fileInfo', ipcArgSchemas.gitFileInfo, async (_event, args) => {
    const resolved = await resolveGitCollection(db, args.collectionUuid);
    if ('error' in resolved) {
      return JSON.stringify({ error: resolved.error });
    }

    const { collection, gitDb, connectionId } = resolved;
    const providerCollection = await gitDb.findCollectionByUuid(collection.uuid);
    if (!providerCollection) {
      return JSON.stringify({
        error: `Collection not found for uuid "${collection.uuid}".`
      });
    }

    const request = await gitDb.findRequestByUuid(providerCollection.id, args.requestUuid.trim());
    if (!request) {
      return JSON.stringify({
        error: `Request not found for uuid "${args.requestUuid}".`
      });
    }

    const repoPath = gitDb.getItemRepoPath(providerCollection.id, request.uuid);
    const commitHistory = await readFileCommitHistory(
      gitDb.syncManager.repoDir,
      repoPath,
      args.depth ?? 20
    );

    return JSON.stringify({
      connectionId,
      collectionUuid: collection.uuid,
      requestUuid: request.uuid,
      repoPath,
      request: {
        id: request.id,
        uuid: request.uuid,
        name: request.name,
        method: request.method,
        url: request.url,
        folder_id: request.folder_id
      },
      commitHistory
    } satisfies GitFileInfoResult);
  });

  // Returns a diff of one saved request file between two commits.
  handle('git:fileDiff', ipcArgSchemas.gitFileDiff, async (_event, args) => {
    const resolved = await resolveGitCollection(db, args.collectionUuid);
    if ('error' in resolved) {
      return JSON.stringify({ error: resolved.error });
    }

    const { collection, gitDb, connectionId } = resolved;
    const providerCollection = await gitDb.findCollectionByUuid(collection.uuid);
    if (!providerCollection) {
      return JSON.stringify({
        error: `Collection not found for uuid "${collection.uuid}".`
      });
    }

    const request = await gitDb.findRequestByUuid(providerCollection.id, args.requestUuid.trim());
    if (!request) {
      return JSON.stringify({
        error: `Request not found for uuid "${args.requestUuid}".`
      });
    }

    const repoPath = gitDb.getItemRepoPath(providerCollection.id, request.uuid);
    const diff = await buildFileCommitDiff({
      repoPath: gitDb.syncManager.repoDir,
      filepath: repoPath,
      commitA: args.commitA.trim(),
      commitB: args.commitB.trim(),
      maxChars: args.maxChars
    });

    return JSON.stringify({
      connectionId,
      collectionUuid: collection.uuid,
      requestUuid: request.uuid,
      requestName: request.name,
      repoPath,
      commitA: diff.commitA,
      commitB: diff.commitB,
      diff: diff.diff,
      truncated: diff.truncated,
      binary: diff.binary,
      ...(diff.originalLength != null ? { originalLength: diff.originalLength } : {})
    } satisfies GitFileDiffResult);
  });

  // Returns per-item git status for requests and markdown in one collection.
  handle(
    'git:itemStatuses',
    ipcArgSchemas.gitListItemStatuses,
    async (_event, connectionId, collectionUuid) => {
      const router = requireRoutingStorage(db);
      return router.getGitItemStatuses(connectionId, collectionUuid);
    }
  );

  // Returns the number of changed request/document files in one collection.
  handle(
    'git:changedItemCount',
    ipcArgSchemas.gitChangedItemCount,
    async (_event, connectionId, collectionUuid) => {
      const router = requireRoutingStorage(db);
      return router.getGitChangedItemCount(connectionId, collectionUuid);
    }
  );

  // Stages one request or markdown document in a git-backed collection.
  handle(
    'git:stageItem',
    ipcArgSchemas.gitStageItem,
    async (_event, connectionId, collectionUuid, itemUuid) => {
      const router = requireRoutingStorage(db);
      await router.stageGitItem(connectionId, collectionUuid, itemUuid);
    }
  );

  // Unstages one request or markdown document in a git-backed collection.
  handle(
    'git:unstageItem',
    ipcArgSchemas.gitUnstageItem,
    async (_event, connectionId, collectionUuid, itemUuid) => {
      const router = requireRoutingStorage(db);
      await router.unstageGitItem(connectionId, collectionUuid, itemUuid);
    }
  );

  // Discards working-tree changes for one request or markdown file path.
  handle(
    'git:revertFile',
    ipcArgSchemas.gitRevertFile,
    async (_event, connectionId, collectionUuid, filePath, previousPaths) => {
      const router = requireRoutingStorage(db);
      const gitDb = requireGitStorage(db, connectionId);
      await router.revertGitFile(connectionId, collectionUuid, filePath, previousPaths);
      await gitDb.reloadFromDisk();
      await router.reconcileGitRegistry(connectionId);
    }
  );

  // Saves a personal access token and validates credentials.
  handle('git:setPat', ipcArgSchemas.gitSetPat, async (_event, connectionId, username, token) => {
    saveGitPat(connectionId, username, token);
    await testGitCredentials(db, connectionId);
  });

  // Saves a personal access token for a git host and optionally validates it.
  handle(
    'git:setHostPat',
    ipcArgSchemas.gitSetHostPat,
    async (_event, host, username, token, testUrl, repoPath) => {
      const normalizedHost = requireGitHost(host);
      saveHostPat(normalizedHost, username, token);
      if (testUrl?.trim() && repoPath?.trim()) {
        await testHostCredentials(normalizedHost, testUrl.trim(), repoPath.trim());
      }
    }
  );

  // Starts GitHub device OAuth, opens the browser, and polls in the background.
  handle('git:startOAuth', ipcArgSchemas.connectionId, async (event, connectionId) => {
    const result = await beginGitHubOAuth(connectionId);
    await shell.openExternal(result.verificationUri);
    scheduleGitHubOAuthCompletion(event.sender, db, connectionId);
    return result;
  });

  // Starts GitHub device OAuth for a git host.
  handle(
    'git:startHostOAuth',
    ipcArgSchemas.gitStartHostOAuth,
    async (event, host, testUrl, repoPath) => {
      const normalizedHost = requireGitHost(host);
      const result = testUrl?.trim()
        ? await beginHostGitHubOAuthForUrl(normalizedHost, testUrl.trim())
        : await beginHostGitHubOAuth(normalizedHost);
      await shell.openExternal(result.verificationUri);
      scheduleHostGitHubOAuthCompletion(event.sender, db, normalizedHost, {
        testUrl: testUrl?.trim() || undefined,
        repoPath: repoPath?.trim() || undefined
      });
      return result;
    }
  );

  // Ensures background OAuth polling is running without blocking the invoke channel.
  handle('git:completeOAuth', ipcArgSchemas.connectionId, async (event, connectionId) => {
    scheduleGitHubOAuthCompletion(event.sender, db, connectionId);
  });

  // Revokes GitHub OAuth and clears stored credentials.
  handle('git:revokeOAuth', ipcArgSchemas.connectionId, async (_event, connectionId) => {
    cancelGitHubOAuthCompletion(connectionId);
    revokeGitHubOAuth(connectionId);
  });

  // Revokes stored credentials for a git host.
  handle('git:revokeHost', ipcArgSchemas.gitHost, async (_event, host) => {
    const normalizedHost = requireGitHost(host);
    cancelHostGitHubOAuthCompletion(normalizedHost);
    revokeHost(normalizedHost);
  });

  // Reads the origin remote URL from a local repository path, normalized to HTTPS.
  handle('git:readRemoteUrl', ipcArgSchemas.readGitRemoteUrl, async (_event, repoPath) => {
    return readRepoRemoteUrl(repoPath);
  });

  // Returns whether a directory is the root of a git working tree.
  handle('git:isRepo', ipcArgSchemas.isGitRepo, async (_event, repoPath) => {
    try {
      const root = await git.findRoot({ fs, filepath: repoPath });
      return root === repoPath;
    } catch {
      return false;
    }
  });

  // Initializes a git repository and optionally adds an origin remote.
  handle('git:initRepo', ipcArgSchemas.initGitRepo, async (_event, repoPath, url, branch) => {
    const defaultBranch = branch.trim() || 'main';
    await git.init({ fs, dir: repoPath, defaultBranch });
    const trimmedUrl = url.trim();
    if (trimmedUrl) {
      await git.addRemote({
        fs,
        dir: repoPath,
        remote: 'origin',
        url: trimmedUrl,
        force: true
      });
    }
  });

  // Permanently removes the local git clone directory for a git-backed connection.
  handle(
    'git:deleteRepoDirectory',
    ipcArgSchemas.gitDeleteRepoDirectory,
    async (_event, connectionId) => {
      const repoDir = requireGitStorage(db, connectionId).syncManager.repoDir;
      if (repoDir && existsSync(repoDir) && statSync(repoDir).isDirectory()) {
        rmSync(repoDir, { recursive: true, force: true });
      }
    }
  );
}
