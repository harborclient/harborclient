import { ipcMain, webContents, type WebContents } from 'electron';
import type { BrowserWindow } from 'electron';
import type { PluginHttpRequest, PluginHttpResponse } from '@harborclient/sdk';
import type { PluginFsPickFileOptions, PluginFsSaveFileOptions } from '@harborclient/sdk';
import type { PluginManager } from './PluginManager';
import { getPluginDatabaseManager } from './pluginDatabaseManagerInstance';
import { activatePluginMain, invokePluginIpc } from './pluginRunnerHost';
import {
  pickDirectoryForPlugin,
  pickFileForPlugin,
  readFileForPlugin,
  saveFileForPlugin,
  watchFileForPlugin,
  writeFileForPlugin
} from './pluginFsOperations';
import type { PluginPermission } from '#/shared/plugin/types';
import { toActiveTheme } from '#/shared/plugin/types';
import type { ThemeSource } from '#/shared/types';
import { isPluginNetworkAllowed } from '#/main/settings/generalSettings';
import { logImportVerbose } from '#/main/import/importVerboseLog';
import { refreshMcpClientConnections } from '#/main/mcp/mcpClientManager';
import {
  clearPluginMcpServers,
  registerPluginMcpServer,
  setPluginMcpRegistryManager,
  unregisterPluginMcpServer
} from './pluginMcpRegistry';

/** Permission required for each broker operation. */
const OP_PERMISSIONS: Record<string, PluginPermission | 'ui'> = {
  'storage.get': 'storage',
  'storage.set': 'storage',
  'database.query': 'database',
  'database.exec': 'database',
  'database.beginTransaction': 'database',
  'database.endTransaction': 'database',
  'fs.pickFile': 'filesystem:pick',
  'fs.pickDirectory': 'filesystem:pick',
  'fs.saveFile': 'filesystem:pick',
  'fs.readFile': 'filesystem:read',
  'fs.writeFile': 'filesystem:write',
  'fs.watchFile': 'filesystem:read',
  'ipc.invoke': 'ipc',
  'themes.register': 'ui',
  'themes.unregister': 'ui',
  'themes.getActive': 'ui',
  'registerContribution': 'ui',
  'unregisterContribution': 'ui',
  'ui.showToast': 'ui',
  'ui.setFooterPanelIndicator': 'ui',
  'commands.execute': 'ui',
  'commands.executeRemote': 'ui',
  'host.openRequestDraft': 'ui',
  'host.applyRequestDraft': 'ui',
  'host.loadRequest': 'ui',
  'host.sendRequest': 'ui',
  'host.createEnvironmentWithVariables': 'ui',
  'host.updateEnvironmentVariables': 'ui',
  'host.createCollection': 'ui',
  'host.listCollectionRequests': 'ui',
  'host.getCollectionMetadata': 'ui',
  'host.logRequestToConsole': 'ui',
  'host.sendHttpRequest': 'network',
  'host.clearResponse': 'ui',
  'view.getContext': 'ui',
  'view.reportSize': 'ui',
  'ui.openModal': 'ui',
  'ui.closeModal': 'ui',
  'imports.registerHandler': 'ui',
  'imports.unregisterHandler': 'ui',
  'imports.invokeComplete': 'ui',
  'mcp.registerServer': 'mcp',
  'mcp.unregisterServer': 'mcp'
};

/** Host bridge operations that must round-trip a result to the plugin webview. */
const HOST_BRIDGE_RETURN_OPS = new Set([
  'host.sendHttpRequest',
  'host.createEnvironmentWithVariables',
  'host.createCollection',
  'host.listCollectionRequests',
  'host.getCollectionMetadata',
  'commands.execute'
]);

/** Maximum wait for the host renderer to complete a return-value host bridge call. */
const HOST_BRIDGE_INVOKE_TIMEOUT_MS = 60_000;

/** Maximum wait for an agent webview to complete an import handler invocation. */
const AGENT_IMPORT_INVOKE_TIMEOUT_MS = 60_000;

