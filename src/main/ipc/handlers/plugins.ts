import { BrowserWindow, dialog } from 'electron';
import type { PluginManager } from '#/main/plugins/PluginManager';
import { rebuildAppMenu } from '#/main/appMenu';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { setPluginMenuContributions } from '#/main/plugins/pluginMenuContributions';
import {
  activatePluginMain,
  deactivatePluginMain,
  invokePluginIpc,
  runPluginAfterSendHooks,
  runPluginBeforeSendHooks
} from '#/main/plugins/pluginRunnerHost';
import type { PluginHttpRequest, PluginHttpResponse } from '#/shared/plugin/types';
import type { SendRequestInput, HttpMethod } from '#/shared/types';

let manager: PluginManager | null = null;

/**
 * Returns the active plugin manager instance.
 */
export function getPluginManager(): PluginManager {
  if (!manager) {
    throw new Error('Plugin manager is not initialized.');
  }
  return manager;
}

/**
 * Stores the plugin manager used by IPC handlers.
 *
 * @param pluginManager - Initialized plugin manager.
 */
export function setPluginManager(pluginManager: PluginManager): void {
  manager = pluginManager;
}

/**
 * Converts a send request input into the plugin hook request shape.
 *
 * @param req - Renderer HTTP request payload.
 */
export function toPluginHttpRequest(req: SendRequestInput): PluginHttpRequest {
  const headers: Record<string, string> = {};
  for (const header of req.headers) {
    if (header.enabled && header.key) {
      headers[header.key] = header.value;
    }
  }
  return {
    method: req.method,
    url: req.url,
    headers,
    body: req.body ?? ''
  };
}

/**
 * Registers IPC handlers for plugin management and main-runtime bridging.
 *
 * @param pluginManager - Initialized plugin manager.
 */
