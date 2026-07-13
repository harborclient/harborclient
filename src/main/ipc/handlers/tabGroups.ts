import { BrowserWindow } from 'electron';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { getTrashService } from '#/main/storage/trashServiceInstance';
import { handle } from '#/main/ipc/handle';
import { openImportFile } from '#/main/ipc/handlers/importDialogs';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import type { TabGroup } from '#/shared/types/tabGroup';
import { validateTabGroupExport } from '#/shared/types/tabGroup';

/**
 * Imports a tab group export file into the local registry.
 *
 * @param win - Focused browser window for file selection, if any.
 * @param data - Parsed tab group export payload.
 * @returns Refreshed tab group list after import, or null when canceled.
 */
export async function importTabGroupData(
  win: BrowserWindow | null,
  data: unknown
): Promise<TabGroup[] | null> {
  const exportData = validateTabGroupExport(data);
  return getLocalDatabase().createTabGroup({
    name: exportData.name,
    requests: exportData.requestUuids.map((requestUuid) => ({ requestUuid })),
    color: exportData.color ?? null
  });
}

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

  handle('tabGroups:delete', ipcArgSchemas.tabGroupsDelete, (_event, id) => {
    getTrashService().moveTabGroupToTrash(id);
    return getLocalDatabase().listTabGroups();
  });

  handle('tabGroups:reorder', ipcArgSchemas.tabGroupsReorder, (_event, orderedIds) =>
    getLocalDatabase().reorderTabGroups(orderedIds)
  );

  handle('tabGroups:setColor', ipcArgSchemas.tabGroupsSetColor, (_event, id, color) =>
    getLocalDatabase().setTabGroupColor(id, color)
  );

  handle('tabGroups:import', ipcArgSchemas.none, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const file = await openImportFile(win);
    if (!file) {
      return null;
    }

    return importTabGroupData(win, file.parsed);
  });
}
