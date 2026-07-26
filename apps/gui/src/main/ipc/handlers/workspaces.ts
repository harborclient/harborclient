import { BrowserWindow } from 'electron';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { getTrashService } from '#/main/storage/trashServiceInstance';
import { handle } from '#/main/ipc/handle';
import { openImportFile } from './importDialogs';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import type { Workspace } from '@harborclient/core/types/workspace';
import { validateWorkspaceExport } from '@harborclient/core/types/workspace';

/**
 * Imports a workspace export file into the local registry.
 *
 * @param win - Focused browser window for file selection, if any.
 * @param data - Parsed workspace export payload.
 * @returns Refreshed workspace list after import, or null when canceled.
 */
export async function importWorkspaceData(
  win: BrowserWindow | null,
  data: unknown
): Promise<Workspace[] | null> {
  const exportData = validateWorkspaceExport(data);
  return getLocalDatabase().createWorkspace({
    name: exportData.name,
    requests: exportData.requestUuids.map((requestUuid) => ({ requestUuid })),
    marker: exportData.marker ?? null
  });
}

/**
 * Registers IPC handlers for local workspaces in the registry database.
 */
export function registerWorkspaceHandlers(): void {
  handle('workspaces:list', ipcArgSchemas.none, () => getLocalDatabase().listWorkspaces());

  handle('workspaces:create', ipcArgSchemas.workspacesCreate, (_event, input) =>
    getLocalDatabase().createWorkspace(input)
  );

  handle('workspaces:update', ipcArgSchemas.workspacesUpdate, (_event, id, requests) =>
    getLocalDatabase().updateWorkspace(id, requests)
  );

  handle('workspaces:rename', ipcArgSchemas.workspacesRename, (_event, id, name) =>
    getLocalDatabase().renameWorkspace(id, name)
  );

  handle('workspaces:clone', ipcArgSchemas.workspacesClone, (_event, id, name) =>
    getLocalDatabase().cloneWorkspace(id, name)
  );

  handle('workspaces:delete', ipcArgSchemas.workspacesDelete, (_event, id) => {
    getTrashService().moveWorkspaceToTrash(id);
    return getLocalDatabase().listWorkspaces();
  });

  handle('workspaces:reorder', ipcArgSchemas.workspacesReorder, (_event, orderedIds) =>
    getLocalDatabase().reorderWorkspaces(orderedIds)
  );

  handle('workspaces:setMarker', ipcArgSchemas.workspacesSetMarker, (_event, id, marker) =>
    getLocalDatabase().setWorkspaceMarker(id, marker)
  );

  handle('workspaces:import', ipcArgSchemas.none, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const file = await openImportFile(win);
    if (!file) {
      return null;
    }

    return importWorkspaceData(win, file.parsed);
  });
}
