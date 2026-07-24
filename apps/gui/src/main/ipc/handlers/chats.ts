import {
  cancelActiveChatStep,
  trackActiveChatStep,
  untrackActiveChatStep
} from '#/main/ai/activeChatSteps';
import { runChatCompletionStep } from '#/main/ai/completeChatTurn';
import { runGenerateChatTitle } from '#/main/ai/generateChatTitle';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for AI chat persistence in the local registry.
 */
export function registerChatHandlers(): void {
  // Lists persisted AI chats from the local registry.
  handle('chats:list', ipcArgSchemas.none, () => getLocalDatabase().listChats());

  // Creates a new AI chat record.
  handle('chats:create', ipcArgSchemas.chatCreate, (_event, input) =>
    getLocalDatabase().createChat(input)
  );

  // Returns a single AI chat by id.
  handle('chats:get', ipcArgSchemas.chatGet, (_event, id) => getLocalDatabase().getChat(id));

  // Appends a message to an AI chat.
  handle('chats:addMessage', ipcArgSchemas.chatAddMessage, (_event, input) =>
    getLocalDatabase().addChatMessage(input)
  );

  // Summarizes the user's first message into a short chat title.
  handle('chats:generateTitle', ipcArgSchemas.chatGenerateTitle, (_event, input) =>
    runGenerateChatTitle(input)
  );

  // Runs one LLM completion step for a chat turn.
  handle(
    'chats:completeStep',
    ipcArgSchemas.chatCompleteStep,
    async (_event, input, stepRequestId) => {
      const controller = new AbortController();
      if (stepRequestId) {
        trackActiveChatStep(stepRequestId, controller);
      }

      try {
        return await runChatCompletionStep(input, undefined, { signal: controller.signal });
      } finally {
        if (stepRequestId) {
          untrackActiveChatStep(stepRequestId, controller);
        }
      }
    }
  );

  // Aborts an in-flight LLM completion step by its client-side step request id.
  handle('chats:cancelStep', ipcArgSchemas.chatCancelStep, (_event, stepRequestId) => {
    cancelActiveChatStep(stepRequestId);
  });

  // Deletes an AI chat by id.
  handle('chats:delete', ipcArgSchemas.chatDelete, (_event, id) => {
    getLocalDatabase().deleteChat(id);
  });
}
