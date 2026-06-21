import { BrowserWindow, dialog } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import {
  collectionExportContainsScripts,
  requestExportContainsScripts,
  validateCollectionExport,
  validateRequestExport
} from '#/main/db/collectionData';
import { convertPostmanCollection, isPostmanCollection } from '#/main/import/postman';
import { defaultAuth } from '#/shared/auth';
import {
  getSuppressPostmanImportWarning,
  setSuppressPostmanImportWarning
} from '#/main/settings/importWarningSettings';
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
    (_event, id, collectionName, variables, headers, preRequestScript, postRequestScript, auth) =>
      db.updateCollection(
        id,
        collectionName,
        variables,
        headers,
        preRequestScript,
        postRequestScript,
        auth
      )
  );

  // Deletes a collection and all of its folders and requests.
  handle('collections:delete', ipcArgSchemas.dbId, (_event, id) => db.deleteCollection(id));

  // Deep-copies a collection into a new collection on the same backend.
  handle('collections:duplicate', ipcArgSchemas.dbId, (_event, id) => {
    if (!(db instanceof RoutingDatabase)) {
      throw new Error('Collection duplicate is unavailable.');
    }
    return db.duplicateCollection(id);
  });

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

    let exportData;
    if (isPostmanCollection(parsed)) {
      if (!getSuppressPostmanImportWarning()) {
        const postmanWarningOptions = {
          type: 'warning' as const,
          buttons: ['Cancel', 'Import anyway'],
          defaultId: 0,
          cancelId: 0,
          title: 'Import Postman collection',
          message: 'HarborClient does not support all Postman features.',
          detail:
            'Some Postman settings may be ignored or converted. Scripts from imported files may not behave the same as in Postman. Only import collections from sources you trust.',
          checkboxLabel: "Don't show this again"
        };
        const { response, checkboxChecked } = win
          ? await dialog.showMessageBox(win, postmanWarningOptions)
          : await dialog.showMessageBox(postmanWarningOptions);

        if (response !== 1) {
          return null;
        }

        if (checkboxChecked) {
          setSuppressPostmanImportWarning(true);
        }
      }

      exportData = validateCollectionExport(convertPostmanCollection(parsed));
    } else {
      exportData = validateCollectionExport(parsed);

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
    }

    return db.importCollectionData(exportData);
  });

  // Exports a request to a JSON file via a native save dialog.
  handle('requests:export', ipcArgSchemas.requestExport, async (_event, data) => {
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

  // Imports a request from a JSON file selected via a native open dialog.
  handle('requests:import', ipcArgSchemas.requestImport, async (_event, collectionId, folderId) => {
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
    const exportData = validateRequestExport(parsed);

    if (requestExportContainsScripts(exportData)) {
      const messageBoxOptions = {
        type: 'warning' as const,
        buttons: ['Cancel', 'Import anyway'],
        defaultId: 0,
        cancelId: 0,
        title: 'Request contains scripts',
        message: 'This request includes pre-request or post-request scripts.',
        detail:
          'Scripts from imported files may not be safe. They run in a limited sandbox, but that sandbox is not a security boundary. Only import requests from sources you trust.'
      };
      const { response } = win
        ? await dialog.showMessageBox(win, messageBoxOptions)
        : await dialog.showMessageBox(messageBoxOptions);

      if (response !== 1) {
        return null;
      }
    }

    return db.saveRequest({
      collection_id: collectionId,
      folder_id: folderId ?? null,
      name: exportData.name,
      method: exportData.method,
      url: exportData.url,
      headers: exportData.headers,
      params: exportData.params,
      body: exportData.body,
      body_type: exportData.body_type,
      pre_request_script: exportData.pre_request_script,
      post_request_script: exportData.post_request_script,
      comment: exportData.comment,
      auth: exportData.auth ?? defaultAuth()
    });
  });

  // Moves a collection to a different database connection.
  handle('collections:move', ipcArgSchemas.collectionMove, (_event, id, targetConnectionId) => {
    if (!(db instanceof RoutingDatabase)) {
      throw new Error('Collection move is unavailable.');
    }
    return db.moveCollection(id, targetConnectionId);
  });

  // Reorders collections in the sidebar.
  handle('collections:reorder', ipcArgSchemas.collectionReorder, (_event, orderedCollectionIds) => {
    if (!(db instanceof RoutingDatabase)) {
      throw new Error('Collection reorder is unavailable.');
    }
    return db.reorderCollections(orderedCollectionIds);
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
