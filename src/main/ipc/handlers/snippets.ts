import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for reusable JavaScript snippet CRUD.
 */
export function registerSnippetHandlers(): void {
  handle('snippets:list', ipcArgSchemas.none, () => getLocalDatabase().listSnippets());

  handle('snippets:create', ipcArgSchemas.snippetCreate, (_event, name, code, scope) =>
    getLocalDatabase().createSnippet(name, code, scope)
  );

  handle('snippets:update', ipcArgSchemas.snippetUpdate, (_event, id, name, code, scope) =>
    getLocalDatabase().updateSnippet(id, name, code, scope)
  );

  handle('snippets:delete', ipcArgSchemas.dbId, (_event, id) =>
    getLocalDatabase().deleteSnippet(id)
  );
}
