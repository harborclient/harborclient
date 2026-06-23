import { shell } from 'electron';
import { GitDatabase } from '#/main/db/GitDatabase';
import type { IDatabase } from '#/main/db/IDatabase';
import { RoutingDatabase } from '#/main/db/RoutingDatabase';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { beginGitHubOAuth, revokeGitHubOAuth, saveGitPat } from '#/main/git/gitAuth';
import {
  cancelGitHubOAuthCompletion,
  scheduleGitHubOAuthCompletion,
  testGitCredentials
} from '#/main/git/gitOAuthScheduler';

/**
 * Returns a RoutingDatabase instance or throws when git IPC is unavailable.
 *
 * @param db - Top-level database handle from IPC registration.
 */
function requireRoutingDatabase(db: IDatabase): RoutingDatabase {
  if (!(db instanceof RoutingDatabase)) {
    throw new Error('Git operations require RoutingDatabase.');
  }
  return db;
}

/**
 * Returns a mounted GitDatabase for a connection id.
 *
 * @param db - Top-level database handle.
 * @param connectionId - Git connection id.
 */
function requireGitDatabase(db: IDatabase, connectionId: string): GitDatabase {
  return requireRoutingDatabase(db).requireGitDatabase(connectionId);
}

/**
 * Registers IPC handlers for git source-control operations.
 *
 * @param db - Top-level database handle shared by collection handlers.
 */
export function registerGitHandlers(db: IDatabase): void {
  // Lists git sync status for all git-backed connections.
  handle('git:statuses', ipcArgSchemas.none, async () => {
    const router = requireRoutingDatabase(db);
    return router.listGitStatuses();
  });

  // Commits local changes for a git connection.
  handle(
    'git:commit',
    ipcArgSchemas.gitCommit,
    async (_event, connectionId, message, createHarborRoot) => {
      const gitDb = requireGitDatabase(db, connectionId);
      await gitDb.syncManager.commit(message, { createHarborRoot });
    }
  );

  // Pulls remote changes and reloads the local registry.
  handle('git:pull', ipcArgSchemas.connectionId, async (_event, connectionId) => {
    const router = requireRoutingDatabase(db);
    const gitDb = requireGitDatabase(db, connectionId);
    try {
      await gitDb.syncManager.pull();
    } finally {
      await gitDb.reloadFromDisk();
      await router.reconcileGitRegistry(connectionId);
    }
  });

  // Pushes local commits and reloads the local registry (hooks may change disk).
  handle('git:push', ipcArgSchemas.connectionId, async (_event, connectionId) => {
    const router = requireRoutingDatabase(db);
    const gitDb = requireGitDatabase(db, connectionId);
    try {
      await gitDb.syncManager.push();
    } finally {
      await gitDb.reloadFromDisk();
      await router.reconcileGitRegistry(connectionId);
    }
  });

  // Returns recent commit history for a git connection.
  handle('git:log', ipcArgSchemas.gitLog, async (_event, connectionId, depth) => {
    const gitDb = requireGitDatabase(db, connectionId);
    return gitDb.syncManager.log(depth ?? 20);
  });

  // Saves a personal access token and validates credentials.
  handle('git:setPat', ipcArgSchemas.gitSetPat, async (_event, connectionId, username, token) => {
    saveGitPat(connectionId, username, token);
    await testGitCredentials(db, connectionId);
  });

  // Starts GitHub device OAuth, opens the browser, and polls in the background.
  handle('git:startOAuth', ipcArgSchemas.connectionId, async (event, connectionId) => {
    const result = await beginGitHubOAuth(connectionId);
    await shell.openExternal(result.verificationUri);
    scheduleGitHubOAuthCompletion(event.sender, db, connectionId);
    return result;
  });

  // Ensures background OAuth polling is running without blocking the invoke channel.
  handle('git:completeOAuth', ipcArgSchemas.connectionId, async (event, connectionId) => {
    scheduleGitHubOAuthCompletion(event.sender, db, connectionId);
  });

  // Revokes GitHub OAuth and clears stored credentials.
  handle('git:revokeOAuth', ipcArgSchemas.connectionId, async (_event, connectionId) => {
    cancelGitHubOAuthCompletion(connectionId);
    revokeGitHubOAuth(connectionId);
  });
}
