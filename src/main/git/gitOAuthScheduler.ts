import type { WebContents } from 'electron';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import { finishGitHubOAuth } from '#/main/git/gitAuth';
import { clearPendingGitHubDeviceFlow } from '#/main/git/githubOAuth';
import { GitSyncManager } from '#/main/git/GitSyncManager';
import { listStorageConnections } from '#/main/settings/storageSettings';
import type { GitOAuthFinishedEvent } from '#/shared/types';

const activeCompletions = new Map<string, AbortController>();

/**
 * Validates git remote credentials, using a mounted backend when available or a
 * temporary sync manager when the connection was saved but not yet mounted.
 *
 * @param db - Top-level database handle.
 * @param connectionId - Git connection id.
 */
export async function testGitCredentials(db: IStorage, connectionId: string): Promise<void> {
  if (db instanceof RoutingStorage && db.isConnectionMounted(connectionId)) {
    await db.requireGitStorage(connectionId).syncManager.testCredentials();
    return;
  }

  const conn = listStorageConnections().find((item) => item.id === connectionId);
  if (!conn || conn.type !== 'git') {
    throw new Error(`Git connection not found: ${connectionId}`);
  }

  const sync = new GitSyncManager(connectionId, conn.settings);
  await sync.testCredentials();
}

/**
 * Sends a GitHub OAuth completion event to the renderer when the target is still alive.
 *
 * @param sender - Renderer web contents that started OAuth.
 * @param event - OAuth completion payload.
 */
function notifyOAuthFinished(sender: WebContents, event: GitOAuthFinishedEvent): void {
  if (sender.isDestroyed()) {
    return;
  }
  sender.send('git:oauthFinished', event);
}

/**
 * Polls GitHub in the background until OAuth completes, fails, or is cancelled.
 *
 * @param sender - Renderer web contents to notify on completion.
 * @param db - Top-level database handle for credential validation.
 * @param connectionId - Git connection id.
 */
export function scheduleGitHubOAuthCompletion(
  sender: WebContents,
  db: IStorage,
  connectionId: string
): void {
  activeCompletions.get(connectionId)?.abort();

  const controller = new AbortController();
  activeCompletions.set(connectionId, controller);

  void (async () => {
    try {
      await finishGitHubOAuth(connectionId, { signal: controller.signal });
      await testGitCredentials(db, connectionId);
      notifyOAuthFinished(sender, { connectionId, ok: true });
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      notifyOAuthFinished(sender, {
        connectionId,
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      if (activeCompletions.get(connectionId) === controller) {
        activeCompletions.delete(connectionId);
      }
    }
  })();
}

/**
 * Cancels in-flight OAuth polling and clears any pending device-flow session.
 *
 * @param connectionId - Git connection id.
 */
export function cancelGitHubOAuthCompletion(connectionId: string): void {
  activeCompletions.get(connectionId)?.abort();
  activeCompletions.delete(connectionId);
  clearPendingGitHubDeviceFlow(connectionId);
}
