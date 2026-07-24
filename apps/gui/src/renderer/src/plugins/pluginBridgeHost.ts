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
  RegisteredSidebarSection,
  RegisteredStatusBarItem,
  ThemeContribution
} from '#/shared/plugin/types';
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
  registerResponseTabContribution,
  registerSettingsSectionContribution,
  registerSidebarPanelContribution,
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
  createEnvironmentWithVariables,
  updateEnvironmentVariables
} from './hostEnvironmentCommands';
import toast from 'react-hot-toast';
import { store } from '#/renderer/src/store/redux';
import { setHostedModal } from '#/renderer/src/store/slices/modalsSlice';
import {
  registerBridgedImportHandler,
  unregisterBridgedImportHandler
} from './pluginImportHandlers';
import { logImportVerbose } from '#/renderer/src/import/importVerboseLog';

type ContributionKind =
  | 'settingsSections'
  | 'themes'
  | 'sidebarPanels'
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
  void pluginId;

  switch (op) {
    case 'host.createEnvironmentWithVariables': {
      const { name, variables } = payload as {
        name: string;
        variables: Parameters<typeof createEnvironmentWithVariables>[1];
      };
      return createEnvironmentWithVariables(name, variables);
    }
    case 'host.createCollection':
      return createCollectionFromPlugin((payload as { payload: never }).payload);
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
  return () => {
    unsubContributions();
    unsubImportHandlers();
    unsubHostBridge();
    unsubHostBridgeInvoke();
  };
}
