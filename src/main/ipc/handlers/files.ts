import { BrowserWindow, dialog } from 'electron';
import { writeFile } from 'fs/promises';
import { getDefaultLogFilePath } from '#/main/fileLogger';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for generic file save and open dialogs.
 */
export function registerFileHandlers(): void {
  // Opens a native directory picker and returns the selected absolute path.
  handle('dialog:openDirectory', ipcArgSchemas.openDirectory, async (_event, defaultPath) => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      properties: ['openDirectory'] as Array<'openDirectory'>,
      defaultPath: defaultPath.trim() || undefined
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      return null;
    }

    return filePaths[0];
  });

  // Opens a native save dialog and returns the chosen absolute file path.
  handle('dialog:saveFile', ipcArgSchemas.saveFile, async (_event, defaultPath) => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      defaultPath: defaultPath.trim() || getDefaultLogFilePath(),
      filters: [
        { name: 'Log files', extensions: ['log'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    };
    const { canceled, filePath } = win
      ? await dialog.showSaveDialog(win, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (canceled || !filePath) {
      return null;
    }

    return filePath;
  });

  // Writes arbitrary text to a file chosen via a native save dialog.
  handle('files:saveText', ipcArgSchemas.saveTextFile, async (_event, content, defaultPath) => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      defaultPath,
      filters: [
        { name: 'Text', extensions: ['txt', 'json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    };
    const { canceled, filePath } = win
      ? await dialog.showSaveDialog(win, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (canceled || !filePath) {
      return { canceled: true };
    }

    await writeFile(filePath, content, 'utf-8');
    return { canceled: false, path: filePath };
  });
}
