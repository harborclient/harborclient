import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for workflow run history in the local registry.
 */
export function registerWorkflowRunHistoryHandlers(): void {
  handle('workflowRunHistory:list', ipcArgSchemas.none, () =>
    getLocalDatabase().listWorkflowRunHistory()
  );

  handle('workflowRunHistory:add', ipcArgSchemas.workflowRunHistoryAdd, (_event, entry) =>
    getLocalDatabase().addWorkflowRunHistory(entry)
  );

  handle('workflowRunHistory:clear', ipcArgSchemas.none, () => {
    getLocalDatabase().clearWorkflowRunHistory();
  });

  handle('workflowRunHistory:delete', ipcArgSchemas.workflowRunHistoryDelete, (_event, id) =>
    getLocalDatabase().deleteWorkflowRunHistory(id)
  );
}
