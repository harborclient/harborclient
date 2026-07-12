import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { getTrashService } from '#/main/storage/trashServiceInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for native request history in the local registry.
 */
export function registerRequestHistoryHandlers(): void {
  handle('requestHistory:list', ipcArgSchemas.none, () => getLocalDatabase().listRequestHistory());

  handle('requestHistory:add', ipcArgSchemas.requestHistoryAdd, (_event, entry) =>
    getLocalDatabase().addRequestHistory(entry)
  );

  handle('requestHistory:clear', ipcArgSchemas.none, () => {
    getLocalDatabase().clearRequestHistory();
  });

  handle('requestHistory:delete', ipcArgSchemas.requestHistoryDelete, (_event, id) => {
    getTrashService().moveHistoryToTrash(id);
    return getLocalDatabase().listRequestHistory();
  });
}
