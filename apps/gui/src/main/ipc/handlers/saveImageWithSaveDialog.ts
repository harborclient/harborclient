import { BrowserWindow, dialog, net } from 'electron';
import { writeFile } from 'fs/promises';
import { grantFilePathAccess } from '#/main/ipc/handlers/filePathAccess';
import { imageSaveFilters, parseDataUrl } from '#/main/ipc/handlers/imageFileHelpers';

/**
 * Input for saving an image via the native save dialog.
 *
 * Exactly one of `url` or `dataUrl` must be provided.
 */
export interface SaveImageWithSaveDialogInput {
  /**
   * Remote http(s) image URL to download and save.
   */
  url?: string;

  /**
   * Inline `data:` URL whose bytes should be written to disk.
   */
  dataUrl?: string;

  /**
   * Suggested filename shown in the save dialog.
   */
  defaultFileName?: string;
}

/**
 * Opens a save dialog and returns the chosen path, or null when canceled.
 *
 * Grants the destination so later file IPC can reference it.
 *
 * @param defaultPath - Suggested destination path or filename.
 * @param filters - Dialog file-type filters.
 * @returns Absolute destination path, or null.
 */
export async function promptSavePath(
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
export async function fetchImageBytes(
  url: string
): Promise<{ buffer: Buffer; contentType?: string }> {
  const response = await net.fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image (${response.status}): ${url}`);
  }
  const contentType = response.headers.get('content-type') ?? undefined;
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

/**
 * Writes image bytes from a data URL or remote URL via a native save dialog.
 *
 * @param input - Image source (`url` or `dataUrl`) and optional default filename.
 * @returns Whether the user canceled, and the destination path when saved.
 * @throws When neither source is provided or download/parse fails.
 */
export async function saveImageWithSaveDialog(
  input: SaveImageWithSaveDialogInput
): Promise<{ canceled: boolean; path?: string }> {
  const defaultFileName =
    typeof input.defaultFileName === 'string' && input.defaultFileName.trim()
      ? input.defaultFileName.trim()
      : 'image.png';

  let buffer: Buffer;
  if (typeof input.dataUrl === 'string' && input.dataUrl.trim()) {
    buffer = parseDataUrl(input.dataUrl).buffer;
  } else if (typeof input.url === 'string' && input.url.trim()) {
    const downloaded = await fetchImageBytes(input.url.trim());
    buffer = downloaded.buffer;
  } else {
    throw new Error('saveImageWithSaveDialog requires a dataUrl or url.');
  }

  const destination = await promptSavePath(defaultFileName, imageSaveFilters(defaultFileName));
  if (!destination) {
    return { canceled: true };
  }
  await writeFile(destination, buffer);
  return { canceled: false, path: destination };
}
