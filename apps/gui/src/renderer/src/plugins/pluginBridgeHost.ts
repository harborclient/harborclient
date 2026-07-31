import type {
  FooterPanelIndicatorState,
  RegisteredAction,
  RegisteredCollectionSettingsTab,
  RegisteredContextMenuItem,
  RegisteredFooterPanel,
  RegisteredMainView,
  RegisteredModal,
  RegisteredMenuItem,
  RegisteredRequestTab,
  RegisteredRequestToolbarAction,
  RegisteredScriptEditorAction,
  RegisteredResponseTab,
  RegisteredSettingsSection,
  RegisteredSidebarPanel,
  RegisteredSidebarRailItem,
  RegisteredSidebarSection,
  RegisteredStatusBarItem,
  RegisteredWorkflowActionBlock,
  RegisteredWorkflowToolbarAction,
  ThemeContribution
} from '@harborclient/core/plugin/types';
import {
  registerActionContribution,
  registerCollectionSettingsTabContribution,
  registerContextMenuItemContribution,
  registerFooterPanelContribution,
  registerMainViewContribution,
  registerModalContribution,
  registerMenuItemContribution,
  registerRequestTabContribution,
  registerRequestToolbarActionContribution,
  registerScriptEditorActionContribution,
  registerWorkflowActionBlockContribution,
  registerWorkflowToolbarActionContribution,
  registerResponseTabContribution,
  registerSettingsSectionContribution,
  registerSidebarPanelContribution,
  registerSidebarRailItemContribution,
  registerSidebarSectionContribution,
  registerStatusBarItemContribution,
  registerThemeContribution,
  setFooterPanelIndicatorState,
  unregisterContribution
} from './registry';
import { executeHostPluginCommand } from './hostCommands';
import {
  createCollectionFromPlugin,
  getCollectionMetadataForPlugin,
  listCollectionRequestsForPlugin,
  loadSavedRequest,
  clearActiveResponse,
  logRequestToConsole,
  openRequestDraft,
  applyRequestDraftToActiveTab,
  sendHttpRequestForPlugin,
  triggerSendRequest,
  type PluginConsoleLogPayload
} from './hostRequestCommands';
import {
  listCollectionsForPlugin,
  listDocumentsForPlugin,
  listFoldersForPlugin,
  listLibraryTreeForPlugin,
  listRequestsForPlugin
} from './hostLibraryCommands';
import {
  createDocumentForPlugin,
  createFolderForPlugin,
  createRequestForPlugin,
  deleteCollectionForPlugin,
  deleteDocumentForPlugin,
  deleteFolderForPlugin,
  deleteRequestForPlugin,
  duplicateCollectionForPlugin,
  duplicateRequestForPlugin,
  moveDocumentForPlugin,
  moveFolderForPlugin,
  moveRequestForPlugin,
  renameDocumentForPlugin,
  renameFolderForPlugin,
  reorderCollectionsForPlugin,
  reorderContainerItemsForPlugin,
  reorderDocumentsForPlugin,
  reorderFoldersForPlugin,
  reorderRequestsForPlugin,
  setCollectionArchivedForPlugin,
  updateCollectionForPlugin
} from './hostLibraryMutations';
import {
  createWorkflowForPlugin,
  deleteWorkflowForPlugin,
  getWorkflowForPlugin,
  listWorkflowsForPlugin,
  renameWorkflowForPlugin,
  updateWorkflowForPlugin
} from './hostWorkflowCommands';
import {
  clearLiveServerLogsForPlugin,
  createLiveServerForPlugin,
  deleteLiveServerForPlugin,
  getLiveServerForPlugin,
  getLiveServerLogsForPlugin,
  getLiveServerStatusForPlugin,
  listLiveServersForPlugin,
  listRunningLiveServersForPlugin,
  startLiveServerForPlugin,
  stopLiveServerForPlugin,
  updateLiveServerForPlugin
} from './hostLiveServerCommands';
import { openImageView } from './hostImageCommands';
import {
  createEnvironmentWithVariables,
  updateEnvironmentVariables
} from './hostEnvironmentCommands';
import {
  loadDocumentForPlugin,
  openCollectionRunnerForPlugin,
  openCollectionSettingsForPlugin,
  openShareModalForPlugin
} from './hostNavigationCommands';
import { showEntityContextMenuForPlugin } from './hostEntityContextMenu';
import {
  getSidebarSelection,
  setSidebarSelection,
  startSidebarSelectionStoreSubscription
} from './pluginSidebarSelectionBus';
import type {
  CreateDocumentInput,
  CreateFolderInput,
  CreateRequestInput,
  DeleteDocumentInput,
  DeleteFolderInput,
  LibraryListOptions,
  MoveDocumentInput,
  MoveFolderInput,
  MoveRequestInput,
  RenameDocumentInput,
  RenameFolderInput,
  ReorderContainerItemsInput,
  ReorderDocumentsInput,
  ReorderFoldersInput,
  ReorderRequestsInput,
  SetCollectionArchivedInput,
  ShowEntityContextMenuInput,
  UpdateCollectionInput
} from '@harborclient/sdk';
import toast from 'react-hot-toast';
import { store } from '#/renderer/src/store/redux';
import {
  trackPluginChatPointer,
  untrackPluginChatPointer
} from '#/renderer/src/plugins/pluginChatPointerTracker';
import { copyPluginPointerToChat } from '#/renderer/src/plugins/copyPluginPointerToChat';
import { setHostedModal } from '#/renderer/src/store/slices/modalsSlice';
import {
  registerBridgedImportHandler,
  unregisterBridgedImportHandler
} from './pluginImportHandlers';
import { logImportVerbose } from '#/renderer/src/import/importVerboseLog';
import type { ScriptWebpageRequest } from '@harborclient/core/scripting/scriptApi';
import { executeScriptWebpageRequest } from '#/renderer/src/scripting/scriptWebpageBridge';
import { isWebpageSessionError } from '#/renderer/src/store/browser/webpageSession';

