import { getTrashService } from '#/main/storage/trashServiceInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for sidebar trash snapshots.
 */
export function registerTrashHandlers(): void {
  handle('trash:list', ipcArgSchemas.none, () => getTrashService().listTrashItems());

  handle('trash:restore', ipcArgSchemas.dbId, async (_event, id) =>
    getTrashService().restoreTrashItem(id)
  );

  handle('trash:deleteItem', ipcArgSchemas.dbId, (_event, id) => {
    getTrashService().permanentlyDeleteTrashItem(id);
  });

  handle('trash:empty', ipcArgSchemas.none, () => {
    getTrashService().emptyTrash();
  });
}
