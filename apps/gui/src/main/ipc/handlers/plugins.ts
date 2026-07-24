import { dialog } from 'electron';
import type { PluginManager } from '#/main/plugins/PluginManager';
import {
  pickDirectoryForPlugin,
  pickFileForPlugin,
  readFileForPlugin,
  saveFileForPlugin,
  watchFileForPlugin,
  writeFileForPlugin
} from '#/main/plugins/pluginFsOperations';
import { fetchPluginCatalog } from '#/main/plugins/pluginCatalog';
import { fetchThemeCatalog } from '#/main/plugins/themeCatalog';
import { fetchPluginPreviewFromGit } from '#/main/plugins/gitPluginPreview';
import { clearTrustedKeysCache } from '#/main/plugins/pluginSignature';
import { getPluginSources, setPluginSources } from '#/main/settings/pluginSourcesSettings';
import { refreshTeamHubPluginSources } from '#/main/settings/teamHubPluginSources';
import { rebuildAppMenu } from '#/main/appMenu';
import { logVerbose } from '#/main/logger';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { setPluginMenuContributions } from '#/main/plugins/pluginMenuContributions';
import { getPluginUiBroker } from '#/main/plugins/PluginUiBroker';
import { PluginDatabaseManager } from '#/main/plugins/PluginDatabaseManager';
import {
  setPluginDatabaseManager,
  getPluginDatabaseManager
} from '#/main/plugins/pluginDatabaseManagerInstance';
import {
  activatePluginMain,
  deactivatePluginMain,
  invokePluginIpc,
  isPluginRunnerShuttingDown,
  PluginRunnerUnavailableError,
  runPluginAfterSendHooks,
  runPluginBeforeSendHooks,
  setPluginDatabaseAccess,
  setPluginStorageAccess
} from '#/main/plugins/pluginRunnerHost';
import type { PluginHttpResponse, PluginInfo } from '#/shared/plugin/types';
import { toPluginHttpRequest } from '#/shared/plugin/httpRequest';
import { parseHttpMethod } from '#/shared/httpMethod';
import type { KeyValue, SendRequestInput } from '#/shared/types';

let manager: PluginManager | null = null;
let databaseManager: PluginDatabaseManager | null = null;

/**
 * Ensures a plugin exists and has database permission before running SQL.
 *
 * @param pluginManager - Initialized plugin manager.
 * @param pluginId - Plugin manifest id.
 */
function assertPluginDatabaseAccess(pluginManager: PluginManager, pluginId: string): void {
  if (!pluginManager.get(pluginId)) {
    throw new Error(`Unknown plugin: ${pluginId}`);
  }
  pluginManager.assertPermission(pluginId, 'database');
}

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
 * Writes a plugin activation failure to the main process terminal.
 *
 * @param plugin - Plugin metadata when available from the manager.
 * @param settingsMessage - Normalized message persisted for Settings.
 * @param details - Full activation error details from the renderer host.
 */