type ContributionKind =
  | 'settingsSections'
  | 'themes'
  | 'sidebarPanels'
  | 'sidebarRailItems'
  | 'sidebarSections'
  | 'mainViews'
  | 'modals'
  | 'requestTabs'
  | 'responseTabs'
  | 'collectionSettingsTabs'
  | 'footerPanels'
  | 'statusBarItems'
  | 'menuItems'
  | 'requestToolbarActions'
  | 'scriptEditorActions'
  | 'workflowToolbarActions'
  | 'workflowActionBlocks'
  | 'contextMenuItems'
  | 'actions';

interface ContributionMessage {
  pluginId: string;
  op: 'registerContribution' | 'unregisterContribution';
  kind?: ContributionKind;
  contribution?: Record<string, unknown>;
  contributionId?: string;
}

interface HostBridgeMessage {
  pluginId: string;
  op: string;
  payload?: unknown;
}

/** Import handler metadata synced from a plugin agent webview. */
interface ImportHandlerMessage {
  pluginId: string;
  op: 'register' | 'unregister';
  registrationId: string;
  extensions?: string[];
}

/** Correlated host bridge invoke that must return a result to the plugin webview. */
export interface HostBridgeInvokeMessage {
  requestId: number;
  pluginId: string;
  op: string;
  payload?: unknown;
}

/**
 * Applies one contribution register/unregister message from a plugin agent webview.
 *
 * @param message - Contribution sync payload from the main-process broker.
 */
