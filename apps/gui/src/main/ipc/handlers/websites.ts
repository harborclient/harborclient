import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { getTrashService } from '#/main/storage/trashServiceInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for local websites in the registry database.
 */
export function registerWebsiteHandlers(): void {
  handle('websites:list', ipcArgSchemas.none, () => getLocalDatabase().listWebsites());

  handle('websites:create', ipcArgSchemas.websitesCreate, (_event, input) =>
    getLocalDatabase().createWebsite(input)
  );

  handle('websites:update', ipcArgSchemas.websitesUpdate, (_event, input) =>
    getLocalDatabase().updateWebsite(input)
  );

  handle('websites:delete', ipcArgSchemas.websitesDelete, (_event, id) => {
    getTrashService().moveWebsiteToTrash(id);
    return getLocalDatabase().listWebsites();
  });
}