export function logPluginActivationFailureToTerminal(
  plugin: PluginInfo | undefined,
  settingsMessage: string,
  details: string
): void {
  const pluginId = plugin?.id ?? 'unknown';
  const pluginName = plugin?.name;
  const entryParts: string[] = [];
  if (plugin?.manifest.renderer) {
    entryParts.push(`renderer=${plugin.manifest.renderer}`);
  }
  if (plugin?.manifest.main) {
    entryParts.push(`main=${plugin.manifest.main}`);
  }
  const entryContext = entryParts.length > 0 ? `; entries: ${entryParts.join(', ')}` : '';

  console.error(
    `[HarborClient] Plugin activation failed (${pluginId}${pluginName ? `: ${pluginName}` : ''}${entryContext})`,
    details,
    `(Settings runtime error: ${settingsMessage})`
  );
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
  databaseManager = new PluginDatabaseManager(pluginManager.getUserDataPath());
  setPluginDatabaseManager(databaseManager);
  pluginManager.setDatabaseManager(databaseManager);
  setPluginStorageAccess({
    get: (pluginId, key) => pluginManager.getStorageValue(pluginId, key),
    set: (pluginId, key, value) => pluginManager.setStorageValue(pluginId, key, value)
  });
  setPluginDatabaseAccess({
    get: (pluginId, sql, params, txnId) => databaseManager!.get(pluginId, sql, params, txnId),
    all: (pluginId, sql, params, txnId) => databaseManager!.all(pluginId, sql, params, txnId),
    run: (pluginId, sql, params, txnId) => databaseManager!.run(pluginId, sql, params, txnId),
    exec: (pluginId, sql) => databaseManager!.exec(pluginId, sql),
    beginTransaction: (pluginId) => databaseManager!.beginTransaction(pluginId),
    endTransaction: (pluginId, txnId, action) =>
      databaseManager!.endTransaction(pluginId, txnId, action)
  });

  handle('plugins:list', ipcArgSchemas.none, () => {
    const plugins = pluginManager.list();
    logVerbose('plugins:list', {
      total: plugins.length,
      enabled: plugins.filter((plugin) => plugin.enabled).map((plugin) => plugin.id)
    });
    return plugins;
  });

  handle('plugins:catalog', ipcArgSchemas.none, () => fetchPluginCatalog());

  handle('plugins:themeCatalog', ipcArgSchemas.none, () => fetchThemeCatalog());

  handle('plugins:getSources', ipcArgSchemas.none, () => getPluginSources());

  handle('plugins:setSources', ipcArgSchemas.pluginSources, (_event, settings) => {
    const saved = setPluginSources(settings);
    clearTrustedKeysCache();
    return saved;
  });

  handle('plugins:getTeamHubSources', ipcArgSchemas.none, async () =>
    refreshTeamHubPluginSources()
  );

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

  handle('plugins:previewFromGit', ipcArgSchemas.pluginPreviewFromGit, (_event, url, ref) =>
    fetchPluginPreviewFromGit(url, ref)
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

  handle(
    'plugins:loadUnpackedFromPath',
    ipcArgSchemas.pluginLoadUnpackedFromPath,
    async (_event, path) => pluginManager.loadUnpacked(path)
  );

  handle('plugins:reload', ipcArgSchemas.pluginId, async (_event, pluginId) =>
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

  handle(
    'plugins:resolveThemeImport',
    ipcArgSchemas.pluginResolveThemeImport,
    (_event, pluginId, importPath) => pluginManager.resolveThemeImport(pluginId, importPath)
  );

  handle('plugins:storageGet', ipcArgSchemas.pluginStorageKey, (_event, pluginId, key) =>
    pluginManager.getStorageValue(pluginId, key)
  );

  handle('plugins:storageSet', ipcArgSchemas.pluginStorageSet, (_event, pluginId, key, value) => {
    pluginManager.setStorageValue(pluginId, key, value);
  });

  handle(
    'plugins:databaseQuery',
    ipcArgSchemas.pluginDbQuery,
    (_event, pluginId, mode, sql, params, txnId) => {
      assertPluginDatabaseAccess(pluginManager, pluginId);
      const db = getPluginDatabaseManager();
      if (mode === 'get') {
        return db.get(pluginId, sql, params ?? [], txnId);
      }
      if (mode === 'all') {
        return db.all(pluginId, sql, params ?? [], txnId);
      }
      return db.run(pluginId, sql, params ?? [], txnId);
    }
  );

  handle('plugins:databaseExec', ipcArgSchemas.pluginDbExec, (_event, pluginId, sql) => {
    assertPluginDatabaseAccess(pluginManager, pluginId);
    return getPluginDatabaseManager().exec(pluginId, sql);
  });

  handle('plugins:databaseTxBegin', ipcArgSchemas.pluginDbTxBegin, (_event, pluginId) => {
    assertPluginDatabaseAccess(pluginManager, pluginId);
    return getPluginDatabaseManager().beginTransaction(pluginId);
  });

  handle(
    'plugins:databaseTxEnd',
    ipcArgSchemas.pluginDbTxEnd,
    (_event, pluginId, txnId, action) => {
      assertPluginDatabaseAccess(pluginManager, pluginId);
      return getPluginDatabaseManager().endTransaction(pluginId, txnId, action);
    }
  );

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
    (_event, pluginId, message, logDetails) => {
      const info = pluginManager.setRuntimeError(pluginId, message);
      if (message && logDetails) {
        logPluginActivationFailureToTerminal(info, message, logDetails);
      }
      return info;
    }
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
      return pickFileForPlugin(pluginManager, pluginId, options);
    }
  );

  handle(
    'plugins:fsPickDirectory',
    ipcArgSchemas.pluginFsPickDirectory,
    async (_event, pluginId, defaultPath) => {
      pluginManager.assertPermission(pluginId, 'filesystem:pick');
      return pickDirectoryForPlugin(pluginManager, pluginId, defaultPath);
    }
  );

  handle(
    'plugins:fsSaveFile',
    ipcArgSchemas.pluginFsSaveFile,
    async (_event, pluginId, content, options) => {
      pluginManager.assertPermission(pluginId, 'filesystem:pick');
      return saveFileForPlugin(pluginManager, pluginId, content, options);
    }
  );

  handle('plugins:fsReadFile', ipcArgSchemas.pluginFsReadFile, (_event, pluginId, path) => {
    pluginManager.assertPermission(pluginId, 'filesystem:read');
    return readFileForPlugin(pluginManager, pluginId, path);
  });

  handle(
    'plugins:fsWriteFile',
    ipcArgSchemas.pluginFsWriteFile,
    (_event, pluginId, path, content) => {
      pluginManager.assertPermission(pluginId, 'filesystem:write');
      writeFileForPlugin(pluginManager, pluginId, path, content);
    }
  );

  handle('plugins:fsWatchFile', ipcArgSchemas.pluginFsWatchFile, (_event, pluginId, path) => {
    pluginManager.assertPermission(pluginId, 'filesystem:read');
    watchFileForPlugin(pluginManager, pluginId, path);
  });

  handle('plugins:fsUnwatchFile', ipcArgSchemas.pluginFsUnwatchFile, (_event, pluginId, path) => {
    pluginManager.unwatchFilesystemPath(pluginId, path);
  });

  handle('plugins:pushViewContext', ipcArgSchemas.pluginPushViewContext, (_event, payload) => {
    getPluginUiBroker().pushViewContext(
      payload.pluginId,
      payload.contributionId,
      payload.kind,
      payload.context
    );
  });

  handle('plugins:pushHttpAfterSend', ipcArgSchemas.pluginPushHttpAfterSend, (_event, payload) => {
    getPluginUiBroker().pushHttpAfterSend(payload.request, payload.response);
  });

  handle(
    'plugins:executeAgentCommand',
    ipcArgSchemas.pluginExecuteAgentCommand,
    (_event, pluginId, commandId, args) => {
      getPluginUiBroker().executeCommand(pluginId, commandId, args ?? []);
    }
  );

  handle(
    'plugins:invokeImportHandler',
    ipcArgSchemas.pluginInvokeImportHandler,
    (_event, pluginId, registrationId, phase, file) => {
      return getPluginUiBroker().invokeImportHandler(pluginId, registrationId, phase, file);
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
