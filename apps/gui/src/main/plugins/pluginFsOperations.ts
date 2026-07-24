import { BrowserWindow, dialog } from 'electron';
import type { PluginFsPickFileOptions, PluginFsSaveFileOptions } from '@harborclient/sdk';
import type { PluginManager } from './PluginManager';

/**
 * Opens a native file picker and grants the selected paths to one plugin.
 *
 * @param pluginManager - Plugin manager that owns the filesystem allowlist.
 * @param pluginId - Plugin manifest id.
 * @param options - Optional dialog title, filters, and multi-select flag.
 * @returns Selected absolute paths, or an empty array when the dialog is canceled.
 */
export async function pickFileForPlugin(
  pluginManager: PluginManager,
  pluginId: string,
  options?: PluginFsPickFileOptions
): Promise<string[]> {
  const win = BrowserWindow.getFocusedWindow();
  const dialogOptions = {
    title: options?.title ?? 'Select file',
    properties: ['openFile', ...(options?.multiple ? (['multiSelections'] as const) : [])] as Array<
      'openFile' | 'multiSelections'
    >,
    filters: options?.filters ?? [{ name: 'All Files', extensions: ['*'] }]
  };
  const { canceled, filePaths } = win
    ? await dialog.showOpenDialog(win, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  if (canceled || filePaths.length === 0) {
    return [];
  }
  for (const filePath of filePaths) {
    pluginManager.grantFilesystemPath(pluginId, filePath);
  }
  return filePaths;
}

/**
 * Opens a native directory picker and grants the selected path to one plugin.
 *
 * @param pluginManager - Plugin manager that owns the filesystem allowlist.
 * @param pluginId - Plugin manifest id.
 * @param defaultPath - Optional starting directory for the dialog.
 * @returns Selected absolute directory path, or null when canceled.
 */
export async function pickDirectoryForPlugin(
  pluginManager: PluginManager,
  pluginId: string,
  defaultPath = ''
): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow();
  const dialogOptions = {
    title: 'Select directory',
    properties: ['openDirectory'] as Array<'openDirectory'>,
    defaultPath: defaultPath.trim() || undefined
  };
  const { canceled, filePaths } = win
    ? await dialog.showOpenDialog(win, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  if (canceled || filePaths.length === 0) {
    return null;
  }
  pluginManager.grantFilesystemPath(pluginId, filePaths[0]);
  return filePaths[0];
}

/**
 * Opens a native save dialog, grants the path, and writes UTF-8 content for one plugin.
 *
 * @param pluginManager - Plugin manager that owns the filesystem allowlist.
 * @param pluginId - Plugin manifest id.
 * @param content - UTF-8 text to write after the user confirms the path.
 * @param options - Optional default path and file-type filters.
 * @returns Saved absolute path, or null when canceled.
 */
export async function saveFileForPlugin(
  pluginManager: PluginManager,
  pluginId: string,
  content: string,
  options?: PluginFsSaveFileOptions
): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow();
  const dialogOptions = {
    title: 'Save file',
    defaultPath: options?.defaultPath,
    filters: options?.filters ?? [
      { name: 'Text', extensions: ['txt', 'json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  };
  const { canceled, filePath } = win
    ? await dialog.showSaveDialog(win, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);
  if (canceled || !filePath) {
    return null;
  }
  pluginManager.grantFilesystemPath(pluginId, filePath);
  pluginManager.fsAllowlist.writeTextFile(pluginId, filePath, content);
  return filePath;
}

/**
 * Reads a UTF-8 file from one plugin's allowlisted paths.
 *
 * @param pluginManager - Plugin manager that owns the filesystem allowlist.
 * @param pluginId - Plugin manifest id.
 * @param path - Absolute allowlisted file path.
 * @returns File contents as UTF-8 text.
 */
export function readFileForPlugin(
  pluginManager: PluginManager,
  pluginId: string,
  path: string
): string {
  pluginManager.reconcileFilesystemGrants(pluginId);
  return pluginManager.fsAllowlist.readTextFile(pluginId, path);
}

/**
 * Writes UTF-8 content to one plugin's allowlisted path.
 *
 * @param pluginManager - Plugin manager that owns the filesystem allowlist.
 * @param pluginId - Plugin manifest id.
 * @param path - Absolute allowlisted file path.
 * @param content - UTF-8 text to write.
 */
export function writeFileForPlugin(
  pluginManager: PluginManager,
  pluginId: string,
  path: string,
  content: string
): void {
  pluginManager.reconcileFilesystemGrants(pluginId);
  pluginManager.fsAllowlist.writeTextFile(pluginId, path, content);
}

/**
 * Starts watching one allowlisted file path for a plugin.
 *
 * @param pluginManager - Plugin manager that owns filesystem watchers.
 * @param pluginId - Plugin manifest id.
 * @param path - Absolute allowlisted file path.
 */
export function watchFileForPlugin(
  pluginManager: PluginManager,
  pluginId: string,
  path: string
): void {
  pluginManager.watchFilesystemPath(pluginId, path);
}
