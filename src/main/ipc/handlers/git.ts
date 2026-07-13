import { shell } from 'electron';
import * as git from 'isomorphic-git';
import fs, { existsSync } from 'fs';
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
import { buildGitDiff, type GitDiffResult } from '#/main/git/gitDiff';
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

  // Commits local changes for a git connection.
  handle(
    'git:commit',
    ipcArgSchemas.gitCommit,
    async (_event, connectionId, message, createHarborRoot) => {
      const gitDb = requireGitStorage(db, connectionId);
      const { gitAutoAdd } = getGeneralSettings();
      await gitDb.syncManager.commit(message, { createHarborRoot, autoAdd: gitAutoAdd });
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
    const result = await gitDb.syncManager.mergeBranch(name);

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

  // Returns uncommitted HarborClient-tree diffs for a git-backed collection.
  handle('git:diff', ipcArgSchemas.gitDiff, async (_event, args) => {
    const router = requireRoutingStorage(db);
    const collection = await router.findCollectionByUuid(args.collectionUuid.trim());
    if (!collection) {
      return JSON.stringify({
        error: `Collection not found for uuid "${args.collectionUuid}".`
      });
    }

    const connectionId = collection.connectionId?.trim();
    if (!connectionId) {
      return JSON.stringify({
        error: `Collection "${collection.name}" is not stored in a git-backed connection.`
      });
    }

    const gitDb = requireGitStorage(db, connectionId);
    const status = await gitDb.syncManager.getStatus();
    const { gitAutoAdd } = getGeneralSettings();
    const diff = await buildGitDiff({
      repoPath: gitDb.syncManager.repoDir,
      harborSubdir: status.harborSubdir,
      maxFiles: args.maxFiles,
      maxCharsPerFile: args.maxCharsPerFile,
      maxTotalChars: args.maxTotalChars,
      stagedOnly: !gitAutoAdd
    });

    return JSON.stringify({
      ...diff,
      connectionId
    } satisfies GitDiffResult);
  });

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
    try {
      const remotes = await git.listRemotes({ fs, dir: repoPath });
      const origin = remotes.find((remote) => remote.remote === 'origin') ?? remotes[0];
      return origin ? normalizeGitRemoteToHttps(origin.url) : null;
    } catch {
      return null;
    }
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
}
