import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import { getTrashService } from '#/main/storage/trashServiceInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import type { SaveRunResultInput } from '#/shared/collectionRunner';

/**
 * Registers IPC handlers for persisted collection run result snapshots.
 *
 * @param db - Database instance backing run result persistence.
 */
export function registerRunResultHandlers(db: IStorage): void {
  handle('runResults:list', ipcArgSchemas.none, async () => {
    if (!(db instanceof RoutingStorage)) {
      return [];
    }
    return db.listRunResults();
  });

  handle('runResults:save', ipcArgSchemas.runResultsSave, async (_event, connectionId, input) => {
    if (!(db instanceof RoutingStorage)) {
      throw new Error('Run results require routed storage.');
    }
    return db.saveRunResult(connectionId, input as SaveRunResultInput);
  });

  handle('runResults:get', ipcArgSchemas.dbId, async (_event, id) => {
    if (!(db instanceof RoutingStorage)) {
      return null;
    }
    return db.getRunResult(id);
  });

  handle('runResults:delete', ipcArgSchemas.dbId, async (_event, id) => {
    if (!(db instanceof RoutingStorage)) {
      throw new Error('Run results require routed storage.');
    }
    await getTrashService().moveRunResultToTrash(id);
  });

  handle('runResults:getByUuid', ipcArgSchemas.runResultUuid, async (_event, uuid) => {
    if (!(db instanceof RoutingStorage)) {
      return null;
    }
    return db.resolveRunResultByUuid(uuid);
  });
}
