import { BrowserWindow, dialog } from 'electron';
import { app } from 'electron';
import { readFile } from 'fs/promises';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { fetchSnippetCatalog } from '#/main/snippets/snippetCatalog';
import { fetchSnippetPreviewFromGit } from '#/main/snippets/snippetPreview';
import { getSnippetInstaller } from '#/main/snippets/SnippetInstaller';
import type { SnippetImportResult } from '#/shared/types/api/snippets';

/**
 * Registers IPC handlers for reusable JavaScript snippet CRUD and marketplace install.
 */
export function registerSnippetHandlers(): void {
  handle('snippets:list', ipcArgSchemas.none, () => getLocalDatabase().listSnippets());

  handle('snippets:create', ipcArgSchemas.snippetCreate, (_event, name, code, scope) =>
    getLocalDatabase().createSnippet(name, code, scope)
  );

  handle('snippets:update', ipcArgSchemas.snippetUpdate, (_event, id, name, code, scope) =>
    getLocalDatabase().updateSnippet(id, name, code, scope)
  );

  handle('snippets:delete', ipcArgSchemas.dbId, (_event, id) =>
    getLocalDatabase().deleteSnippet(id)
  );

  handle(
    'snippets:importFile',
    ipcArgSchemas.none,
    async (): Promise<SnippetImportResult | null> => {
      const win = BrowserWindow.getFocusedWindow();
      const dialogOptions = {
        properties: ['openFile'] as Array<'openFile'>,
        filters: [{ name: 'JavaScript', extensions: ['js'] }]
      };
      const { canceled, filePaths } = win
        ? await dialog.showOpenDialog(win, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

      if (canceled || filePaths.length === 0) {
        return null;
      }

      const raw = await readFile(filePaths[0], 'utf-8');
      if (!raw.trim()) {
        throw new Error('Cannot import an empty script.');
      }

      return { code: raw };
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