export function registerPluginHandlers(pluginManager: PluginManager): void {
  setPluginManager(pluginManager);

  handle('plugins:list', ipcArgSchemas.none, () => pluginManager.list());

  handle('plugins:install', ipcArgSchemas.none, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Install plugin',
      properties: ['openFile'],
      filters: [{ name: 'HarborClient plugin', extensions: ['hcp', 'zip'] }]
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    return pluginManager.installFromFile(filePaths[0]);
  });

  handle('plugins:installFromPath', ipcArgSchemas.pluginInstallFromPath, (_event, path) =>
    pluginManager.installFromFile(path)
  );

  handle('plugins:uninstall', ipcArgSchemas.pluginId, (_event, pluginId) => {
    pluginManager.uninstall(pluginId);
  });

  handle('plugins:setEnabled', ipcArgSchemas.pluginSetEnabled, (_event, pluginId, enabled) =>
    pluginManager.setEnabled(pluginId, enabled)
  );

  handle('plugins:loadUnpacked', ipcArgSchemas.none, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Load unpacked plugin',
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    return pluginManager.loadUnpacked(filePaths[0]);
  });

  handle('plugins:loadUnpackedFromPath', ipcArgSchemas.pluginLoadUnpackedFromPath, (_event, path) =>
    pluginManager.loadUnpacked(path)
  );

  handle('plugins:reload', ipcArgSchemas.pluginId, (_event, pluginId) =>
    pluginManager.reload(pluginId)
  );

  handle('plugins:removeUnpacked', ipcArgSchemas.pluginId, (_event, pluginId) => {
    pluginManager.removeUnpacked(pluginId);
  });

  handle('plugins:readEntry', ipcArgSchemas.pluginReadEntry, (_event, pluginId, kind) =>
    pluginManager.readEntrySource(pluginId, kind)
  );

  handle('plugins:readAsset', ipcArgSchemas.pluginReadAsset, (_event, pluginId, assetPath) =>
    pluginManager.readAsset(pluginId, assetPath)
  );

  handle('plugins:storageGet', ipcArgSchemas.pluginStorageKey, (_event, pluginId, key) =>
    pluginManager.getStorageValue(pluginId, key)
  );

  handle('plugins:storageSet', ipcArgSchemas.pluginStorageSet, (_event, pluginId, key, value) => {
    pluginManager.setStorageValue(pluginId, key, value);
  });

  handle(
    'plugins:activateMain',
    ipcArgSchemas.pluginActivateMain,
    async (_event, pluginId, source, permissions) => {
      await activatePluginMain(pluginId, source, permissions);
    }
  );

  handle('plugins:deactivateMain', ipcArgSchemas.pluginId, async (_event, pluginId) => {
    await deactivatePluginMain(pluginId);
  });

  handle(
    'plugins:invokeMain',
    ipcArgSchemas.pluginInvokeMain,
    async (_event, pluginId, channel, args) => invokePluginIpc(pluginId, channel, args)
  );

  handle('plugins:setMenuContributions', ipcArgSchemas.pluginMenuContributions, (_event, items) => {
    setPluginMenuContributions(items);
    rebuildAppMenu();
  });

  handle(
    'plugins:fsPickFile',
    ipcArgSchemas.pluginFsPickFile,
    async (_event, pluginId, options) => {
      pluginManager.assertPermission(pluginId, 'filesystem:pick');
      const win = BrowserWindow.getFocusedWindow();
      const dialogOptions = {
        title: options?.title ?? 'Select file',
        properties: [
          'openFile',
          ...(options?.multiple ? (['multiSelections'] as const) : [])
        ] as Array<'openFile' | 'multiSelections'>,
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
  );

  handle(
    'plugins:fsPickDirectory',
    ipcArgSchemas.pluginFsPickDirectory,
    async (_event, pluginId, defaultPath) => {
      pluginManager.assertPermission(pluginId, 'filesystem:pick');
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
  );

  handle(
    'plugins:fsSaveFile',
    ipcArgSchemas.pluginFsSaveFile,
    async (_event, pluginId, content, options) => {
      pluginManager.assertPermission(pluginId, 'filesystem:pick');
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
  );

  handle('plugins:fsReadFile', ipcArgSchemas.pluginFsReadFile, (_event, pluginId, path) => {
    pluginManager.assertPermission(pluginId, 'filesystem:read');
    return pluginManager.fsAllowlist.readTextFile(pluginId, path);
  });

  handle(
    'plugins:fsWriteFile',
    ipcArgSchemas.pluginFsWriteFile,
    (_event, pluginId, path, content) => {
      pluginManager.assertPermission(pluginId, 'filesystem:write');
      pluginManager.fsAllowlist.writeTextFile(pluginId, path, content);
    }
  );
}

/**
 * Runs plugin before-send hooks against a request payload.
 *
 * @param req - Outgoing HTTP request from the renderer.
 * @returns Possibly mutated request payload.
 */
export async function applyPluginBeforeSendHooks(req: SendRequestInput): Promise<SendRequestInput> {
  const pluginRequest = toPluginHttpRequest(req);
  const mutated = await runPluginBeforeSendHooks(pluginRequest);
  const headers = req.headers.map((header) => ({ ...header }));
  for (const [key, value] of Object.entries(mutated.headers)) {
    const existing = headers.find((header) => header.key.toLowerCase() === key.toLowerCase());
    if (existing) {
      existing.value = value;
      existing.enabled = true;
    } else {
      headers.push({ key, value, enabled: true });
    }
  }
  return {
    ...req,
    method: mutated.method as HttpMethod,
    url: mutated.url,
    headers,
    body: mutated.body
  };
}

/**
 * Runs plugin after-send hooks for a completed HTTP exchange.
 *
 * @param req - Request that was sent.
 * @param response - Response payload returned to the renderer.
 */
export async function applyPluginAfterSendHooks(
  req: SendRequestInput,
  response: PluginHttpResponse
): Promise<void> {
  await runPluginAfterSendHooks(toPluginHttpRequest(req), response);
}