export function applyContributionMessage(message: ContributionMessage): void {
  if (message.op === 'unregisterContribution') {
    if (message.kind && message.contributionId) {
      unregisterContribution(message.pluginId, message.kind, message.contributionId);
    }
    return;
  }

  const kind = message.kind;
  const contribution = message.contribution;
  if (!kind || !contribution) {
    return;
  }

  switch (kind) {
    case 'settingsSections':
      registerSettingsSectionContribution(
        message.pluginId,
        contribution as Omit<RegisteredSettingsSection, 'pluginId'>
      );
      break;
    case 'themes':
      registerThemeContribution(message.pluginId, contribution as unknown as ThemeContribution);
      break;
    case 'sidebarPanels':
      registerSidebarPanelContribution(
        message.pluginId,
        contribution as Omit<RegisteredSidebarPanel, 'pluginId'>
      );
      break;
    case 'sidebarRailItems':
      registerSidebarRailItemContribution(
        message.pluginId,
        contribution as Omit<RegisteredSidebarRailItem, 'pluginId'>
      );
      break;
    case 'sidebarSections':
      registerSidebarSectionContribution(
        message.pluginId,
        contribution as Omit<RegisteredSidebarSection, 'pluginId'>
      );
      break;
    case 'mainViews':
      registerMainViewContribution(
        message.pluginId,
        contribution as Omit<RegisteredMainView, 'pluginId'>
      );
      break;
    case 'modals':
      registerModalContribution(
        message.pluginId,
        contribution as Omit<RegisteredModal, 'pluginId'>
      );
      break;
    case 'requestTabs':
      registerRequestTabContribution(
        message.pluginId,
        contribution as Omit<RegisteredRequestTab, 'pluginId'>
      );
      break;
    case 'responseTabs':
      registerResponseTabContribution(
        message.pluginId,
        contribution as Omit<RegisteredResponseTab, 'pluginId'>
      );
      break;
    case 'collectionSettingsTabs':
      registerCollectionSettingsTabContribution(
        message.pluginId,
        contribution as Omit<RegisteredCollectionSettingsTab, 'pluginId'>
      );
      break;
    case 'footerPanels':
      registerFooterPanelContribution(
        message.pluginId,
        contribution as Omit<RegisteredFooterPanel, 'pluginId'>
      );
      break;
    case 'statusBarItems':
      registerStatusBarItemContribution(
        message.pluginId,
        contribution as Omit<RegisteredStatusBarItem, 'pluginId'>
      );
      break;
    case 'menuItems':
      registerMenuItemContribution(
        message.pluginId,
        contribution as Omit<RegisteredMenuItem, 'pluginId'>
      );
      break;
    case 'requestToolbarActions':
      registerRequestToolbarActionContribution(
        message.pluginId,
        contribution as Omit<RegisteredRequestToolbarAction, 'pluginId'>
      );
      break;
    case 'scriptEditorActions':
      registerScriptEditorActionContribution(
        message.pluginId,
        contribution as Omit<RegisteredScriptEditorAction, 'pluginId'>
      );
      break;
    case 'workflowToolbarActions':
      registerWorkflowToolbarActionContribution(
        message.pluginId,
        contribution as Omit<RegisteredWorkflowToolbarAction, 'pluginId'>
      );
      break;
    case 'workflowActionBlocks':
      registerWorkflowActionBlockContribution(
        message.pluginId,
        contribution as Omit<RegisteredWorkflowActionBlock, 'pluginId'>
      );
      break;
    case 'contextMenuItems':
      registerContextMenuItemContribution(
        message.pluginId,
        contribution as Omit<RegisteredContextMenuItem, 'pluginId'>
      );
      break;
    case 'actions':
      registerActionContribution(
        message.pluginId,
        contribution as Omit<RegisteredAction, 'pluginId'>
      );
      break;
    default:
      break;
  }
}

/**
 * Applies one import handler register/unregister message from a plugin agent webview.
 *
 * @param message - Import handler sync payload from the main-process broker.
 */
export function applyImportHandlerMessage(message: ImportHandlerMessage): void {
  if (message.op === 'unregister') {
    unregisterBridgedImportHandler(message.pluginId, message.registrationId);
    logImportVerbose('bridge import handler unregistered', {
      pluginId: message.pluginId,
      registrationId: message.registrationId
    });
    return;
  }

  const extensions = message.extensions ?? [];
  registerBridgedImportHandler(message.pluginId, message.registrationId, extensions);
  logImportVerbose('bridge import handler registered', {
    pluginId: message.pluginId,
    registrationId: message.registrationId,
    extensions
  });
}

