import { BrowserWindow, dialog, net, shell } from 'electron';
import { basename } from 'path';
import { copyFile, readFile, writeFile } from 'fs/promises';
import { getDefaultLogFilePath } from '#/main/fileLogger';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import {
  assertFilePathOpenable,
  assertFilePathAllowed,
  assertFilePathWritableDirectory,
  grantFilePathAccess
} from '#/main/ipc/handlers/filePathAccess';
import {
  imageSaveFilters,
  parseDataUrl,
  resolveImageMime
} from '#/main/ipc/handlers/imageFileHelpers';
import { resolveAvailableWritePathInDirectory } from '#/main/ipc/handlers/writeTextInDirectory';

/**
 * Opens a save dialog and returns the chosen path, or null when canceled.
 *
 * Grants the destination so later file IPC can reference it.
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
  return grantFilePathAccess(filePath);
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

    return grantFilePathAccess(filePaths[0]!);
  });

  // Opens a single-file picker filtered for TLS certificate / private-key files.
  handle('dialog:openSslFile', ipcArgSchemas.openSslFile, async (_event, defaultPath) => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      properties: ['openFile'] as Array<'openFile'>,
      defaultPath: defaultPath.trim() || undefined,
      filters: [
        { name: 'Certificate / key', extensions: ['pem', 'crt', 'key', 'cert'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      return null;
    }

    return grantFilePathAccess(filePaths[0]!);
  });

  // Opens a single-file picker filtered for HTML error-page files.
  handle('dialog:openFile', ipcArgSchemas.openFile, async (_event, defaultPath) => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      properties: ['openFile'] as Array<'openFile'>,
      defaultPath: defaultPath.trim() || undefined,
      filters: [
        { name: 'HTML', extensions: ['html', 'htm'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      return null;
    }

    return grantFilePathAccess(filePaths[0]!);
  });

  // Opens a file or directory in the OS default application (e.g. the file browser).
  handle('files:openPath', ipcArgSchemas.openPath, async (_event, path) => {
    const allowedPath = assertFilePathOpenable(path);
    const error = await shell.openPath(allowedPath);
    if (error) {
      throw new Error(error);
    }
  });

  // Reveals a file in its containing folder in the OS file manager.
  handle('files:showItemInFolder', ipcArgSchemas.openPath, (_event, path) => {
    shell.showItemInFolder(assertFilePathAllowed(path));
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

    return grantFilePathAccess(filePath);
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

    const grantedPath = grantFilePathAccess(filePath);
    await writeFile(grantedPath, content, 'utf-8');
    return { canceled: false, path: grantedPath };
  });

  // Writes UTF-8 text into a directory using a basename, with collision suffixes.
  handle(
    'files:writeTextInDirectory',
    ipcArgSchemas.writeTextInDirectory,
    async (_event, directory, fileName, content) => {
      const allowedDirectory = assertFilePathWritableDirectory(directory);
      const filePath = await resolveAvailableWritePathInDirectory(allowedDirectory, fileName);
      await writeFile(filePath, content, 'utf-8');
      return { path: filePath };
    }
  );

  // Reads a local image file and returns a data URL for the renderer viewer.
  handle('files:readImageDataUrl', ipcArgSchemas.readImageDataUrl, async (_event, filePath) => {
    const allowedPath = assertFilePathAllowed(filePath);
    const buffer = await readFile(allowedPath);
    const mime = resolveImageMime(buffer, allowedPath);
    return {
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
      fileName: basename(allowedPath)
    };
  });

  // Copies a local file to a destination chosen via a native save dialog.
  handle(
    'files:copyFileToSaveDialog',
    ipcArgSchemas.copyFileToSaveDialog,
    async (_event, sourcePath, defaultFileName) => {
      const allowedSource = assertFilePathAllowed(sourcePath);
      const destination = await promptSavePath(
        defaultFileName.trim() || basename(allowedSource),
        imageSaveFilters(defaultFileName || allowedSource)
      );
      if (!destination) {
        return { canceled: true };
      }
      await copyFile(allowedSource, destination);
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
