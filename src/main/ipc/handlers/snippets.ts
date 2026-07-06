import { BrowserWindow, dialog } from 'electron';
import { readFile } from 'fs/promises';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import type { SnippetImportResult } from '#/shared/types/api/snippets';

/**
 * Registers IPC handlers for reusable JavaScript snippet CRUD.
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
}