/**
 * Maps a plugin host-bridge webpage op + payload to a {@link ScriptWebpageRequest}.
 *
 * @param op - Bridge operation name (`webpage.open`, …).
 * @param payload - Serializable fields for the op.
 * @returns Request for {@link executeScriptWebpageRequest}.
 */
function toScriptWebpageRequest(op: string, payload: unknown): ScriptWebpageRequest {
  const fields = (payload ?? {}) as Record<string, unknown>;
  switch (op) {
    case 'webpage.open':
      return {
        op: 'open',
        url: typeof fields.url === 'string' ? fields.url : undefined,
        reuse: typeof fields.reuse === 'boolean' ? fields.reuse : undefined
      };
    case 'webpage.focus':
      return { op: 'focus', tabId: String(fields.tabId ?? '') };
    case 'webpage.close':
      return { op: 'close', tabId: String(fields.tabId ?? '') };
    case 'webpage.query':
      return {
        op: 'query',
        tabId: String(fields.tabId ?? ''),
        selector: String(fields.selector ?? ''),
        all: typeof fields.all === 'boolean' ? fields.all : undefined,
        maxElements: typeof fields.maxElements === 'number' ? fields.maxElements : undefined
      };
    case 'webpage.evaluate':
      return {
        op: 'evaluate',
        tabId: String(fields.tabId ?? ''),
        expression: String(fields.expression ?? '')
      };
    case 'webpage.injectScript':
      return {
        op: 'injectScript',
        tabId: String(fields.tabId ?? ''),
        source: String(fields.source ?? '')
      };
    case 'webpage.injectStylesheet':
      return {
        op: 'injectStylesheet',
        tabId: String(fields.tabId ?? ''),
        css: String(fields.css ?? '')
      };
    case 'webpage.screenshot':
      return {
        op: 'screenshot',
        tabId: String(fields.tabId ?? ''),
        fullPage: fields.fullPage === true ? true : undefined
      };
    default:
      throw new Error(`Unsupported webpage bridge operation: ${op}`);
  }
}

/**
 * Runs one webpage session op for a plugin host-bridge invoke.
 *
 * @param op - Bridge operation name.
 * @param payload - Serializable fields for the op.
 * @returns Session helper result.
 * @throws When the session returns `{ error }` or an unknown op.
 */
async function executePluginWebpageBridge(op: string, payload: unknown): Promise<unknown> {
  const result = await executeScriptWebpageRequest(toScriptWebpageRequest(op, payload));
  if (isWebpageSessionError(result)) {
    throw new Error(result.error);
  }
  return result;
}

/**
 * Handles void host-side operations requested by isolated plugin webviews.
 *
 * @param message - Host bridge payload from the main-process broker.
 */
