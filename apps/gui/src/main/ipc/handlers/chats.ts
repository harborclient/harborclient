import {
  cancelActiveChatStep,
  trackActiveChatStep,
  untrackActiveChatStep
} from '#/main/ai/activeChatSteps';
import { runChatCompletionStep } from '#/main/ai/completeChatTurn';
import { runGenerateChatTitle } from '#/main/ai/generateChatTitle';
import type { AiChatStreamContext } from '@harborclient/core/types';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Normalizes optional stream context and step request id arguments for completion steps.
 *
 * @param second - Optional stream context or step request id.
 * @param third - Optional step request id when `second` is stream context.
 */
function readCompleteStepOptions(
  second?: AiChatStreamContext | string,
  third?: string
): { streamContext?: AiChatStreamContext; stepRequestId?: string } {
  if (typeof second === 'string') {
    return { stepRequestId: second };
  }

  if (second != null) {
    return { streamContext: second, stepRequestId: third };
  }

  return {};
}

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

  // Stores complete recovery state for a turn paused on ask_user.
  handle('chats:savePendingTurn', ipcArgSchemas.chatSavePendingTurn, (_event, pendingTurn) => {
    getLocalDatabase().savePendingChatTurn(pendingTurn);
  });

  // Returns a valid paused-turn recovery payload when one exists for the chat.
  handle('chats:getPendingTurn', ipcArgSchemas.chatGetPendingTurn, (_event, chatId) =>
    getLocalDatabase().getPendingChatTurn(chatId)
  );

  // Clears a paused-turn recovery payload before discard or terminal cleanup.
  handle('chats:deletePendingTurn', ipcArgSchemas.chatDeletePendingTurn, (_event, chatId) => {
    getLocalDatabase().deletePendingChatTurn(chatId);
  });

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
    async (_event, input, second, third) => {
      const { streamContext, stepRequestId } = readCompleteStepOptions(second, third);
      const controller = new AbortController();
      if (stepRequestId) {
        trackActiveChatStep(stepRequestId, controller);
      }

      try {
        return await runChatCompletionStep(input, undefined, {
          signal: controller.signal,
          ...(streamContext ? { streamContext } : {})
        });
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
