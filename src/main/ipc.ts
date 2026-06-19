import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import {
  createCollection,
  deleteCollection,
  deleteRequest,
  exportCollectionData,
  getSetting,
  importCollectionData,
  listCollections,
  listRequests,
  saveRequest,
  setSetting,
  updateCollection
} from '#/main/db';
import { executeRequest } from '#/main/http';
import type { SaveRequestInput, SendRequestInput, ThemeSource, Variable, KeyValue } from '#/shared/types';

const THEME_SETTING_KEY = 'theme';

/**
 * Validates and returns a theme source value.
 *
 * @param value - Raw stored theme value.
 * @returns A valid theme source, defaulting to system.
 */
function parseThemeSource(value: string | undefined): ThemeSource {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
}

/**
 * Registers IPC handlers that bridge renderer calls to db and HTTP modules.
 */
export function registerIpcHandlers(): void {
  // Returns all collections, ordered by name.
  ipcMain.handle('collections:list', () => listCollections());

  // Creates a new collection with the given display name.
  ipcMain.handle('collections:create', (_event, name: string) => createCollection(name));

  // Updates a collection's name, variables, and headers.
  ipcMain.handle(
    'collections:update',
    (_event, id: number, name: string, variables: Variable[], headers: KeyValue[]) =>
      updateCollection(id, name, variables, headers)
  );

  // Deletes a collection and all of its saved requests.
  ipcMain.handle('collections:delete', (_event, id: number) => deleteCollection(id));

  // Exports a collection to a JSON file via a native save dialog.
  ipcMain.handle('collections:export', async (_event, id: number) => {
    const data = exportCollectionData(id);
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

  // Imports a collection from a JSON file via a native open dialog.
  ipcMain.handle('collections:import', async () => {
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
    return importCollectionData(parsed);
  });

  // Returns all saved requests in a collection, ordered by sort order then name.
  ipcMain.handle('requests:list', (_event, collectionId: number) => listRequests(collectionId));

  // Inserts a new saved request or updates an existing one.
  ipcMain.handle('requests:save', (_event, req: SaveRequestInput) => saveRequest(req));

  // Deletes a saved request by ID.
  ipcMain.handle('requests:delete', (_event, id: number) => deleteRequest(id));

  // Sends an HTTP request and returns the response (status, headers, body, timing).
  ipcMain.handle('http:send', (_event, req: SendRequestInput) => executeRequest(req));

  // Returns the application version from package.json.
  ipcMain.handle('app:getVersion', () => app.getVersion());

  // Returns the persisted theme preference.
  ipcMain.handle('theme:get', () => parseThemeSource(getSetting(THEME_SETTING_KEY)));

  // Persists and applies a theme preference.
  ipcMain.handle('theme:set', (_event, theme: ThemeSource) => {
    nativeTheme.themeSource = theme;
    setSetting(THEME_SETTING_KEY, theme);
  });
}
