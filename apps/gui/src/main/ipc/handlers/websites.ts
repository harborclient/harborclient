import { BrowserWindow } from 'electron';
import { readHarborclientExport } from '@harborclient/core/harborclientExport';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { getTrashService } from '#/main/storage/trashServiceInstance';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { openImportFile } from './importDialogs';
import { importWebsiteData } from './websiteImport';

/**
 * Registers IPC handlers for routed live pages.
 *
 * @param db - Active storage facade used for provider-backed live pages.
 */
export function registerWebsiteHandlers(db: IStorage): void {
  handle('websites:list', ipcArgSchemas.none, () =>
    db instanceof RoutingStorage ? db.listLivePages() : getLocalDatabase().listWebsites()
  );

  handle('websites:create', ipcArgSchemas.websitesCreate, async (_event, input) => {
    if (db instanceof RoutingStorage) {
      await db.createLivePage(input);
      return db.listLivePages();
    }
    return getLocalDatabase().createWebsite(input);
  });

  handle('websites:update', ipcArgSchemas.websitesUpdate, async (_event, input) => {
    if (db instanceof RoutingStorage) {
      await db.updateLivePage(input);
      return db.listLivePages();
    }
    return getLocalDatabase().updateWebsite(input);
  });

  handle('websites:delete', ipcArgSchemas.websitesDelete, async (_event, id) => {
    await getTrashService().moveWebsiteToTrash(id);
    return db instanceof RoutingStorage ? db.listLivePages() : getLocalDatabase().listWebsites();
  });

  handle('websites:move', ipcArgSchemas.websitesMove, async (_event, id, targetConnectionId) => {
    if (!(db instanceof RoutingStorage)) {
      throw new Error('Live page move is unavailable.');
    }
    await db.moveLivePage(id, targetConnectionId);
    return db.listLivePages();
  });

  // Imports a HarborClient live-page export from a file selected via a native dialog.
  handle('websites:import', ipcArgSchemas.none, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const file = await openImportFile(win);
    if (!file) {
      return null;
    }

    if (file.parsed == null || readHarborclientExport(file.parsed) !== 'website') {
      throw new Error('Selected file is not a HarborClient live page export.');
    }

    const result = await importWebsiteData(file.parsed, db);
    if (!result) {
      throw new Error('Failed to import live page export.');
    }

    return result.website;
  });
}
