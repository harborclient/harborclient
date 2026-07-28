import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { getTrashService } from '#/main/storage/trashServiceInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for local workflows in the registry database.
 */
export function registerWorkflowHandlers(): void {
  handle('workflows:list', ipcArgSchemas.none, () => getLocalDatabase().listWorkflows());

  handle('workflows:create', ipcArgSchemas.workflowsCreate, (_event, input) =>
    getLocalDatabase().createWorkflow(input)
  );

  handle('workflows:update', ipcArgSchemas.workflowsUpdate, (_event, input) =>
    getLocalDatabase().updateWorkflow(input.id, {
      actions: input.actions,
      durationMs: input.durationMs
    })
  );

  handle('workflows:delete', ipcArgSchemas.workflowsDelete, (_event, id) => {
    getTrashService().moveWorkflowToTrash(id);
    return getLocalDatabase().listWorkflows();
  });
}
