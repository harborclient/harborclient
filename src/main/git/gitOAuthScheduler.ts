import type { WebContents } from 'electron';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import { finishHostGitHubOAuth, resolveConnectionHost, testHostCredentials } from './gitAuth';
import type { GitRemoteValidationResult } from './gitRemoteValidation';
import { clearPendingGitHubDeviceFlow } from './githubOAuth';
import { listStorageConnections } from '#/main/settings/storageSettings';
import type { GitOAuthFinishedEvent } from '#/shared/types';

const activeCompletions = new Map<string, AbortController>();

/**
 * Validates git remote credentials, using a mounted backend when available or a
 * direct remote probe when the connection was saved but not yet mounted.
 *
 * @param db - Top-level database handle.
 * @param connectionId - Git connection id.
 * @returns Validation outcome including whether the remote has no branch refs yet.
 */
export async function testGitCredentials(
  db: IStorage,
  connectionId: string
): Promise<GitRemoteValidationResult> {
  if (db instanceof RoutingStorage && db.isConnectionMounted(connectionId)) {
    return db.requireGitStorage(connectionId).syncManager.testCredentials();
  }

  const conn = listStorageConnections().find((item) => item.id === connectionId);
  if (!conn || conn.type !== 'git') {
    throw new Error(`Git connection not found: ${connectionId}`);
  }

  const host = resolveConnectionHost(connectionId);
  return testHostCredentials(host, conn.settings.url, conn.settings.branch);
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
 * @param host - Normalized lowercase git host key.
 * @param options - Optional connection id and test repository details for validation.
 */
export function scheduleHostGitHubOAuthCompletion(
  sender: WebContents,
  db: IStorage,
  host: string,
  options: {
    connectionId?: string;
    testUrl?: string;
    branch?: string;
  } = {}
): void {
  activeCompletions.get(host)?.abort();

  const controller = new AbortController();
  activeCompletions.set(host, controller);

  void (async () => {
    try {
      try {
        await finishHostGitHubOAuth(host, { signal: controller.signal });
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        notifyOAuthFinished(sender, {
          host,
          connectionId: options.connectionId,
          ok: false,
          error: err instanceof Error ? err.message : String(err)
        });
        return;
      }

      let validationError: string | undefined;
      let emptyRemote: boolean | undefined;
      let canPush: boolean | undefined;
      try {
        if (options.connectionId) {
          const result = await testGitCredentials(db, options.connectionId);
          emptyRemote = result.emptyRemote;
          canPush = result.canPush;
        } else if (options.testUrl?.trim()) {
          const result = await testHostCredentials(
            host,
            options.testUrl.trim(),
            options.branch?.trim() || 'main'
          );
          emptyRemote = result.emptyRemote;
          canPush = result.canPush;
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        validationError = err instanceof Error ? err.message : String(err);
      }

      notifyOAuthFinished(sender, {
        host,
        connectionId: options.connectionId,
        ok: true,
        ...(validationError ? { validationError } : {}),
        ...(emptyRemote != null ? { emptyRemote } : {}),
        ...(canPush != null ? { canPush } : {})
      });
    } finally {
      if (activeCompletions.get(host) === controller) {
        activeCompletions.delete(host);
      }
    }
  })();
}

/**
 * Polls GitHub in the background for a git connection's host.
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
  const host = resolveConnectionHost(connectionId);
  scheduleHostGitHubOAuthCompletion(sender, db, host, { connectionId });
}

/**
 * Cancels in-flight OAuth polling and clears any pending device-flow session.
 *
 * @param host - Normalized lowercase git host key.
 */
export function cancelHostGitHubOAuthCompletion(host: string): void {
  activeCompletions.get(host)?.abort();
  activeCompletions.delete(host);
  clearPendingGitHubDeviceFlow(host);
}

/**
 * Cancels in-flight OAuth polling for a git connection's host.
 *
 * @param connectionId - Git connection id.
 */
export function cancelGitHubOAuthCompletion(connectionId: string): void {
  const host = resolveConnectionHost(connectionId);
  cancelHostGitHubOAuthCompletion(host);
}
