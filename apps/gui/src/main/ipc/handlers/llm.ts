import { shell } from 'electron';
import { listHubLlmModels } from '#/main/ai/hubChatStep';
import { getGithubModelsStatus, signOutGithubModels } from '#/main/ai/githubModelsAuth';
import {
  cancelGithubModelsSignInCompletion,
  scheduleGithubModelsSignInCompletion,
  startGithubModelsSignInFlow
} from '#/main/ai/githubModelsOAuthScheduler';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { isAllowedExternalUrl } from '#/main/window/navigationSecurity';

/**
 * Registers IPC handlers for Team Hub LLM model discovery and GitHub Models sign-in.
 */
export function registerLlmHandlers(): void {
  // Lists LLM models available from configured Team Hubs.
  handle('llm:listHubModels', ipcArgSchemas.none, () => listHubLlmModels());

  // Returns GitHub Models connection status for the renderer.
  handle('githubModels:getStatus', ipcArgSchemas.none, () => getGithubModelsStatus());

  // Starts GitHub Models device flow and returns the user code; browser opens on complete.
  handle('githubModels:startSignIn', ipcArgSchemas.none, async () => {
    return startGithubModelsSignInFlow();
  });

  // Opens the browser verification URI and starts background GitHub Models polling.
  handle(
    'githubModels:completeSignIn',
    ipcArgSchemas.githubModelsCompleteSignIn,
    async (event, verificationUri) => {
      const trimmed = verificationUri.trim();
      if (!trimmed || !isAllowedExternalUrl(trimmed)) {
        throw new Error('Invalid GitHub verification URL.');
      }
      await shell.openExternal(trimmed);
      scheduleGithubModelsSignInCompletion(event.sender);
    }
  );

  // Removes stored GitHub Models credentials and cancels pending sign-in.
  handle('githubModels:signOut', ipcArgSchemas.none, () => {
    cancelGithubModelsSignInCompletion();
    signOutGithubModels();
  });
}
