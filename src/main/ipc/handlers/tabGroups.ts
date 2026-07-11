import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for local tab groups in the registry database.
 */
export function registerTabGroupHandlers(): void {
  handle('tabGroups:list', ipcArgSchemas.none, () => getLocalDatabase().listTabGroups());

  handle('tabGroups:create', ipcArgSchemas.tabGroupsCreate, (_event, input) =>
    getLocalDatabase().createTabGroup(input)
  );

  handle('tabGroups:update', ipcArgSchemas.tabGroupsUpdate, (_event, id, requests) =>
    getLocalDatabase().updateTabGroup(id, requests)
  );

  handle('tabGroups:rename', ipcArgSchemas.tabGroupsRename, (_event, id, name) =>
    getLocalDatabase().renameTabGroup(id, name)
  );

  handle('tabGroups:clone', ipcArgSchemas.tabGroupsClone, (_event, id, name) =>
    getLocalDatabase().cloneTabGroup(id, name)
  );

  handle('tabGroups:delete', ipcArgSchemas.tabGroupsDelete, (_event, id) =>
    getLocalDatabase().deleteTabGroup(id)
  );

  handle('tabGroups:reorder', ipcArgSchemas.tabGroupsReorder, (_event, orderedIds) =>
    getLocalDatabase().reorderTabGroups(orderedIds)
  );
}
