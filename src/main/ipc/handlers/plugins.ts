import { BrowserWindow, dialog } from 'electron';
import type { PluginManager } from '#/main/plugins/PluginManager';
import { fetchPluginCatalog } from '#/main/plugins/pluginCatalog';
import { rebuildAppMenu } from '#/main/appMenu';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { setPluginMenuContributions } from '#/main/plugins/pluginMenuContributions';
import {
  activatePluginMain,
  deactivatePluginMain,
  invokePluginIpc,
  isPluginRunnerShuttingDown,
  PluginRunnerUnavailableError,
  runPluginAfterSendHooks,
  runPluginBeforeSendHooks
} from '#/main/plugins/pluginRunnerHost';
import type { PluginHttpResponse } from '#/shared/plugin/types';
import { toPluginHttpRequest } from '#/shared/plugin/httpRequest';
import { parseHttpMethod } from '#/shared/httpMethod';
import type { KeyValue, SendRequestInput } from '#/shared/types';

let manager: PluginManager | null = null;

/**
 * Runs a plugin runner call and returns undefined when the runner is unavailable
 * during shutdown so Electron does not log spurious IPC handler errors.
 *
 * @param operation - Plugin runner work to execute.
 */
async function withPluginRunner<T>(operation: () => Promise<T>): Promise<T | undefined> {
  if (isPluginRunnerShuttingDown()) {
    return undefined;
  }
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PluginRunnerUnavailableError) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Parses a plugin id from a hook failure thrown by the SES plugin runner.
 *
 * @param error - Hook failure from the utilityProcess runner.
 * @returns Plugin manifest id when the error message matches the runner format.
 */
export function parsePluginHookErrorId(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = /^Plugin ([^:]+): /.exec(message);
  return match?.[1];
}

/**
 * Records a plugin HTTP hook failure for display in Settings.
 *
 * @param error - Hook failure from the utilityProcess runner.
 */
export function recordPluginHookFailure(error: unknown): void {
  const pluginId = parsePluginHookErrorId(error);
  if (!pluginId || !manager) {
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  manager.setRuntimeError(pluginId, message);
}

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
 * Converts a renderer send payload into the plugin hook request shape.
 *
 * @param req - Renderer HTTP request payload.
 * @returns Serializable request snapshot for plugin HTTP hooks.
 */
export { toPluginHttpRequest } from '#/shared/plugin/httpRequest';

/**
 * Looks up a header value in a plugin hook result by case-insensitive key.
 *
 * @param mutated - Header map returned from before-send hooks.
 * @param key - Header name to resolve.
 * @returns Matching entry with the plugin's key casing, or undefined when absent.
 */
function lookupMutatedHeader(
  mutated: Record<string, string>,
  key: string
): { key: string; value: string } | undefined {
  const lower = key.toLowerCase();
  for (const [mutatedKey, value] of Object.entries(mutated)) {
    if (mutatedKey.toLowerCase() === lower) {
      return { key: mutatedKey, value };
    }
  }
  return undefined;
}

/**
 * Applies plugin before-send header mutations back onto editable header rows.
 *
 * Enabled rows visible to hooks are updated or disabled when removed; new keys
 * from the hook result are appended as enabled rows.
 *
 * @param original - Request headers from the renderer.
 * @param mutated - Header map after plugin before-send hooks ran.
 * @returns Header rows ready for outbound request building.
 */
export function mergePluginHttpHeaders(
  original: KeyValue[],
  mutated: Record<string, string>
): KeyValue[] {
  const headers = original.map((header) => ({ ...header }));
  const matchedLower = new Set<string>();

  for (const header of headers) {
    if (!header.enabled || !header.key.trim()) {
      continue;
    }
    const hit = lookupMutatedHeader(mutated, header.key);
    if (hit) {
      header.value = hit.value;
      header.enabled = true;
      matchedLower.add(hit.key.toLowerCase());
    } else {
      header.enabled = false;
    }
  }

  for (const [key, value] of Object.entries(mutated)) {
    if (!matchedLower.has(key.toLowerCase())) {
      headers.push({ key, value, enabled: true });
    }
  }

  return headers;
}

/**
 * Registers IPC handlers for plugin management and main-runtime bridging.
 *
 * @param pluginManager - Initialized plugin manager.
 */
export function registerPluginHandlers(pluginManager: PluginManager): void {
  setPluginManager(pluginManager);

  handle('plugins:list', ipcArgSchemas.none, () => pluginManager.list());

  handle('plugins:catalog', ipcArgSchemas.none, () => fetchPluginCatalog());

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

  handle('plugins:installFromGit', ipcArgSchemas.pluginInstallFromGit, (_event, url, ref) =>
    pluginManager.installFromGit(url, ref)
  );

  handle('plugins:updateFromGit', ipcArgSchemas.pluginId, (_event, pluginId) =>
    pluginManager.updateFromGit(pluginId)
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

  handle('plugins:activateMain', ipcArgSchemas.pluginActivateMain, async (_event, pluginId) => {
    await withPluginRunner(async () => {
      const { source, permissions } = pluginManager.resolveMainActivation(pluginId);
      await activatePluginMain(pluginId, source, permissions);
    });
  });

  handle('plugins:deactivateMain', ipcArgSchemas.pluginId, async (_event, pluginId) => {
    await withPluginRunner(() => deactivatePluginMain(pluginId));
  });

  handle(
    'plugins:reportRuntimeError',
    ipcArgSchemas.pluginReportRuntimeError,
    (_event, pluginId, message) => pluginManager.setRuntimeError(pluginId, message)
  );

  handle(
    'plugins:invokeMain',
    ipcArgSchemas.pluginInvokeMain,
    async (_event, pluginId, channel, args) =>
      withPluginRunner(() => invokePluginIpc(pluginId, channel, args))
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
  try {
    const pluginRequest = toPluginHttpRequest(req);
    const mutated = await runPluginBeforeSendHooks(pluginRequest);
    return {
      ...req,
      method: parseHttpMethod(mutated.method) ?? req.method,
      url: mutated.url,
      headers: mergePluginHttpHeaders(req.headers, mutated.headers),
      body: mutated.body
    };
  } catch (error) {
    recordPluginHookFailure(error);
    console.error('Plugin before-send hook failed:', error);
    return req;
  }
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
  try {
    await runPluginAfterSendHooks(toPluginHttpRequest(req), response);
  } catch (error) {
    recordPluginHookFailure(error);
    console.error('Plugin after-send hook failed:', error);
  }
}
