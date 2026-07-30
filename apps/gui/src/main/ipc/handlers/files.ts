import { BrowserWindow, dialog, net, shell } from 'electron';
import { basename } from 'path';
import { copyFile, readFile, writeFile } from 'fs/promises';
import { getDefaultLogFilePath } from '#/main/fileLogger';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import {
  imageSaveFilters,
  parseDataUrl,
  resolveImageMime
} from '#/main/ipc/handlers/imageFileHelpers';
import { resolveAvailableWritePathInDirectory } from '#/main/ipc/handlers/writeTextInDirectory';

/**
 * Opens a save dialog and returns the chosen path, or null when canceled.
 *
 * @param defaultPath - Suggested destination path or filename.
 * @param filters - Dialog file-type filters.
 * @returns Absolute destination path, or null.
 */
async function promptSavePath(
  defaultPath: string,
  filters: Array<{ name: string; extensions: string[] }>
): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow();
  const dialogOptions = {
    defaultPath: defaultPath.trim() || undefined,
    filters
  };
  const { canceled, filePath } = win
    ? await dialog.showSaveDialog(win, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);

  if (canceled || !filePath) {
    return null;
  }
  return filePath;
}

/**
 * Downloads image bytes from an http(s) URL via Electron's network stack.
 *
 * @param url - Remote image URL.
 * @returns Response body buffer and content-type when present.
 */
async function fetchImageBytes(url: string): Promise<{ buffer: Buffer; contentType?: string }> {
  const response = await net.fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image (${response.status}): ${url}`);
  }
  const contentType = response.headers.get('content-type') ?? undefined;
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

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

  // Opens a file or directory in the OS default application (e.g. the file browser).
  handle('files:openPath', ipcArgSchemas.openPath, async (_event, path) => {
    const error = await shell.openPath(path);
    if (error) {
      throw new Error(error);
    }
  });

  // Reveals a file in its containing folder in the OS file manager.
  handle('files:showItemInFolder', ipcArgSchemas.openPath, (_event, path) => {
    shell.showItemInFolder(path);
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

  // Writes UTF-8 text into a directory using a basename, with collision suffixes.
  handle(
    'files:writeTextInDirectory',
    ipcArgSchemas.writeTextInDirectory,
    async (_event, directory, fileName, content) => {
      const filePath = await resolveAvailableWritePathInDirectory(directory, fileName);
      await writeFile(filePath, content, 'utf-8');
      return { path: filePath };
    }
  );

  // Reads a local image file and returns a data URL for the renderer viewer.
  handle('files:readImageDataUrl', ipcArgSchemas.readImageDataUrl, async (_event, filePath) => {
    const buffer = await readFile(filePath);
    const mime = resolveImageMime(buffer, filePath);
    return {
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
      fileName: basename(filePath)
    };
  });

  // Copies a local file to a destination chosen via a native save dialog.
  handle(
    'files:copyFileToSaveDialog',
    ipcArgSchemas.copyFileToSaveDialog,
    async (_event, sourcePath, defaultFileName) => {
      const destination = await promptSavePath(
        defaultFileName.trim() || basename(sourcePath),
        imageSaveFilters(defaultFileName || sourcePath)
      );
      if (!destination) {
        return { canceled: true };
      }
      await copyFile(sourcePath, destination);
      return { canceled: false, path: destination };
    }
  );

  // Writes image bytes from a data URL or remote URL via a native save dialog.
  handle('files:saveDataUrlToFile', ipcArgSchemas.saveDataUrlToFile, async (_event, payload) => {
    const defaultFileName =
      typeof payload.defaultFileName === 'string' && payload.defaultFileName.trim()
        ? payload.defaultFileName.trim()
        : 'image.png';

    let buffer: Buffer;
    if (typeof payload.dataUrl === 'string' && payload.dataUrl.trim()) {
      buffer = parseDataUrl(payload.dataUrl).buffer;
    } else if (typeof payload.url === 'string' && payload.url.trim()) {
      const downloaded = await fetchImageBytes(payload.url.trim());
      buffer = downloaded.buffer;
    } else {
      throw new Error('saveDataUrlToFile requires a dataUrl or url.');
    }

    const destination = await promptSavePath(defaultFileName, imageSaveFilters(defaultFileName));
    if (!destination) {
      return { canceled: true };
    }
    await writeFile(destination, buffer);
    return { canceled: false, path: destination };
  });
}
