import { getLocalRegistry } from '#/main/db/localRegistryInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for AI chat persistence in the local registry.
 */
export function registerChatHandlers(): void {
  handle('chats:list', ipcArgSchemas.none, () => getLocalRegistry().listChats());

  handle('chats:create', ipcArgSchemas.chatCreate, (_event, input) =>
    getLocalRegistry().createChat(input)
  );

  handle('chats:get', ipcArgSchemas.chatGet, (_event, id) => getLocalRegistry().getChat(id));

  handle('chats:addMessage', ipcArgSchemas.chatAddMessage, (_event, input) =>
    getLocalRegistry().addChatMessage(input)
  );

  handle('chats:delete', ipcArgSchemas.chatDelete, (_event, id) => {
    getLocalRegistry().deleteChat(id);
  });
}
