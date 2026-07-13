import { shell } from 'electron';
import * as git from 'isomorphic-git';
import fs from 'fs';
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
      await gitDb.syncManager.commit(message, { createHarborRoot });
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
