import { BrowserWindow, dialog } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import {
  collectionExportContainsScripts,
  validateCollectionExport
} from '#/main/db/collectionData';
import type { IDatabase } from '#/main/db/IDatabase';
import { RoutingDatabase } from '#/main/db/RoutingDatabase';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for collection CRUD, import/export, move, and file dialogs.
 *
 * @param db - Database instance backing collection persistence.
 */
export function registerCollectionHandlers(db: IDatabase): void {
  // Lists all saved request collections.
  handle('collections:list', ipcArgSchemas.none, async () => {
    const collections = await db.listCollections();
    const warnings = db instanceof RoutingDatabase ? db.consumeCollectionListWarnings() : [];
    return { collections, warnings };
  });

  // Creates a new collection with the given display name.
  handle('collections:create', ipcArgSchemas.name, (_event, collectionName) =>
    db.createCollection(collectionName)
  );

  // Updates a collection's name, variables, headers, and scripts.
  handle(
    'collections:update',
    ipcArgSchemas.collectionUpdate,
    (_event, id, collectionName, variables, headers, preRequestScript, postRequestScript) =>
      db.updateCollection(
        id,
        collectionName,
        variables,
        headers,
        preRequestScript,
        postRequestScript
      )
  );

  // Deletes a collection and all of its folders and requests.
  handle('collections:delete', ipcArgSchemas.dbId, (_event, id) => db.deleteCollection(id));

  // Exports a collection to a JSON file via a native save dialog.
  handle('collections:export', ipcArgSchemas.dbId, async (_event, id) => {
    const data = await db.exportCollectionData(id);
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      defaultPath: `${data.name}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    };
    const { canceled, filePath } = win
      ? await dialog.showSaveDialog(win, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (canceled || !filePath) {
      return { canceled: true };
    }

    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { canceled: false, path: filePath };
  });

  // Imports a collection from a JSON file selected via a native open dialog.
  handle('collections:import', ipcArgSchemas.none, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      properties: ['openFile'] as Array<'openFile'>,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      return null;
    }

    const raw = await readFile(filePaths[0], 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    const exportData = validateCollectionExport(parsed);

    if (collectionExportContainsScripts(exportData)) {
      const messageBoxOptions = {
        type: 'warning' as const,
        buttons: ['Cancel', 'Import anyway'],
        defaultId: 0,
        cancelId: 0,
        title: 'Collection contains scripts',
        message: 'This collection includes pre-request or post-request scripts.',
        detail:
          'Scripts from imported files may not be safe. They run in a limited sandbox, but that sandbox is not a security boundary. Only import collections from sources you trust.'
      };
      const { response } = win
        ? await dialog.showMessageBox(win, messageBoxOptions)
        : await dialog.showMessageBox(messageBoxOptions);

      if (response !== 1) {
        return null;
      }
    }

    return db.importCollectionData(exportData);
  });

  // Moves a collection to a different database connection.
  handle('collections:move', ipcArgSchemas.collectionMove, (_event, id, targetConnectionId) => {
    if (!(db instanceof RoutingDatabase)) {
      throw new Error('Collection move is unavailable.');
    }
    return db.moveCollection(id, targetConnectionId);
  });

  // Opens a native file picker and returns selected absolute file paths.
  handle('dialog:openFiles', ipcArgSchemas.none, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
      filters: [{ name: 'All Files', extensions: ['*'] }]
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      return [];
    }

    return filePaths;
  });
}
