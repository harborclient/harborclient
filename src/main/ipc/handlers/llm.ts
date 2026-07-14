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

/**
 * Registers IPC handlers for Team Hub LLM model discovery and GitHub Models sign-in.
 */
export function registerLlmHandlers(): void {
  // Lists LLM models available from configured Team Hubs.
  handle('llm:listHubModels', ipcArgSchemas.none, () => listHubLlmModels());

  // Returns GitHub Models connection status for the renderer.
  handle('githubModels:getStatus', ipcArgSchemas.none, () => getGithubModelsStatus());

  // Starts GitHub Models device flow, opens the browser, and polls in the background.
  handle('githubModels:startSignIn', ipcArgSchemas.none, async (event) => {
    const result = await startGithubModelsSignInFlow();
    await shell.openExternal(result.verificationUri);
    scheduleGithubModelsSignInCompletion(event.sender);
    return result;
  });

  // Removes stored GitHub Models credentials and cancels pending sign-in.
  handle('githubModels:signOut', ipcArgSchemas.none, () => {
    cancelGithubModelsSignInCompletion();
    signOutGithubModels();
  });
}
