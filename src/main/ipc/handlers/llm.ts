import { listHubLlmModels } from '#/main/ai/hubChatStep';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for Team Hub LLM model discovery.
 */
export function registerLlmHandlers(): void {
  // Lists LLM models available from configured Team Hubs.
  handle('llm:listHubModels', ipcArgSchemas.none, () => listHubLlmModels());
}
