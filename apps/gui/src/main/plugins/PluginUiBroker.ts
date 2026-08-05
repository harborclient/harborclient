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
  writeBytesForPlugin,
  writeFileForPlugin
} from './pluginFsOperations';
import type { PluginPermission } from '@harborclient/core/plugin/types';
import { toActiveTheme } from '@harborclient/core/plugin/types';
import type { ThemeSource } from '@harborclient/core/types';
import { isPluginNetworkAllowed } from '#/main/settings/generalSettings';
import { logImportVerbose } from '#/main/import/importVerboseLog';
import { refreshMcpClientConnections } from '#/main/mcp/mcpClientManager';
import {
  clearPluginMcpServers,
  registerPluginMcpServer,
  setPluginMcpRegistryManager,
  unregisterPluginMcpServer
} from './pluginMcpRegistry';
import {
  clearPluginChatPointers,
  getPluginChatPointerRegistrationById,
  registerPluginChatPointer,
  unregisterPluginChatPointer
} from './pluginChatPointerRegistry';
import {
  clearPluginAiInstructionEntries,
  registerPluginAiInstructionEntry,
  unregisterPluginAiInstructionEntry
} from './pluginAiInstructionsRegistry';
import {
  derivePluginWebviewSession,
  type PluginWebviewSession
} from '#/pluginBridge/pluginUiSession';
import {
  parseContributionForKind,
  parsePluginUiBridgeInvokeEnvelope,
  parsePluginUiBridgePayload,
  type ContributionKind
} from '#/pluginBridge/pluginUiBridgeSchemas';

/**
 * Serializable payload for `ai.beforeTurn` / host before-turn orchestration.
 */
export interface PluginAiBeforeTurnPayload {
  chatId: number;
  model: string;
  hubId?: string;
  userMessage: {
    content: string;
    referenceSnapshots?: Record<string, unknown>;
  };
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string | null;
  }>;
}

/**
 * Merged patch returned from before-turn handlers.
 */
export interface PluginAiBeforeTurnResult {
  cancelled: boolean;
  cancelReason?: string;
  userContent?: string;
  extraInstructions: string[];
}

/**
 * Serializable payload for `ai.afterTurn`.
 */
