import { runChatCompletionStep } from '#/main/ai/completeChatTurn';
import { getLocalRegistry } from '#/main/db/localRegistryInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for AI chat persistence in the local registry.
 */
export function registerChatHandlers(): void {
  // Lists persisted AI chats from the local registry.
  handle('chats:list', ipcArgSchemas.none, () => getLocalRegistry().listChats());

  // Creates a new AI chat record.
  handle('chats:create', ipcArgSchemas.chatCreate, (_event, input) =>
    getLocalRegistry().createChat(input)
  );

  // Returns a single AI chat by id.
  handle('chats:get', ipcArgSchemas.chatGet, (_event, id) => getLocalRegistry().getChat(id));

  // Appends a message to an AI chat.
  handle('chats:addMessage', ipcArgSchemas.chatAddMessage, (_event, input) =>
    getLocalRegistry().addChatMessage(input)
  );

  // Runs one LLM completion step for a chat turn.
  handle('chats:completeStep', ipcArgSchemas.chatCompleteStep, (_event, input) =>
    runChatCompletionStep(input)
  );

  // Deletes an AI chat by id.
  handle('chats:delete', ipcArgSchemas.chatDelete, (_event, id) => {
    getLocalRegistry().deleteChat(id);
  });
}