export async function handlePluginHostBridge(message: HostBridgeMessage): Promise<void> {
  const { pluginId, op, payload } = message;

  switch (op) {
    case 'ui.showToast': {
      const { message: text, options } = payload as {
        message: string;
        options?: { duration?: number };
      };
      toast(text, { duration: options?.duration ?? 2000 });
      return;
    }
    case 'ui.setFooterPanelIndicator': {
      const { panelId, state: indicatorState } = payload as {
        panelId: string;
        state: FooterPanelIndicatorState | null;
      };
      setFooterPanelIndicatorState(pluginId, panelId, indicatorState);
      return;
    }
    case 'ui.openModal': {
      const { modalId, context } = payload as { modalId: string; context?: unknown };
      store.dispatch(
        setHostedModal({
          pluginId,
          contributionId: modalId,
          context
        })
      );
      return;
    }
    case 'ui.closeModal': {
      const { modalId } = payload as { modalId?: string };
      const current = store.getState().modals.hostedModal;
      if (!current || current.pluginId !== pluginId) {
        return;
      }
      if (modalId && current.contributionId !== modalId) {
        return;
      }
      store.dispatch(setHostedModal(null));
      return;
    }
    case 'host.openRequestDraft':
      await openRequestDraft((payload as { payload: never }).payload);
      return;
    case 'host.applyRequestDraft':
      applyRequestDraftToActiveTab((payload as { payload: never }).payload);
      return;
    case 'host.loadRequest':
      loadSavedRequest((payload as { requestId: number }).requestId);
      return;
    case 'host.openCollectionSettings':
      openCollectionSettingsForPlugin((payload as { collectionId: number }).collectionId);
      return;
    case 'host.openCollectionRunner':
      openCollectionRunnerForPlugin((payload as { collectionId: number }).collectionId);
      return;
    case 'host.openShareModal':
      openShareModalForPlugin((payload as { collectionId: number }).collectionId);
      return;
    case 'host.showEntityContextMenu':
      showEntityContextMenuForPlugin(payload as ShowEntityContextMenuInput);
      return;
    case 'host.sendRequest':
      triggerSendRequest();
      return;
    case 'host.updateEnvironmentVariables': {
      const { environmentId, variables } = payload as {
        environmentId: number;
        variables: Parameters<typeof updateEnvironmentVariables>[1];
      };
      await updateEnvironmentVariables(environmentId, variables);
      return;
    }
    case 'host.logRequestToConsole':
      logRequestToConsole((payload as { payload: PluginConsoleLogPayload }).payload);
      return;
    case 'host.clearResponse':
      clearActiveResponse();
      return;
    case 'host.openImageView':
      openImageView((payload as { payload: never }).payload);
      return;
    case 'ai.trackChatPointer': {
      const { registrationId, pointerId } = payload as {
        registrationId: string;
        pointerId: string;
      };
      trackPluginChatPointer({ pluginId, registrationId, pointerId });
      return;
    }
    case 'ai.untrackChatPointer': {
      const { registrationId } = payload as { registrationId: string };
      untrackPluginChatPointer(pluginId, registrationId);
      return;
    }
    default:
      return;
  }
}

/**
 * Executes a return-value host bridge operation in the host renderer.
 *
 * @param message - Correlated invoke payload from the main-process broker.
 * @returns Serializable operation result forwarded back to the plugin webview.
 */