export interface PluginAiAfterTurnPayload {
  chatId: number;
  model: string;
  hubId?: string;
  userMessage: { content: string };
  assistantMessage: { content: string } | null;
  status: 'completed' | 'cancelled' | 'error';
  error?: { message: string };
  stats: {
    stepCount: number;
    toolCallCount: number;
    durationMs: number;
  };
}

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
  'fs.writeBytes': 'filesystem:write',
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
  'host.loadDocument': 'ui',
  'host.openCollectionSettings': 'ui',
  'host.openCollectionRunner': 'ui',
  'host.openShareModal': 'ui',
  'host.showEntityContextMenu': 'ui',
  'host.getSidebarSelection': 'ui',
  'host.setSidebarSelection': 'ui',
  'host.send': 'ui',
  'host.createEnvironmentWithVariables': 'ui',
  'host.updateEnvironmentVariables': 'ui',
  'host.createCollection': 'ui',
  'host.updateCollection': 'ui',
  'host.deleteCollection': 'ui',
  'host.reorderCollections': 'ui',
  'host.setCollectionArchived': 'ui',
  'host.duplicateCollection': 'ui',
  'host.createFolder': 'ui',
  'host.renameFolder': 'ui',
  'host.deleteFolder': 'ui',
  'host.moveFolder': 'ui',
  'host.reorderFolders': 'ui',
  'host.createRequest': 'ui',
  'host.deleteRequest': 'ui',
  'host.duplicateRequest': 'ui',
  'host.moveRequest': 'ui',
  'host.reorderRequests': 'ui',
  'host.createDocument': 'ui',
  'host.renameDocument': 'ui',
  'host.deleteDocument': 'ui',
  'host.moveDocument': 'ui',
  'host.reorderDocuments': 'ui',
  'host.reorderContainerItems': 'ui',
  'host.listCollections': 'ui',
  'host.listFolders': 'ui',
  'host.listRequests': 'ui',
  'host.listDocuments': 'ui',
  'host.listLibraryTree': 'ui',
  'host.listCollectionRequests': 'ui',
  'host.getCollectionMetadata': 'ui',
  'host.listWorkflows': 'ui',
  'host.getWorkflow': 'ui',
  'host.createWorkflow': 'ui',
  'host.updateWorkflow': 'ui',
  'host.renameWorkflow': 'ui',
  'host.deleteWorkflow': 'ui',
  'host.logRequestToConsole': 'ui',
  'host.fetch': 'network',
  'host.clearResponse': 'ui',
  'host.openImageView': 'ui',
  'view.getContext': 'ui',
  'view.reportSize': 'ui',
  'ui.openModal': 'ui',
  'ui.closeModal': 'ui',
  'imports.registerHandler': 'ui',
  'imports.unregisterHandler': 'ui',
  'imports.invokeComplete': 'ui',
  'ai.parseChatPointerComplete': 'ai',
  'ai.registerInstructions': 'ai',
  'ai.unregisterInstructions': 'ai',
  'ai.beforeTurnComplete': 'ai',
  'mcp.registerServer': 'mcp',
  'mcp.unregisterServer': 'mcp',
  'ai.registerChatPointer': 'ai',
  'ai.unregisterChatPointer': 'ai',
  'ai.copyToChat': 'ai',
  'livePage.open': 'browser',
  'livePage.focus': 'browser',
  'livePage.close': 'browser',
  'livePage.query': 'browser',
  'livePage.evaluate': 'browser',
  'livePage.injectScript': 'browser',
  'livePage.injectStylesheet': 'browser',
  'livePage.screenshot': 'browser',
  'livePage.goBack': 'browser',
  'livePage.goForward': 'browser',
  'livePage.reload': 'browser',
  'livePage.navigate': 'browser',
  'liveServers.list': 'live-server',
  'liveServers.get': 'live-server',
  'liveServers.create': 'live-server',
  'liveServers.update': 'live-server',
  'liveServers.delete': 'live-server',
  'liveServers.start': 'live-server',
  'liveServers.stop': 'live-server',
  'liveServers.listRunning': 'live-server',
  'liveServers.getStatus': 'live-server',
  'liveServers.getLogs': 'live-server',
  'liveServers.clearLogs': 'live-server',
  'livePages.list': 'live-pages',
  'livePages.get': 'live-pages',
  'livePages.create': 'live-pages',
  'livePages.update': 'live-pages',
  'livePages.delete': 'live-pages'
};

