import type { WebContents } from 'electron';
import { beginGithubModelsSignIn, finishGithubModelsSignIn } from '#/main/ai/githubModelsAuth';
import { clearPendingGitHubDeviceFlow } from '#/main/git/githubOAuth';
import type { GithubModelsSignInFinishedEvent } from '#/shared/types/ai';

let activeCompletion: AbortController | undefined;

/**
 * Sends a GitHub Models sign-in completion event to the renderer when the target is still alive.
 *
 * @param sender - Renderer web contents that started sign-in.
 * @param event - Sign-in completion payload.
 */
function notifySignInFinished(sender: WebContents, event: GithubModelsSignInFinishedEvent): void {
  if (sender.isDestroyed()) {
    return;
  }
  sender.send('githubModels:signInFinished', event);
}

/**
 * Polls GitHub in the background until GitHub Models sign-in completes, fails, or is cancelled.
 *
 * @param sender - Renderer web contents to notify on completion.
 */
export function scheduleGithubModelsSignInCompletion(sender: WebContents): void {
  activeCompletion?.abort();

  const controller = new AbortController();
  activeCompletion = controller;

  void (async () => {
    try {
      await finishGithubModelsSignIn({ signal: controller.signal });
      notifySignInFinished(sender, { ok: true });
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      notifySignInFinished(sender, {
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      if (activeCompletion === controller) {
        activeCompletion = undefined;
      }
    }
  })();
}

/**
 * Cancels in-flight GitHub Models sign-in polling and clears any pending device-flow session.
 */
export function cancelGithubModelsSignInCompletion(): void {
  activeCompletion?.abort();
  activeCompletion = undefined;
  clearPendingGitHubDeviceFlow('github-models');
}

/**
 * Starts GitHub Models device flow and returns the user code and verification URI.
 */
export async function startGithubModelsSignInFlow(): Promise<{
  userCode: string;
  verificationUri: string;
}> {
  return beginGithubModelsSignIn();
}