export async function handlePluginHostBridgeInvoke(
  message: HostBridgeInvokeMessage
): Promise<unknown> {
  const { pluginId, op, payload } = message;

  switch (op) {
    case 'ai.copyToChat': {
      await copyPluginPointerToChat(
        pluginId,
        payload as {
          pointerId: string;
          key: string;
          label: string;
          context: string;
          selection?: { start: number; end: number };
        }
      );
      return undefined;
    }
    case 'host.createEnvironmentWithVariables': {
      const { name, variables } = payload as {
        name: string;
        variables: Parameters<typeof createEnvironmentWithVariables>[1];
      };
      return createEnvironmentWithVariables(name, variables);
    }
    case 'host.loadDocument': {
      const { documentId } = payload as { documentId: number };
      await loadDocumentForPlugin(documentId);
      return undefined;
    }
    case 'host.getSidebarSelection':
      return getSidebarSelection();
    case 'host.setSidebarSelection': {
      setSidebarSelection((payload as { selection: unknown }).selection);
      return undefined;
    }
    case 'host.createCollection':
      return createCollectionFromPlugin((payload as { payload: never }).payload);
    case 'host.updateCollection':
      return updateCollectionForPlugin(payload as UpdateCollectionInput);
    case 'host.deleteCollection': {
      const { collectionId } = payload as { collectionId: number };
      await deleteCollectionForPlugin(collectionId);
      return undefined;
    }
    case 'host.reorderCollections': {
      const { orderedIds } = payload as { orderedIds: number[] };
      await reorderCollectionsForPlugin(orderedIds);
      return undefined;
    }
    case 'host.setCollectionArchived':
      await setCollectionArchivedForPlugin(payload as SetCollectionArchivedInput);
      return undefined;
    case 'host.duplicateCollection': {
      const { collectionId } = payload as { collectionId: number };
      return duplicateCollectionForPlugin(collectionId);
    }
    case 'host.createFolder':
      return createFolderForPlugin(payload as CreateFolderInput);
    case 'host.renameFolder':
      return renameFolderForPlugin(payload as RenameFolderInput);
    case 'host.deleteFolder':
      await deleteFolderForPlugin(payload as DeleteFolderInput);
      return undefined;
    case 'host.moveFolder':
      return moveFolderForPlugin(payload as MoveFolderInput);
    case 'host.reorderFolders':
      await reorderFoldersForPlugin(payload as ReorderFoldersInput);
      return undefined;
    case 'host.createRequest':
      return createRequestForPlugin(payload as CreateRequestInput);
    case 'host.deleteRequest': {
      const { requestId } = payload as { requestId: number };
      await deleteRequestForPlugin(requestId);
      return undefined;
    }
    case 'host.duplicateRequest': {
      const { requestId } = payload as { requestId: number };
      return duplicateRequestForPlugin(requestId);
    }
    case 'host.moveRequest':
      await moveRequestForPlugin(payload as MoveRequestInput);
      return undefined;
    case 'host.reorderRequests':
      await reorderRequestsForPlugin(payload as ReorderRequestsInput);
      return undefined;
    case 'host.createDocument':
      return createDocumentForPlugin(payload as CreateDocumentInput);
    case 'host.renameDocument':
      return renameDocumentForPlugin(payload as RenameDocumentInput);
    case 'host.deleteDocument':
      await deleteDocumentForPlugin(payload as DeleteDocumentInput);
      return undefined;
    case 'host.moveDocument':
      await moveDocumentForPlugin(payload as MoveDocumentInput);
      return undefined;
    case 'host.reorderDocuments':
      await reorderDocumentsForPlugin(payload as ReorderDocumentsInput);
      return undefined;
    case 'host.reorderContainerItems':
      await reorderContainerItemsForPlugin(payload as ReorderContainerItemsInput);
      return undefined;
    case 'host.listCollections':
      return listCollectionsForPlugin(
        (payload as { options?: LibraryListOptions } | undefined)?.options
      );
    case 'host.listFolders': {
      const { collectionId } = payload as { collectionId: number };
      return listFoldersForPlugin(collectionId);
    }
    case 'host.listRequests': {
      const { collectionId } = payload as { collectionId: number };
      return listRequestsForPlugin(collectionId);
    }
    case 'host.listDocuments': {
      const { collectionId } = payload as { collectionId: number };
      return listDocumentsForPlugin(collectionId);
    }
    case 'host.listLibraryTree':
      return listLibraryTreeForPlugin(
        (payload as { options?: LibraryListOptions } | undefined)?.options
      );
    case 'host.listWorkflows':
      return listWorkflowsForPlugin();
    case 'host.getWorkflow': {
      const { workflowId } = payload as { workflowId: number };
      return getWorkflowForPlugin(workflowId);
    }
    case 'host.createWorkflow':
      return createWorkflowForPlugin(
        (payload as { input: Parameters<typeof createWorkflowForPlugin>[0] }).input
      );
    case 'host.updateWorkflow':
      return updateWorkflowForPlugin(
        (payload as { input: Parameters<typeof updateWorkflowForPlugin>[0] }).input
      );
    case 'host.renameWorkflow': {
      const { workflowId, name } = payload as { workflowId: number; name: string };
      return renameWorkflowForPlugin(workflowId, name);
    }
    case 'host.deleteWorkflow': {
      const { workflowId } = payload as { workflowId: number };
      await deleteWorkflowForPlugin(workflowId);
      return undefined;
    }
    case 'host.listCollectionRequests': {
      const { collectionId, folderId } = payload as {
        collectionId: number;
        folderId?: number | null;
      };
      return listCollectionRequestsForPlugin(collectionId, folderId);
    }
    case 'host.getCollectionMetadata': {
      const { collectionId } = payload as { collectionId: number };
      return getCollectionMetadataForPlugin(collectionId);
    }
    case 'host.sendHttpRequest':
      return sendHttpRequestForPlugin((payload as { input: never }).input);
    case 'commands.execute': {
      const {
        pluginId: targetPluginId,
        commandId,
        args
      } = payload as {
        pluginId?: string;
        commandId: string;
        args?: unknown[];
      };
      const ownerId = targetPluginId ?? pluginId;
      if (ownerId !== 'harborclient') {
        throw new Error(`Unsupported commands.execute target: ${ownerId}`);
      }
      logImportVerbose('hostBridge commands.execute start', { commandId, args });
      await executeHostPluginCommand(commandId, ...(args ?? []));
      logImportVerbose('hostBridge commands.execute ok', { commandId });
      return undefined;
    }
    case 'webpage.open':
    case 'webpage.focus':
    case 'webpage.close':
    case 'webpage.query':
    case 'webpage.evaluate':
    case 'webpage.injectScript':
    case 'webpage.injectStylesheet':
      return executePluginWebpageBridge(op, payload);
    case 'liveServers.list':
      return listLiveServersForPlugin();
    case 'liveServers.get':
      return getLiveServerForPlugin((payload as { idOrUuid: number | string }).idOrUuid);
    case 'liveServers.create':
      return createLiveServerForPlugin(
        (payload as { input: Parameters<typeof createLiveServerForPlugin>[0] }).input
      );
    case 'liveServers.update':
      return updateLiveServerForPlugin(
        (payload as { input: Parameters<typeof updateLiveServerForPlugin>[0] }).input
      );
    case 'liveServers.delete': {
      await deleteLiveServerForPlugin((payload as { id: number }).id);
      return undefined;
    }
    case 'liveServers.start':
      return startLiveServerForPlugin(
        (payload as { input: Parameters<typeof startLiveServerForPlugin>[0] }).input
      );
    case 'liveServers.stop': {
      await stopLiveServerForPlugin(
        (payload as { query: Parameters<typeof stopLiveServerForPlugin>[0] }).query
      );
      return undefined;
    }
    case 'liveServers.listRunning':
      return listRunningLiveServersForPlugin();
    case 'liveServers.getStatus':
      return getLiveServerStatusForPlugin(
        (payload as { query: Parameters<typeof getLiveServerStatusForPlugin>[0] }).query
      );
    case 'liveServers.getLogs':
      return getLiveServerLogsForPlugin(
        (payload as { query: Parameters<typeof getLiveServerLogsForPlugin>[0] }).query
      );
    case 'liveServers.clearLogs': {
      await clearLiveServerLogsForPlugin(
        (payload as { query: Parameters<typeof clearLiveServerLogsForPlugin>[0] }).query
      );
      return undefined;
    }
    default:
      throw new Error(`Unsupported plugin host bridge invoke operation: ${op}`);
  }
}