/** Host bridge operations that must round-trip a result to the plugin webview. */
const HOST_BRIDGE_RETURN_OPS = new Set([
  'host.fetch',
  'host.createEnvironmentWithVariables',
  'host.createCollection',
  'host.updateCollection',
  'host.deleteCollection',
  'host.reorderCollections',
  'host.setCollectionArchived',
  'host.duplicateCollection',
  'host.createFolder',
  'host.renameFolder',
  'host.deleteFolder',
  'host.moveFolder',
  'host.reorderFolders',
  'host.createRequest',
  'host.deleteRequest',
  'host.duplicateRequest',
  'host.moveRequest',
  'host.reorderRequests',
  'host.createDocument',
  'host.renameDocument',
  'host.deleteDocument',
  'host.moveDocument',
  'host.reorderDocuments',
  'host.reorderContainerItems',
  'host.listCollections',
  'host.listFolders',
  'host.listRequests',
  'host.listDocuments',
  'host.listLibraryTree',
  'host.listCollectionRequests',
  'host.getCollectionMetadata',
  'host.listWorkflows',
  'host.getWorkflow',
  'host.createWorkflow',
  'host.updateWorkflow',
  'host.renameWorkflow',
  'host.deleteWorkflow',
  'host.loadDocument',
  'host.getSidebarSelection',
  'host.setSidebarSelection',
  'commands.execute',
  'ai.copyToChat',
  'livePage.open',
  'livePage.focus',
  'livePage.close',
  'livePage.query',
  'livePage.evaluate',
  'livePage.injectScript',
  'livePage.injectStylesheet',
  'livePage.screenshot',
  'livePage.goBack',
  'livePage.goForward',
  'livePage.reload',
  'livePage.navigate',
  'liveServers.list',
  'liveServers.get',
  'liveServers.create',
  'liveServers.update',
  'liveServers.delete',
  'liveServers.start',
  'liveServers.stop',
  'liveServers.listRunning',
  'liveServers.getStatus',
  'liveServers.getLogs',
  'liveServers.clearLogs',
  'livePages.list',
  'livePages.get',
  'livePages.create',
  'livePages.update',
  'livePages.delete'
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

interface AgentParseChatPointerCompleteMessage {
  requestId: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface PendingAgentParseChatPointerInvoke {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface AgentBeforeTurnCompleteMessage {
  requestId: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface PendingAgentBeforeTurnInvoke {
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
  readonly #pendingAgentParseChatPointerInvoke = new Map<
    number,
    PendingAgentParseChatPointerInvoke
  >();
  readonly #pendingAgentBeforeTurnInvoke = new Map<number, PendingAgentBeforeTurnInvoke>();
  #nextHostBridgeRequestId = 1;
  #nextAgentImportRequestId = 1;
  #nextAgentParseChatPointerRequestId = 1;
  #nextAgentBeforeTurnRequestId = 1;
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
    ipcMain.handle('plugins:uiBridge', async (event, raw) => {
      const message = parsePluginUiBridgeInvokeEnvelope(raw);
      return this.handleInvoke(event.sender, message.op, message.payload);
    });

    ipcMain.on('plugins:uiRegisterSession', (event) => {
      // Identity comes from the guest URL/partition set at will-attach-webview —
      // never from the registration payload fields (pluginId, role, …).
      this.#sessions.set(event.sender.id, derivePluginWebviewSession(event.sender));
    });

    ipcMain.on('plugins:hostBridgeComplete', (_event, message: HostBridgeCompleteMessage) => {
      this.#completeHostBridgeInvoke(message);
    });
  }

  /**
   * Resolves the bound session for a plugin webview, deriving identity from the
   * guest URL when the preload registration raced ahead or was skipped.
   *
   * @param sender - Calling plugin webContents.
   * @returns Trusted session identity for permission checks and forwarding.
   */
  #resolveSession(sender: WebContents): PluginWebviewSession {
    const derived = derivePluginWebviewSession(sender);
    const existing = this.#sessions.get(sender.id);
    if (!existing) {
      this.#sessions.set(sender.id, derived);
      return derived;
    }
    if (existing.pluginId !== derived.pluginId || existing.role !== derived.role) {
      throw new Error(`Plugin webview session identity mismatch for webContents ${sender.id}.`);
    }
    // Prefer URL-derived contribution metadata when present (view surfaces).
    const merged: PluginWebviewSession = {
      ...existing,
      ...derived,
      pluginId: derived.pluginId,
      role: derived.role
    };
    this.#sessions.set(sender.id, merged);
    return merged;
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
      clearPluginChatPointers(session.pluginId);
      clearPluginAiInstructionEntries(session.pluginId);
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
    clearPluginChatPointers(pluginId);
    clearPluginAiInstructionEntries(pluginId);
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
   * Pushes a completed AI chat turn to every plugin webview that declares the
   * `ai` permission so renderer-side `hc.ai.onAfterTurn` handlers can run.
   *
   * @param payload - Serializable turn result from the host chat loop.
   */
  pushAiAfterTurn(payload: PluginAiAfterTurnPayload): void {
    for (const [webContentsId, session] of this.#iterSessions()) {
      if (!this.#sessionHasAiPermission(webContentsId, session)) {
        continue;
      }
      this.#getWebContentsById(webContentsId)?.send('plugin-ui:event', {
        channel: 'ai.afterTurn',
        payload
      });
    }
  }

  /**
   * Runs before-turn handlers in every agent webview with the `ai` permission.
   *
   * Merges patches: any cancel wins; concatenates extraInstructions; last
   * non-empty userContent wins.
   *
   * @param payload - Serializable turn context snapshot.
   * @returns Merged before-turn result.
   */
  async runAiBeforeTurn(payload: PluginAiBeforeTurnPayload): Promise<PluginAiBeforeTurnResult> {
    const targets: Array<{ webContentsId: number; pluginId: string }> = [];
    for (const [webContentsId, session] of this.#iterSessions()) {
      if (session.role !== 'agent' || !this.#sessionHasAiPermission(webContentsId, session)) {
        continue;
      }
      if (!this.#getWebContentsById(webContentsId)) {
        continue;
      }
      targets.push({ webContentsId, pluginId: session.pluginId });
    }

    const merged: PluginAiBeforeTurnResult = {
      cancelled: false,
      extraInstructions: [],
      userContent: payload.userMessage.content
    };

    let currentUserContent = payload.userMessage.content;

    for (const target of targets) {
      const webContentsRef = this.#getWebContentsById(target.webContentsId);
      if (!webContentsRef) {
        continue;
      }

      const requestId = this.#nextAgentBeforeTurnRequestId++;
      let patch: PluginAiBeforeTurnResult;
      try {
        const result = await new Promise<unknown>((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.#pendingAgentBeforeTurnInvoke.delete(requestId);
            reject(new Error('Plugin AI before-turn timed out.'));
          }, AGENT_IMPORT_INVOKE_TIMEOUT_MS);

          this.#pendingAgentBeforeTurnInvoke.set(requestId, { resolve, reject, timeout });
          webContentsRef.send('plugin-ui:event', {
            channel: 'ai.beforeTurn',
            payload: {
              requestId,
              chatId: payload.chatId,
              model: payload.model,
              ...(payload.hubId != null ? { hubId: payload.hubId } : {}),
              userMessage: {
                ...payload.userMessage,
                content: currentUserContent
              },
              messages: payload.messages
            }
          });
        });
        patch = normalizeBeforeTurnResult(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Plugin ${target.pluginId}: ${message}`);
      }

      if (patch.cancelled) {
        merged.cancelled = true;
        if (patch.cancelReason) {
          merged.cancelReason = patch.cancelReason;
        }
        break;
      }
      if (patch.extraInstructions.length > 0) {
        merged.extraInstructions.push(...patch.extraInstructions);
      }
      if (patch.userContent != null && patch.userContent !== '') {
        currentUserContent = patch.userContent;
        merged.userContent = patch.userContent;
      }
    }

    return merged;
  }

  /**
   * Pushes a coarse library invalidation to every plugin webview that declares
   * the `ui` permission so `hc.host.onLibraryChanged` handlers can refetch.
   *
   * @param event - Coarse reason and optional collection scope.
   */
  pushLibraryChanged(event: {
    reason: 'collections' | 'folders' | 'requests' | 'documents';
    collectionId?: number;
  }): void {
    for (const [webContentsId, session] of this.#iterSessions()) {
      if (!this.#sessionHasUiPermission(webContentsId, session)) {
        continue;
      }
      this.#getWebContentsById(webContentsId)?.send('plugin-ui:event', {
        channel: 'library.changed',
        payload: event
      });
    }
  }

  /**
   * Pushes a coarse workflow invalidation to every plugin webview that declares
   * the `ui` permission so `hc.host.onWorkflowsChanged` handlers can refetch.
   *
   * @param event - Coarse reason and optional workflow id.
   */
  pushWorkflowsChanged(event: {
    reason: 'created' | 'updated' | 'renamed' | 'deleted' | 'refreshed';
    workflowId?: number;
  }): void {
    for (const [webContentsId, session] of this.#iterSessions()) {
      if (!this.#sessionHasUiPermission(webContentsId, session)) {
        continue;
      }
      this.#getWebContentsById(webContentsId)?.send('plugin-ui:event', {
        channel: 'workflows.changed',
        payload: event
      });
    }
  }

  /**
   * Pushes host sidebar selection changes to every plugin webview that declares
   * the `ui` permission so `hc.host.onSidebarSelectionChanged` can stay in sync.
   *
   * @param selection - Current selection, or null when cleared.
   */
  pushSidebarSelectionChanged(selection: unknown): void {
    for (const [webContentsId, session] of this.#iterSessions()) {
      if (!this.#sessionHasUiPermission(webContentsId, session)) {
        continue;
      }
      this.#getWebContentsById(webContentsId)?.send('plugin-ui:event', {
        channel: 'sidebar.selection.changed',
        payload: selection
      });
    }
  }

  /**
   * Pushes the refreshed running live-server list to plugin webviews that declare
   * the `live-server` permission so `hc.liveServers.onRunningChanged` stays in sync.
   *
   * @param running - Current running live server instances.
   */
  pushLiveServersRunningChanged(running: unknown): void {
    for (const [webContentsId, session] of this.#iterSessions()) {
      if (!this.#sessionHasLiveServerPermission(webContentsId, session)) {
        continue;
      }
      this.#getWebContentsById(webContentsId)?.send('plugin-ui:event', {
        channel: 'liveServers.runningChanged',
        payload: running
      });
    }
  }

  /**
   * Pushes one Express access-log line to plugin webviews that declare the
   * `live-server` permission so `hc.liveServers.onRequestLog` stays in sync.
   *
   * @param entry - Access-log entry from a running live server.
   */
  pushLiveServerRequestLog(entry: unknown): void {
    for (const [webContentsId, session] of this.#iterSessions()) {
      if (!this.#sessionHasLiveServerPermission(webContentsId, session)) {
        continue;
      }
      this.#getWebContentsById(webContentsId)?.send('plugin-ui:event', {
        channel: 'liveServers.requestLog',
        payload: entry
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
   * Invokes a plugin chat-pointer `parse` callback in the agent webview.
   *
   * @param pluginId - Target plugin manifest id.
   * @param registrationId - Pointer registration id from the agent webview.
   * @param payload - Match groups, full token, and atIndex for parse.
   * @returns Plugin parse result or null.
   */
  invokeParseChatPointer(
    pluginId: string,
    registrationId: string,
    payload: {
      matchGroups: Array<string | null | undefined>;
      fullToken: string;
      atIndex: number;
    }
  ): Promise<unknown> {
    for (const [webContentsId, session] of this.#sessions.entries()) {
      if (session.role !== 'agent' || session.pluginId !== pluginId) {
        continue;
      }
      const target = this.#getWebContentsById(webContentsId);
      if (!target) {
        continue;
      }

      const requestId = this.#nextAgentParseChatPointerRequestId++;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.#pendingAgentParseChatPointerInvoke.delete(requestId);
          reject(new Error('Plugin chat pointer parse timed out.'));
        }, AGENT_IMPORT_INVOKE_TIMEOUT_MS);

        this.#pendingAgentParseChatPointerInvoke.set(requestId, { resolve, reject, timeout });
        target.send('plugin-ui:event', {
          channel: 'ai.parseChatPointer',
          payload: {
            requestId,
            registrationId,
            matchGroups: payload.matchGroups,
            fullToken: payload.fullToken,
            atIndex: payload.atIndex
          }
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
    const session = this.#resolveSession(sender);
    this.#assertOpPermission(session.pluginId, op);
    const parsedPayload = parsePluginUiBridgePayload(op, payload);

    if (HOST_BRIDGE_RETURN_OPS.has(op)) {
      return this.#invokeHostBridge(session.pluginId, op, parsedPayload);
    }

    switch (op) {
      case 'storage.get': {
        const { key } = parsedPayload as { key: string };
        return this.#pluginManager.getStorageValue(session.pluginId, key);
      }
      case 'storage.set': {
        const { key, value } = parsedPayload as { key: string; value: unknown };
        await this.#pluginManager.setStorageValue(session.pluginId, key, value);
        return undefined;
      }
      case 'database.query': {
        const { mode, sql, params, txnId } = parsedPayload as {
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
        const { sql } = parsedPayload as { sql: string };
        return getPluginDatabaseManager().exec(session.pluginId, sql);
      }
      case 'database.beginTransaction': {
        return getPluginDatabaseManager().beginTransaction(session.pluginId);
      }
      case 'database.endTransaction': {
        const { txnId, action } = parsedPayload as {
          txnId: string;
          action: 'commit' | 'rollback';
        };
        return getPluginDatabaseManager().endTransaction(session.pluginId, txnId, action);
      }
      case 'fs.pickFile': {
        const { options } = (parsedPayload ?? {}) as { options?: PluginFsPickFileOptions };
        return pickFileForPlugin(this.#pluginManager, session.pluginId, options);
      }
      case 'fs.pickDirectory': {
        const { defaultPath } = (parsedPayload ?? {}) as { defaultPath?: string };
        return pickDirectoryForPlugin(this.#pluginManager, session.pluginId, defaultPath ?? '');
      }
      case 'fs.saveFile': {
        const { content, options } = parsedPayload as {
          content: string;
          options?: PluginFsSaveFileOptions;
        };
        return saveFileForPlugin(this.#pluginManager, session.pluginId, content, options);
      }
      case 'fs.readFile': {
        const { path } = parsedPayload as { path: string };
        return readFileForPlugin(this.#pluginManager, session.pluginId, path);
      }
      case 'fs.writeFile': {
        const { path, content } = parsedPayload as { path: string; content: string };
        writeFileForPlugin(this.#pluginManager, session.pluginId, path, content);
        return undefined;
      }
      case 'fs.writeBytes': {
        const { path, base64 } = parsedPayload as { path: string; base64: string };
        const bytes = new Uint8Array(Buffer.from(base64, 'base64'));
        return writeBytesForPlugin(this.#pluginManager, session.pluginId, path, bytes);
      }
      case 'fs.watchFile': {
        const { path } = parsedPayload as { path: string };
        watchFileForPlugin(this.#pluginManager, session.pluginId, path);
        return undefined;
      }
      case 'ipc.invoke': {
        const { channel, args } = parsedPayload as { channel: string; args?: unknown[] };
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
        } = parsedPayload as {
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
      case 'registerContribution': {
        const { kind, contribution } = parsedPayload as {
          kind: ContributionKind;
          contribution: Record<string, unknown>;
        };
        const validated = parseContributionForKind(kind, contribution);
        this.#mainWindow?.()?.webContents.send('plugins:contributions', {
          pluginId: session.pluginId,
          op,
          kind,
          contribution: validated
        });
        return undefined;
      }
      case 'unregisterContribution': {
        const { kind, contributionId } = parsedPayload as {
          kind: ContributionKind;
          contributionId: string;
        };
        this.#mainWindow?.()?.webContents.send('plugins:contributions', {
          pluginId: session.pluginId,
          op,
          kind,
          contributionId
        });
        return undefined;
      }
      case 'themes.register': {
        const { theme } = parsedPayload as {
          theme: Record<string, unknown>;
        };
        this.#mainWindow?.()?.webContents.send('plugins:contributions', {
          pluginId: session.pluginId,
          op: 'registerContribution',
          kind: 'themes',
          contribution: theme
        });
        return undefined;
      }
      case 'themes.unregister': {
        const { themeId } = parsedPayload as { themeId: string };
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
        } = parsedPayload as {
          pluginId: string;
          commandId: string;
          args?: unknown[];
        };
        this.executeCommand(targetPluginId, commandId, args ?? []);
        return undefined;
      }
      case 'imports.registerHandler': {
        const { registrationId, extensions } = parsedPayload as {
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
        const { registrationId } = parsedPayload as { registrationId: string };
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
        const complete = parsedPayload as AgentImportInvokeCompleteMessage;
        logImportVerbose('broker imports.invokeComplete', {
          requestId: complete.requestId,
          ok: complete.ok,
          error: complete.error
        });
        this.#completeAgentImportInvoke(complete);
        return undefined;
      }
      case 'ai.parseChatPointerComplete': {
        const complete = parsedPayload as AgentParseChatPointerCompleteMessage;
        this.#completeAgentParseChatPointerInvoke(complete);
        return undefined;
      }
      case 'ai.beforeTurnComplete': {
        const complete = parsedPayload as AgentBeforeTurnCompleteMessage;
        this.#completeAgentBeforeTurnInvoke(complete);
        return undefined;
      }
      case 'ai.registerInstructions': {
        const { registrationId, text } = parsedPayload as {
          registrationId: string;
          text?: string;
        };
        registerPluginAiInstructionEntry(
          session.pluginId,
          String(registrationId),
          String(text ?? '')
        );
        return undefined;
      }
      case 'ai.unregisterInstructions': {
        const { registrationId } = parsedPayload as { registrationId: string };
        unregisterPluginAiInstructionEntry(session.pluginId, String(registrationId));
        return undefined;
      }
      case 'mcp.registerServer': {
        const { registrationId, name, serverURL, enabled, headers, icon } = parsedPayload as {
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
        const { registrationId } = parsedPayload as { registrationId: string };
        unregisterPluginMcpServer(session.pluginId, registrationId);
        await refreshMcpClientConnections();
        return undefined;
      }
      case 'ai.registerChatPointer': {
        const { registrationId, pointerId, agentGuidance, match } = parsedPayload as {
          registrationId: string;
          pointerId: string;
          agentGuidance?: string;
          match?: { source: string; flags?: string };
        };
        registerPluginChatPointer({
          pluginId: session.pluginId,
          registrationId,
          pointerId,
          agentGuidance,
          match
        });
        const stored = getPluginChatPointerRegistrationById(session.pluginId, registrationId);
        this.#mainWindow?.()?.webContents.send('plugins:hostBridge', {
          pluginId: session.pluginId,
          op: 'ai.trackChatPointer',
          payload: {
            registrationId,
            pointerId,
            ...(stored?.matchSource != null ? { matchSource: stored.matchSource } : {}),
            ...(agentGuidance != null && stored?.matchSource != null
              ? { agentGuidance: String(agentGuidance) }
              : {})
          }
        });
        return undefined;
      }
      case 'ai.unregisterChatPointer': {
        const { registrationId } = parsedPayload as { registrationId: string };
        unregisterPluginChatPointer(session.pluginId, registrationId);
        this.#mainWindow?.()?.webContents.send('plugins:hostBridge', {
          pluginId: session.pluginId,
          op: 'ai.untrackChatPointer',
          payload: { registrationId }
        });
        return undefined;
      }
      case 'ui.showToast':
      case 'ui.setFooterPanelIndicator':
      case 'ui.openModal':
      case 'ui.closeModal':
      case 'host.openRequestDraft':
      case 'host.applyRequestDraft':
      case 'host.loadRequest':
      case 'host.openCollectionSettings':
      case 'host.openCollectionRunner':
      case 'host.openShareModal':
      case 'host.showEntityContextMenu':
      case 'host.send':
      case 'host.updateEnvironmentVariables':
      case 'host.logRequestToConsole':
      case 'host.clearResponse':
      case 'host.openImageView': {
        this.#mainWindow?.()?.webContents.send('plugins:hostBridge', {
          pluginId: session.pluginId,
          op,
          payload: parsedPayload
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
   * Resolves or rejects a pending chat-pointer parse when the agent webview replies.
   *
   * @param message - Completion payload from the agent webview bridge.
   */
  #completeAgentParseChatPointerInvoke(message: AgentParseChatPointerCompleteMessage): void {
    const pending = this.#pendingAgentParseChatPointerInvoke.get(message.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.#pendingAgentParseChatPointerInvoke.delete(message.requestId);

    if (message.ok) {
      pending.resolve(message.result);
      return;
    }

    pending.reject(new Error(message.error ?? 'Plugin chat pointer parse failed.'));
  }

  /**
   * Resolves or rejects a pending before-turn invoke when the agent webview replies.
   *
   * @param message - Completion payload from the agent webview bridge.
   */
  #completeAgentBeforeTurnInvoke(message: AgentBeforeTurnCompleteMessage): void {
    const pending = this.#pendingAgentBeforeTurnInvoke.get(message.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.#pendingAgentBeforeTurnInvoke.delete(message.requestId);

    if (message.ok) {
      pending.resolve(message.result);
      return;
    }

    pending.reject(new Error(message.error ?? 'Plugin AI before-turn failed.'));
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
   * Completes a pending before-turn invoke — exposed for unit tests.
   *
   * @param message - Completion payload matching {@link AgentBeforeTurnCompleteMessage}.
   */
  completeAgentBeforeTurnInvokeForTests(message: AgentBeforeTurnCompleteMessage): void {
    this.#completeAgentBeforeTurnInvoke(message);
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

  /**
   * Returns whether a session belongs to a loaded plugin with the `ai` permission.
   *
   * Stale sessions for disabled or removed plugins are pruned instead of throwing.
   *
   * @param webContentsId - Registered webContents id.
   * @param session - Session metadata for the webview.
   */
  #sessionHasAiPermission(webContentsId: number, session: PluginWebviewSession): boolean {
    if (!this.#isKnownPluginSession(webContentsId, session)) {
      return false;
    }
    return this.#pluginManager.getPluginPermissions(session.pluginId).includes('ai');
  }

  /**
   * Returns whether a session belongs to a loaded plugin with the `ui` permission.
   *
   * Stale sessions for disabled or removed plugins are pruned instead of throwing.
   *
   * @param webContentsId - Registered webContents id.
   * @param session - Session metadata for the webview.
   */
  #sessionHasUiPermission(webContentsId: number, session: PluginWebviewSession): boolean {
    if (!this.#isKnownPluginSession(webContentsId, session)) {
      return false;
    }
    return this.#pluginManager.getPluginPermissions(session.pluginId).includes('ui');
  }

  /**
   * Returns whether a session belongs to a loaded plugin with the `live-server` permission.
   *
   * Stale sessions for disabled or removed plugins are pruned instead of throwing.
   *
   * @param webContentsId - Registered webContents id.
   * @param session - Session metadata for the webview.
   */
  #sessionHasLiveServerPermission(webContentsId: number, session: PluginWebviewSession): boolean {
    if (!this.#isKnownPluginSession(webContentsId, session)) {
      return false;
    }
    return this.#pluginManager.getPluginPermissions(session.pluginId).includes('live-server');
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

/**
 * Normalizes a before-turn handler result from an agent webview.
 *
 * @param raw - Unknown bridge result payload.
 * @returns Normalized merge patch.
 */
function normalizeBeforeTurnResult(raw: unknown): PluginAiBeforeTurnResult {
  const row = (raw ?? {}) as {
    cancelled?: unknown;
    cancelReason?: unknown;
    userContent?: unknown;
    extraInstructions?: unknown;
  };
  const extra = Array.isArray(row.extraInstructions)
    ? row.extraInstructions.map((item) => String(item ?? '').trim()).filter((item) => item !== '')
    : [];
  return {
    cancelled: Boolean(row.cancelled),
    ...(row.cancelReason != null && String(row.cancelReason).trim() !== ''
      ? { cancelReason: String(row.cancelReason).trim() }
      : {}),
    ...(row.userContent != null ? { userContent: String(row.userContent) } : {}),
    extraInstructions: extra
  };
}
