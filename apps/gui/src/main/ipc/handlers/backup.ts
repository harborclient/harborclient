import { app, BrowserWindow, dialog } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { getPluginDatabaseManager } from '#/main/plugins/pluginDatabaseManagerInstance';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import {
  BACKUP_FILE_FILTER,
  applyBackup,
  buildBackupZip,
  defaultBackupFilename,
  validateAndExtractBackup
} from '#/main/backup/backupArchive';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Flushes WAL pages on open databases so backup file reads are consistent.
 *
 * @param db - Active database router shared by IPC handlers.
 */
function checkpointOpenDatabases(db: IStorage): void {
  getLocalDatabase().checkpointWal();
  try {
    getPluginDatabaseManager().checkpointAll();
  } catch {
    // Plugin database manager is unavailable before IPC registration during startup.
  }
  if (db instanceof RoutingStorage) {
    db.checkpointWalForBackup();
  }
}

/**
 * Registers IPC handlers for HarborClient backup export, restore, and restart.
 *
 * @param db - Active database router shared by IPC handlers.
 */
export function registerBackupHandlers(db: IStorage): void {
  // Exports user data to a backup zip via a save dialog.
  handle('backup:export', ipcArgSchemas.backupExport, async (_event, localStorage) => {
    const userDataPath = app.getPath('userData');
    const archive = await buildBackupZip(userDataPath, localStorage, app.getVersion(), () => {
      checkpointOpenDatabases(db);
    });

    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      defaultPath: defaultBackupFilename(),
      filters: [BACKUP_FILE_FILTER]
    };
    const { canceled, filePath } = win
      ? await dialog.showSaveDialog(win, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (canceled || !filePath) {
      return { canceled: true };
    }

    await writeFile(filePath, new Uint8Array(archive));
    return { canceled: false, path: filePath };
  });

  // Restores user data from a backup zip via an open dialog.
  handle('backup:import', ipcArgSchemas.none, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      properties: ['openFile'] as Array<'openFile'>,
      filters: [BACKUP_FILE_FILTER]
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    const archiveBuffer = await readFile(filePaths[0]);
    const extracted = await validateAndExtractBackup(archiveBuffer);

    await db.close();

    const userDataPath = app.getPath('userData');
    applyBackup(userDataPath, extracted);

    return {
      canceled: false,
      localStorage: extracted.localStorage
    };
  });

  // Relaunches the application.
  handle('app:restart', ipcArgSchemas.none, () => {
    app.relaunch();
    app.exit(0);
  });

  // Returns the Electron userData directory for display in backup settings.
  handle('backup:getUserDataPath', ipcArgSchemas.none, () => app.getPath('userData'));
}