/**
 * Subscribes to plugin broker events routed through the preload bridge.
 */
export function startPluginBridgeHost(): () => void {
  const unsubContributions = window.api.onPluginsContributions((message) => {
    applyContributionMessage(message as ContributionMessage);
  });
  const unsubImportHandlers = window.api.onPluginsImportHandlers((message) => {
    applyImportHandlerMessage(message as ImportHandlerMessage);
  });
  const unsubHostBridge = window.api.onPluginsHostBridge((message) => {
    void (async () => {
      try {
        await handlePluginHostBridge(message as HostBridgeMessage);
      } catch (error) {
        const hostMessage = message as HostBridgeMessage;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[import] hostBridge failed', {
          pluginId: hostMessage.pluginId,
          op: hostMessage.op,
          error: errorMessage
        });
        void window.api.logVerbose('hostBridge failed', {
          pluginId: hostMessage.pluginId,
          op: hostMessage.op,
          error: errorMessage
        });
      }
    })();
  });
  const unsubHostBridgeInvoke = window.api.onPluginsHostBridgeInvoke((message) => {
    void (async () => {
      try {
        const result = await handlePluginHostBridgeInvoke(message as HostBridgeInvokeMessage);
        window.api.completePluginHostBridge({
          requestId: message.requestId,
          ok: true,
          result
        });
      } catch (error) {
        window.api.completePluginHostBridge({
          requestId: message.requestId,
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })();
  });
  const unsubSidebarSelection = startSidebarSelectionStoreSubscription();
  return () => {
    unsubContributions();
    unsubImportHandlers();
    unsubHostBridge();
    unsubHostBridgeInvoke();
    unsubSidebarSelection();
  };
}
