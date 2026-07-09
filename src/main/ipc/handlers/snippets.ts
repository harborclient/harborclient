import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { fetchSnippetCatalog } from '#/main/snippets/snippetCatalog';
import { fetchSnippetPreviewFromGit } from '#/main/snippets/snippetPreview';
import { getSnippetInstaller } from '#/main/snippets/SnippetInstaller';
import type { SnippetImportResult } from '#/shared/types/api/snippets';
import { parseSnippetBundle } from '#/shared/snippetBundle';
import { BrowserWindow, dialog } from 'electron';
import { app } from 'electron';
import { readFile } from 'fs/promises';

/**
 * Registers IPC handlers for reusable JavaScript snippet CRUD and marketplace install.
 *
 * @param db - Active storage router for routed snippet CRUD.
 */
export function registerSnippetHandlers(db: IStorage): void {
  handle('snippets:list', ipcArgSchemas.none, () => {
    if (db instanceof RoutingStorage) {
      return db.listSnippets();
    }
    return getLocalDatabase().listSnippets();
  });

  handle(
    'snippets:create',
    ipcArgSchemas.snippetCreate,
    (_event, name, code, scope, stage, connectionId) => {
      if (connectionId && db instanceof RoutingStorage) {
        return db.createSnippetInProvider(name, code, scope, connectionId, stage);
      }
      if (db instanceof RoutingStorage) {
        return db.createSnippet(name, code, scope, stage);
      }
      return getLocalDatabase().createSnippet(name, code, scope, stage);
    }
  );

  handle('snippets:update', ipcArgSchemas.snippetUpdate, (_event, id, name, code, scope, stage) => {
    if (db instanceof RoutingStorage) {
      return db.updateSnippet(id, name, code, scope, stage);
    }
    return getLocalDatabase().updateSnippet(id, name, code, scope, stage);
  });

  handle('snippets:delete', ipcArgSchemas.dbId, (_event, id) => {
    if (db instanceof RoutingStorage) {
      return db.deleteSnippet(id);
    }
    return getLocalDatabase().deleteSnippet(id);
  });

  handle('snippets:move', ipcArgSchemas.snippetMove, (_event, id, targetConnectionId) => {
    if (!(db instanceof RoutingStorage)) {
      throw new Error('Snippet move is unavailable.');
    }
    return db.moveSnippet(id, targetConnectionId);
  });

  handle(
    'snippets:importFile',
    ipcArgSchemas.importSnippetFile,
    async (_event, includeBundle): Promise<SnippetImportResult | null> => {
      const win = BrowserWindow.getFocusedWindow();
      const filters = includeBundle
        ? [
            { name: 'JavaScript or JSON', extensions: ['js', 'json'] },
            { name: 'JavaScript', extensions: ['js'] },
            { name: 'JSON', extensions: ['json'] }
          ]
        : [{ name: 'JavaScript', extensions: ['js'] }];
      const dialogOptions = {
        properties: ['openFile'] as Array<'openFile'>,
        filters
      };
      const { canceled, filePaths } = win
        ? await dialog.showOpenDialog(win, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

      if (canceled || filePaths.length === 0) {
        return null;
      }

      const filePath = filePaths[0];
      const raw = await readFile(filePath, 'utf-8');
      if (!raw.trim()) {
        throw new Error('Cannot import an empty script.');
      }

      if (filePath.toLowerCase().endsWith('.json')) {
        return {
          kind: 'bundle',
          bundle: parseSnippetBundle(raw)
        };
      }

      return { kind: 'js', code: raw };
    }
  );

  handle('snippets:catalog', ipcArgSchemas.none, () => fetchSnippetCatalog());

  handle('snippets:previewFromGit', ipcArgSchemas.snippetPreviewFromGit, (_event, url, ref) =>
    fetchSnippetPreviewFromGit(url, ref)
  );

  handle('snippets:installFromGit', ipcArgSchemas.snippetInstallFromGit, (_event, url, ref) =>
    getSnippetInstaller(app.getVersion()).installFromGit(url, ref)
  );

  handle('snippets:install', ipcArgSchemas.none, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Install snippet bundle',
      properties: ['openFile'],
      filters: [{ name: 'HarborClient snippet bundle', extensions: ['hcs', 'zip'] }]
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    return getSnippetInstaller(app.getVersion()).installFromFile(filePaths[0]);
  });

  handle('snippets:installFromPath', ipcArgSchemas.snippetInstallFromPath, (_event, path) =>
    getSnippetInstaller(app.getVersion()).installFromFile(path)
  );

  handle('snippets:loadUnpacked', ipcArgSchemas.none, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Load unpacked snippet bundle',
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    return getSnippetInstaller(app.getVersion()).loadUnpacked(filePaths[0]);
  });

  handle(
    'snippets:loadUnpackedFromPath',
    ipcArgSchemas.snippetLoadUnpackedFromPath,
    (_event, path) => getSnippetInstaller(app.getVersion()).loadUnpacked(path)
  );

  handle('snippets:updateFromGit', ipcArgSchemas.snippetCatalogId, (_event, catalogId) =>
    getSnippetInstaller(app.getVersion()).updateFromGit(catalogId)
  );

  handle('snippets:uninstallPackage', ipcArgSchemas.snippetCatalogId, (_event, catalogId) => {
    getSnippetInstaller(app.getVersion()).uninstallPackage(catalogId);
  });

  handle('snippets:listInstalledPackages', ipcArgSchemas.none, () =>
    getSnippetInstaller(app.getVersion()).listInstalledPackages()
  );
}