interface PendingHostBridgeInvoke {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface HostBridgeCompleteMessage {
  requestId: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface AgentImportInvokeCompleteMessage {
  requestId: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface PendingAgentImportInvoke {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/** Serializable import file forwarded from File → Import. */
export interface BrokerImportFile {
  name: string;
  path: string;
  extension: string;
  contents: string;
}

interface PluginWebviewSession {
  pluginId: string;
  role: 'agent' | 'view';
  contributionId?: string;
  kind?: string;
  slot?: string;
}

/**
 * Routes permission-checked plugin UI bridge calls between isolated webviews,
 * the host renderer, and existing plugin infrastructure.
 */
export class PluginUiBroker {
  readonly #pluginManager: PluginManager;
  readonly #sessions = new Map<number, PluginWebviewSession>();
  readonly #agentReady = new Set<string>();
  /**
   * Last context snapshot per `${pluginId}::${contributionId}::${kind}`, so a
   * surface webview can pull the current context after it subscribes (the push
   * on mount/dom-ready can race ahead of the guest's subscription).
   */
  readonly #viewContextCache = new Map<string, unknown>();
  readonly #pendingHostBridge = new Map<number, PendingHostBridgeInvoke>();
  readonly #pendingAgentImportInvoke = new Map<number, PendingAgentImportInvoke>();
  #nextHostBridgeRequestId = 1;
  #nextAgentImportRequestId = 1;
  #mainWindow: (() => BrowserWindow | null) | null = null;
  #getTheme: (() => Promise<ThemeSource>) | null = null;

  /**
   * @param pluginManager - Plugin manager for permissions and storage.
   */
  constructor(pluginManager: PluginManager) {
    this.#pluginManager = pluginManager;
  }

  /**
   * Supplies the main application window used to forward host commands.
   *
   * @param getter - Returns the current main window or null when destroyed.
   */
  setMainWindow(getter: () => BrowserWindow | null): void {
    this.#mainWindow = getter;
  }

  /**
   * Supplies a callback that reads the persisted active theme.
   *
   * @param getter - Returns the current theme preference.
   */
  setThemeGetter(getter: () => Promise<ThemeSource>): void {
    this.#getTheme = getter;
  }

  /**
   * Registers IPC handlers for plugin webview bridge invocations.
   */
  registerIpcHandlers(): void {
    ipcMain.handle(
      'plugins:uiBridge',
      async (event, message: { op: string; payload?: unknown }) => {
        return this.handleInvoke(event.sender, message.op, message.payload);
      }
    );

    ipcMain.on('plugins:uiRegisterSession', (event, session: PluginWebviewSession) => {
      this.#sessions.set(event.sender.id, session);
    });

    ipcMain.on('plugins:hostBridgeComplete', (_event, message: HostBridgeCompleteMessage) => {
      this.#completeHostBridgeInvoke(message);
    });
  }

  /**
   * Marks an agent webview as ready after successful activation.
   *
   * @param pluginId - Plugin manifest id.
   */
  markAgentReady(pluginId: string): void {
    this.#agentReady.add(pluginId);
    const window = this.#mainWindow?.();
    if (window && !window.isDestroyed()) {
      window.webContents.send('plugins:agentReady', { pluginId });
    }
  }

  /**
   * Notifies the host renderer when an agent webview fails during bootstrap.
   *
   * @param pluginId - Plugin manifest id.
   * @param message - Activation failure message.
   */
  markAgentFailed(pluginId: string, message: string): void {
    const window = this.#mainWindow?.();
    if (window && !window.isDestroyed()) {
      window.webContents.send('plugins:agentFailed', { pluginId, message });
    }
  }

  /**
   * Returns whether the agent webview for a plugin has finished activation.
   *
   * @param pluginId - Plugin manifest id.
   */
  isAgentReady(pluginId: string): boolean {
    return this.#agentReady.has(pluginId);
  }

  /**
   * Clears broker state when a plugin webview is destroyed.
   *
   * @param webContentsId - Destroyed webContents id.
   */
  clearSession(webContentsId: number): void {
    const session = this.#sessions.get(webContentsId);
    if (session?.role === 'agent') {
      clearPluginMcpServers(session.pluginId);
      void refreshMcpClientConnections();
    }
    this.#sessions.delete(webContentsId);
  }

  /**
   * Clears agent readiness when a plugin is unloaded.
   *
   * @param pluginId - Plugin manifest id.
   */
  clearPlugin(pluginId: string): void {
    this.#agentReady.delete(pluginId);
    clearPluginMcpServers(pluginId);
    void refreshMcpClientConnections();
  }

  /**
   * Pushes serialized tab/view context to matching plugin surface webviews.
   *
   * @param pluginId - Plugin manifest id.
   * @param contributionId - Manifest contribution id.
   * @param kind - Contribution bucket key.
   * @param context - Serializable context snapshot.
   */
  pushViewContext(pluginId: string, contributionId: string, kind: string, context: unknown): void {
    this.#viewContextCache.set(`${pluginId}::${contributionId}::${kind}`, context);
    for (const [webContentsId, session] of this.#sessions.entries()) {
      if (
        session.role === 'view' &&
        session.pluginId === pluginId &&
        session.contributionId === contributionId &&
        session.kind === kind
      ) {
        this.#getWebContentsById(webContentsId)?.send('plugin-ui:event', {
          channel: 'view.context',
          payload: context
        });
      }
    }
  }

  /**
   * Pushes theme updates to every active plugin webview for one plugin.
   *
   * @param pluginId - Plugin manifest id.
   * @param theme - Theme payload for isolated surfaces.
   */
  pushTheme(pluginId: string, theme: { dataTheme: string | null; cssText: string }): void {
    for (const [webContentsId, session] of this.#sessions.entries()) {
      if (session.pluginId !== pluginId) {
        continue;
      }
      this.#getWebContentsById(webContentsId)?.send('plugin-ui:event', {
        channel: 'themes.changed',
        payload: toActiveTheme((theme.dataTheme ?? 'system') as ThemeSource)
      });
      this.#getWebContentsById(webContentsId)?.send('plugin-ui:event', {
        channel: 'theme.styles',
        payload: theme
      });
    }
  }

  /**
   * Pushes a completed HTTP exchange to every plugin webview that declares the
   * `http` permission so renderer-side `hc.http.onAfterSend` handlers can run.
   *
   * @param request - Serializable request snapshot from the host send pipeline.
   * @param response - Serializable response snapshot from the host send pipeline.
   */
  pushHttpAfterSend(request: PluginHttpRequest, response: PluginHttpResponse): void {
    for (const [webContentsId, session] of this.#iterSessions()) {
      if (!this.#sessionHasHttpPermission(webContentsId, session)) {
        continue;
      }
      this.#getWebContentsById(webContentsId)?.send('plugin-ui:event', {
        channel: 'http.afterSend',
        payload: { request, response }
      });
    }
  }

  /**
   * Forwards a command execution request to a plugin agent webview.
   *
   * @param pluginId - Target plugin manifest id.
   * @param commandId - Command id declared in the manifest.
   * @param args - Command handler arguments.
   */
  executeCommand(pluginId: string, commandId: string, args: unknown[]): void {
    for (const [webContentsId, session] of this.#sessions.entries()) {
      if (session.role === 'agent' && session.pluginId === pluginId) {
        this.#getWebContentsById(webContentsId)?.send('plugin-ui:event', {
          channel: 'commands.execute',
          payload: { commandId, args }
        });
        return;
      }
    }
    throw new Error(`Plugin agent is not active: ${pluginId}`);
  }

  /**
   * Invokes one registered import handler phase in a plugin agent webview.
   *
   * @param pluginId - Target plugin manifest id.
   * @param registrationId - Handler registration id from the agent webview.
   * @param phase - Import detection or execution phase.
   * @param file - Selected import file from File → Import.
   * @returns `canImport` boolean result or undefined after a successful import.
   */
  invokeImportHandler(
    pluginId: string,
    registrationId: string,
    phase: 'canImport' | 'import',
    file: BrokerImportFile
  ): Promise<unknown> {
    for (const [webContentsId, session] of this.#sessions.entries()) {
      if (session.role !== 'agent' || session.pluginId !== pluginId) {
        continue;
      }
      const target = this.#getWebContentsById(webContentsId);
      if (!target) {
        continue;
      }

      const requestId = this.#nextAgentImportRequestId++;
      logImportVerbose('broker invokeImportHandler', {
        pluginId,
        registrationId,
        phase,
        requestId,
        fileName: file.name,
        extension: file.extension
      });
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.#pendingAgentImportInvoke.delete(requestId);
          logImportVerbose('broker invokeImportHandler timeout', {
            pluginId,
            registrationId,
            phase,
            requestId
          });
          reject(new Error(`Plugin import handler invocation timed out: ${phase}`));
        }, AGENT_IMPORT_INVOKE_TIMEOUT_MS);

        this.#pendingAgentImportInvoke.set(requestId, { resolve, reject, timeout });
        target.send('plugin-ui:event', {
          channel: 'imports.invoke',
          payload: { requestId, registrationId, phase, file }
        });
      });
    }

    throw new Error(`Plugin agent is not active: ${pluginId}`);
  }

  /**
   * Pushes a filesystem change event to plugin webviews watching one path.
   *
   * @param pluginId - Plugin manifest id.
   * @param normalizedPath - Normalized absolute path that changed.
   */
  notifyFilesystemChanged(pluginId: string, normalizedPath: string): void {
    for (const [webContentsId, session] of this.#sessions.entries()) {
      if (session.pluginId !== pluginId) {
        continue;
      }
      this.#getWebContentsById(webContentsId)?.send('plugin-ui:event', {
        channel: `fs.watch:${normalizedPath}`,
        payload: normalizedPath
      });
    }
  }

  /**
   * Dispatches one bridge operation for a plugin webview.
   *
   * @param sender - Calling webContents.
   * @param op - Operation name.
   * @param payload - Serializable payload.
   */
  async handleInvoke(sender: WebContents, op: string, payload: unknown): Promise<unknown> {
    const session = this.#sessions.get(sender.id);
    if (!session) {
      throw new Error('Unknown plugin webview session.');
    }

    this.#assertOpPermission(session.pluginId, op);

    if (HOST_BRIDGE_RETURN_OPS.has(op)) {
      return this.#invokeHostBridge(session.pluginId, op, payload);
    }

    switch (op) {
      case 'storage.get': {
        const { key } = payload as { key: string };
        return this.#pluginManager.getStorageValue(session.pluginId, key);
      }
      case 'storage.set': {
        const { key, value } = payload as { key: string; value: unknown };
        await this.#pluginManager.setStorageValue(session.pluginId, key, value);
        return undefined;
      }
      case 'database.query': {
        const { mode, sql, params, txnId } = payload as {
          mode: 'get' | 'all' | 'run';
          sql: string;
          params?: unknown[];
          txnId?: string;
        };
        const db = getPluginDatabaseManager();
        if (mode === 'get') {
          return db.get(session.pluginId, sql, params, txnId);
        }
        if (mode === 'all') {
          return db.all(session.pluginId, sql, params, txnId);
        }
        return db.run(session.pluginId, sql, params, txnId);
      }
      case 'database.exec': {
        const { sql } = payload as { sql: string };
        return getPluginDatabaseManager().exec(session.pluginId, sql);
      }
      case 'database.beginTransaction': {
        return getPluginDatabaseManager().beginTransaction(session.pluginId);
      }
      case 'database.endTransaction': {
        const { txnId, action } = payload as { txnId: string; action: 'commit' | 'rollback' };
        return getPluginDatabaseManager().endTransaction(session.pluginId, txnId, action);
      }
      case 'fs.pickFile': {
        const { options } = payload as { options?: PluginFsPickFileOptions };
        return pickFileForPlugin(this.#pluginManager, session.pluginId, options);
      }
      case 'fs.pickDirectory': {
        const { defaultPath } = payload as { defaultPath?: string };
        return pickDirectoryForPlugin(this.#pluginManager, session.pluginId, defaultPath ?? '');
      }
      case 'fs.saveFile': {
        const { content, options } = payload as {
          content: string;
          options?: PluginFsSaveFileOptions;
        };
        return saveFileForPlugin(this.#pluginManager, session.pluginId, content, options);
      }
      case 'fs.readFile': {
        const { path } = payload as { path: string };
        return readFileForPlugin(this.#pluginManager, session.pluginId, path);
      }
      case 'fs.writeFile': {
        const { path, content } = payload as { path: string; content: string };
        writeFileForPlugin(this.#pluginManager, session.pluginId, path, content);
        return undefined;
      }
      case 'fs.watchFile': {
        const { path } = payload as { path: string };
        watchFileForPlugin(this.#pluginManager, session.pluginId, path);
        return undefined;
      }
      case 'ipc.invoke': {
        const { channel, args } = payload as { channel: string; args: unknown[] };
        try {
          return await invokePluginIpc(session.pluginId, channel, args ?? []);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.includes('Plugin main runtime is not active')) {
            throw error;
          }
          const { source, permissions } = this.#pluginManager.resolveMainActivation(
            session.pluginId
          );
          await activatePluginMain(session.pluginId, source, permissions);
          return invokePluginIpc(session.pluginId, channel, args ?? []);
        }
      }
      case 'themes.getActive': {
        const theme = this.#getTheme ? await this.#getTheme() : 'system';
        return toActiveTheme(theme);
      }
      case 'view.getContext': {
        const key = `${session.pluginId}::${session.contributionId}::${session.kind}`;
        return this.#viewContextCache.has(key) ? this.#viewContextCache.get(key) : null;
      }
      case 'view.reportSize': {
        const {
          height,
          width,
          slot: reportSlot
        } = payload as {
          height?: unknown;
          width?: unknown;
          slot?: unknown;
        };
        const slot =
          typeof reportSlot === 'string' && reportSlot.length > 0
            ? reportSlot
            : (session.slot ?? 'content');
        const resizeMessage: Record<string, unknown> = {
          pluginId: session.pluginId,
          contributionId: session.contributionId,
          kind: session.kind,
          slot
        };
        let hasSize = false;
        if (typeof height === 'number' && Number.isFinite(height) && height > 0) {
          resizeMessage.height = Math.ceil(height);
          hasSize = true;
        }
        if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
          resizeMessage.width = Math.ceil(width);
          hasSize = true;
        }
        if (!hasSize) {
          return undefined;
        }
        const window = this.#mainWindow?.();
        if (window && !window.isDestroyed()) {
          window.webContents.send('plugins:surfaceResize', resizeMessage);
        }
        return undefined;
      }
      case 'registerContribution':
      case 'unregisterContribution': {
        this.#mainWindow?.()?.webContents.send('plugins:contributions', {
          pluginId: session.pluginId,
          op,
          ...(payload as Record<string, unknown>)
        });
        return undefined;
      }
      case 'themes.register': {
        const { theme } = payload as { theme: Record<string, unknown> };
        this.#mainWindow?.()?.webContents.send('plugins:contributions', {
          pluginId: session.pluginId,
          op: 'registerContribution',
          kind: 'themes',
          contribution: theme
        });
        return undefined;
      }
      case 'themes.unregister': {
        const { themeId } = payload as { themeId: string };
        this.#mainWindow?.()?.webContents.send('plugins:contributions', {
          pluginId: session.pluginId,
          op: 'unregisterContribution',
          kind: 'themes',
          contributionId: themeId
        });
        return undefined;
      }
      case 'commands.executeRemote': {
        const {
          pluginId: targetPluginId,
          commandId,
          args
        } = payload as {
          pluginId: string;
          commandId: string;
          args?: unknown[];
        };
        this.executeCommand(targetPluginId, commandId, args ?? []);
        return undefined;
      }
      case 'imports.registerHandler': {
        const { registrationId, extensions } = payload as {
          registrationId: string;
          extensions: string[];
        };
        this.#mainWindow?.()?.webContents.send('plugins:importHandlers', {
          pluginId: session.pluginId,
          op: 'register',
          registrationId,
          extensions
        });
        logImportVerbose('broker imports.registerHandler', {
          pluginId: session.pluginId,
          registrationId,
          extensions
        });
        return undefined;
      }
      case 'imports.unregisterHandler': {
        const { registrationId } = payload as { registrationId: string };
        this.#mainWindow?.()?.webContents.send('plugins:importHandlers', {
          pluginId: session.pluginId,
          op: 'unregister',
          registrationId
        });
        logImportVerbose('broker imports.unregisterHandler', {
          pluginId: session.pluginId,
          registrationId
        });
        return undefined;
      }
      case 'imports.invokeComplete': {
        const complete = payload as AgentImportInvokeCompleteMessage;
        logImportVerbose('broker imports.invokeComplete', {
          requestId: complete.requestId,
          ok: complete.ok,
          error: complete.error
        });
        this.#completeAgentImportInvoke(complete);
        return undefined;
      }
      case 'mcp.registerServer': {
        const { registrationId, name, serverURL, enabled, headers, icon } = payload as {
          registrationId: string;
          name: string;
          serverURL: string;
          enabled?: boolean;
          headers?: Array<{ key: string; value: string }>;
          icon?: string;
        };
        registerPluginMcpServer(session.pluginId, registrationId, {
          name,
          serverURL,
          enabled,
          headers,
          icon
        });
        await refreshMcpClientConnections();
        return undefined;
      }
      case 'mcp.unregisterServer': {
        const { registrationId } = payload as { registrationId: string };
        unregisterPluginMcpServer(session.pluginId, registrationId);
        await refreshMcpClientConnections();
        return undefined;
      }
      case 'ui.showToast':
      case 'ui.setFooterPanelIndicator':
      case 'ui.openModal':
      case 'ui.closeModal':
      case 'host.openRequestDraft':
      case 'host.applyRequestDraft':
      case 'host.loadRequest':
      case 'host.sendRequest':
      case 'host.updateEnvironmentVariables':
      case 'host.logRequestToConsole':
      case 'host.clearResponse': {
        this.#mainWindow?.()?.webContents.send('plugins:hostBridge', {
          pluginId: session.pluginId,
          op,
          payload
        });
        return undefined;
      }
      default:
        throw new Error(`Unsupported plugin UI bridge operation: ${op}`);
    }
  }

  /**
   * Asserts that a plugin declares the permission required for an operation.
   *
   * @param pluginId - Plugin manifest id.
   * @param op - Broker operation name.
   */
  #assertOpPermission(pluginId: string, op: string): void {
    const required = OP_PERMISSIONS[op];
    if (!required) {
      return;
    }
    this.#pluginManager.assertPermission(pluginId, required);
    if (required === 'network' && !isPluginNetworkAllowed(pluginId)) {
      throw new Error(
        `Plugin ${pluginId} cannot make network requests. Enable "Allow script network requests" in Settings → General or allow this plugin during install.`
      );
    }
  }

  /**
   * Forwards a return-value host bridge call to the host renderer and waits for
   * the correlated completion message.
   *
   * @param pluginId - Calling plugin manifest id.
   * @param op - Host bridge operation name.
   * @param payload - Serializable operation payload.
   */
  #invokeHostBridge(pluginId: string, op: string, payload: unknown): Promise<unknown> {
    const window = this.#mainWindow?.();
    if (!window || window.isDestroyed()) {
      return Promise.reject(new Error('Main application window is not available.'));
    }

    const requestId = this.#nextHostBridgeRequestId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pendingHostBridge.delete(requestId);
        reject(new Error(`Plugin host bridge operation timed out: ${op}`));
      }, HOST_BRIDGE_INVOKE_TIMEOUT_MS);

      this.#pendingHostBridge.set(requestId, { resolve, reject, timeout });
      window.webContents.send('plugins:hostBridgeInvoke', {
        requestId,
        pluginId,
        op,
        payload
      });
    });
  }

  /**
   * Resolves or rejects a pending host bridge invoke when the host renderer replies.
   *
   * @param message - Completion payload from the host renderer preload bridge.
   */
  #completeHostBridgeInvoke(message: HostBridgeCompleteMessage): void {
    const pending = this.#pendingHostBridge.get(message.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.#pendingHostBridge.delete(message.requestId);

    if (message.ok) {
      pending.resolve(message.result);
      return;
    }

    pending.reject(new Error(message.error ?? 'Plugin host bridge invocation failed.'));
  }

  /**
   * Completes a pending host bridge invoke — exposed for unit tests.
   *
   * @param message - Completion payload matching {@link HostBridgeCompleteMessage}.
   */
  completeHostBridgeInvokeForTests(message: HostBridgeCompleteMessage): void {
    this.#completeHostBridgeInvoke(message);
  }

  /**
   * Resolves or rejects a pending agent import invoke when the agent webview replies.
   *
   * @param message - Completion payload from the agent webview bridge.
   */
  #completeAgentImportInvoke(message: AgentImportInvokeCompleteMessage): void {
    const pending = this.#pendingAgentImportInvoke.get(message.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.#pendingAgentImportInvoke.delete(message.requestId);

    if (message.ok) {
      pending.resolve(message.result);
      return;
    }

    pending.reject(new Error(message.error ?? 'Plugin import handler invocation failed.'));
  }

  /**
   * Completes a pending agent import invoke — exposed for unit tests.
   *
   * @param message - Completion payload matching {@link AgentImportInvokeCompleteMessage}.
   */
  completeAgentImportInvokeForTests(message: AgentImportInvokeCompleteMessage): void {
    this.#completeAgentImportInvoke(message);
  }

  /**
   * Resolves a webContents instance by numeric id.
   *
   * @param webContentsId - Electron webContents id.
   */
  #getWebContentsById(webContentsId: number): WebContents | null {
    return webContents.fromId(webContentsId) ?? null;
  }

  /**
   * Iterates registered webview sessions without mutating the map during iteration.
   */
  *#iterSessions(): IterableIterator<[number, PluginWebviewSession]> {
    yield* this.#sessions.entries();
  }

  /**
   * Drops a session when its plugin is no longer loaded.
   *
   * @param webContentsId - Registered webContents id.
   * @param session - Session metadata for the webview.
   * @returns True when the session referred to a known plugin.
   */
  #isKnownPluginSession(webContentsId: number, session: PluginWebviewSession): boolean {
    if (this.#pluginManager.get(session.pluginId)) {
      return true;
    }
    this.#sessions.delete(webContentsId);
    return false;
  }

  /**
   * Returns whether a session belongs to a loaded plugin with the `http` permission.
   *
   * Stale sessions for disabled or removed plugins are pruned instead of throwing.
   *
   * @param webContentsId - Registered webContents id.
   * @param session - Session metadata for the webview.
   */
  #sessionHasHttpPermission(webContentsId: number, session: PluginWebviewSession): boolean {
    if (!this.#isKnownPluginSession(webContentsId, session)) {
      return false;
    }
    return this.#pluginManager.getPluginPermissions(session.pluginId).includes('http');
  }
}

let brokerInstance: PluginUiBroker | null = null;

/**
 * Returns the singleton plugin UI broker instance.
 */
export function getPluginUiBroker(): PluginUiBroker {
  if (!brokerInstance) {
    throw new Error('Plugin UI broker is not initialized.');
  }
  return brokerInstance;
}

/**
 * Initializes the plugin UI broker singleton.
 *
 * @param pluginManager - Initialized plugin manager.
 */
export function initPluginUiBroker(pluginManager: PluginManager): PluginUiBroker {
  const broker = new PluginUiBroker(pluginManager);
  brokerInstance = broker;
  setPluginMcpRegistryManager(pluginManager);
  broker.registerIpcHandlers();
  pluginManager.setFilesystemWebviewNotifier((pluginId, normalizedPath) => {
    broker.notifyFilesystemChanged(pluginId, normalizedPath);
  });
  return broker;
}
