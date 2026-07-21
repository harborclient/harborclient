import toast from 'react-hot-toast';
import * as React from 'react';
import '#/shared/plugin/databaseTypes';
import type {
  PluginContext,
  PluginManifest,
  PluginPermission,
  Disposable
} from '#/shared/plugin/types';
import {
  activeThemeKey,
  pluginContributionId,
  pluginSettingsSectionId,
  toActiveTheme
} from '#/shared/plugin/types';
import type { ThemeSource } from '#/shared/types';
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
  setFooterPanelIndicatorState
} from './registry';
import {
  createEnvironmentWithVariables,
  updateEnvironmentVariables
} from './hostEnvironmentCommands';
import { store } from '#/renderer/src/store/redux';
import { setHostedModal } from '#/renderer/src/store/slices/modalsSlice';
import {
  createCollectionFromPlugin,
  getCollectionMetadataForPlugin,
  listCollectionRequestsForPlugin,
  loadSavedRequest,
  clearActiveResponse,
  logRequestToConsole,
  openRequestDraft,
  sendHttpRequestForPlugin,
  triggerSendRequest,
  type PluginConsoleLogPayload
} from './hostRequestCommands';
import { subscribePluginAfterSend } from './pluginAfterSendBus';
import { createPluginDatabaseApi } from '#/shared/plugin/pluginDatabaseApi';
import type { ImportHandler } from '#/shared/plugin/importHandlers';
import {
  normalizeImportExtensions,
  registerImportHandlerContribution
} from './pluginImportHandlers';

const commandHandlers = new Map<string, Set<(...args: unknown[]) => void | Promise<void>>>();

type ManifestContributionKey = keyof NonNullable<PluginManifest['contributes']>;

/**
 * Asserts that a contribution id is declared in the plugin manifest.
 *
 * @param manifest - Plugin manifest.
 * @param key - contributes.* key to inspect.
 * @param id - Contribution id from the registrar call.
 */
function assertManifestContribution(
  manifest: PluginManifest,
  key: ManifestContributionKey,
  id: string
): void {
  const entries = manifest.contributes?.[key];
  if (!Array.isArray(entries) || !entries.some((entry) => 'id' in entry && entry.id === id)) {
    throw new Error(`Contribution id "${id}" is not declared in manifest.contributes.${key}.`);
  }
}

/**
 * Asserts that a menu command is declared in manifest.contributes.menus.
 *
 * @param manifest - Plugin manifest.
 * @param command - Command id referenced by the menu item.
 */
function assertManifestMenuCommand(manifest: PluginManifest, command: string): void {
  const entries = manifest.contributes?.menus;
  if (!Array.isArray(entries) || !entries.some((entry) => entry.command === command)) {
    throw new Error(`Command "${command}" is not declared in manifest.contributes.menus.`);
  }
}

/**
 * Registers a command handler scoped to one plugin activation.
 *
 * @param pluginId - Plugin manifest id.
 * @param commandId - Command id declared in the manifest.
 * @param handler - Handler invoked when the command executes.
 */
export function registerCommand(
  pluginId: string,
  commandId: string,
  handler: (...args: unknown[]) => void | Promise<void>
): Disposable {
  const scopedId = `${pluginId}:${commandId}`;
  const handlers = commandHandlers.get(scopedId) ?? new Set();
  handlers.add(handler);
  commandHandlers.set(scopedId, handlers);
  return {
    dispose: () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        commandHandlers.delete(scopedId);
      }
    }
  };
}

/**
 * Executes a registered plugin command.
 *
 * @param pluginId - Plugin manifest id.
 * @param commandId - Command id declared in the manifest.
 * @param args - Arguments passed to the handler.
 */
export async function executePluginCommand(
  pluginId: string,
  commandId: string,
  ...args: unknown[]
): Promise<void> {
  const scopedId = `${pluginId}:${commandId}`;
  const handlers = commandHandlers.get(scopedId);
  if (!handlers) {
    throw new Error(`Unknown plugin command: ${scopedId}`);
  }
  for (const handler of handlers) {
    await handler(...args);
  }
}

/**
 * Builds the renderer plugin activation context for one plugin.
 *
 * @param pluginId - Plugin manifest id.
 * @param manifest - Parsed plugin manifest.
 */
export function createPluginContext(pluginId: string, manifest: PluginManifest): PluginContext {
  const subscriptions: Disposable[] = [];
  const permissions = new Set(manifest.permissions);

  /**
   * Wraps a disposable in an idempotent handle, auto-registers it on
   * {@link PluginContext.subscriptions}, and returns it.
   *
   * Idempotency keeps the legacy `subscriptions.push(register())` pattern and
   * manual `dispose()` safe — repeated dispose calls never double-fire cleanup.
   *
   * @param disposable - Disposable returned by a registration or subscribe API.
   * @returns Tracked disposable handle.
   */
  const track = (disposable: Disposable): Disposable => {
    let disposed = false;
    const tracked: Disposable = {
      dispose: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        const index = subscriptions.indexOf(tracked);
        if (index >= 0) {
          subscriptions.splice(index, 1);
        }
        disposable.dispose();
      }
    };
    subscriptions.push(tracked);
    return tracked;
  };

  const assertPermission = (permission: PluginPermission): void => {
    if (!permissions.has(permission)) {
      throw new Error(`Plugin ${pluginId} lacks permission: ${permission}`);
    }
  };

  const assertUi = (): void => assertPermission('ui');

  const assertNetwork = (): void => {
    assertPermission('network');
    const general = store.getState().settings.general;
    if (!general.allowScriptNetworkRequests && !general.allowedNetworkPlugins.includes(pluginId)) {
      throw new Error(
        `Plugin ${pluginId} cannot make network requests. Enable "Allow script network requests" in Settings → General or allow this plugin during install.`
      );
    }
  };

  /**
   * Returns whether an IPC error indicates the plugin main runtime is inactive.
   *
   * @param error - Failure from {@link window.api.invokePluginMain}.
   */
  const isMainInactiveError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('Plugin main runtime is not active');
  };

  /**
   * Invokes a plugin main IPC channel, reactivating the main runtime once when needed.
   *
   * @param targetPluginId - Plugin manifest id.
   * @param channel - Registered channel name.
   * @param args - Arguments forwarded to the main handler.
   */
  const invokePluginMainWithRetry = async (
    targetPluginId: string,
    channel: string,
    args: unknown[]
  ): Promise<unknown> => {
    try {
      return await window.api.invokePluginMain(targetPluginId, channel, args);
    } catch (error) {
      if (!isMainInactiveError(error)) {
        throw error;
      }
      await window.api.activatePluginMain(targetPluginId);
      return window.api.invokePluginMain(targetPluginId, channel, args);
    }
  };

  return {
    pluginId,
    react: React as PluginContext['react'],
    subscriptions,
    storage: {
      get: async <T>(key: string) => {
        assertPermission('storage');
        return (await window.api.getPluginStorage(pluginId, key)) as T | undefined;
      },
      set: async <T>(key: string, value: T) => {
        assertPermission('storage');
        await window.api.setPluginStorage(pluginId, key, value);
      }
    },
    database: createPluginDatabaseApi({
      query: (mode, sql, params, txnId) => {
        assertPermission('database');
        return window.api.pluginDatabaseQuery(pluginId, mode, sql, params, txnId);
      },
      exec: (sql) => {
        assertPermission('database');
        return window.api.pluginDatabaseExec(pluginId, sql);
      },
      beginTransaction: () => {
        assertPermission('database');
        return window.api.pluginDatabaseTxBegin(pluginId);
      },
      endTransaction: (txnId, action) => {
        assertPermission('database');
        return window.api.pluginDatabaseTxEnd(pluginId, txnId, action);
      }
    }),
    fs: {
      pickFile: async (options) => {
        assertPermission('filesystem:pick');
        return window.api.pluginFsPickFile(pluginId, options);
      },
      pickDirectory: async (defaultPath) => {
        assertPermission('filesystem:pick');
        return window.api.pluginFsPickDirectory(pluginId, defaultPath ?? '');
      },
      saveFile: async (content, options) => {
        assertPermission('filesystem:pick');
        return window.api.pluginFsSaveFile(pluginId, content, options);
      },
      readFile: async (path) => {
        assertPermission('filesystem:read');
        return window.api.pluginFsReadFile(pluginId, path);
      },
      writeFile: async (path, content) => {
        assertPermission('filesystem:write');
        await window.api.pluginFsWriteFile(pluginId, path, content);
      },
      watchFile: (path, listener) => {
        assertPermission('filesystem:read');
        const unsubscribe = window.api.pluginFsWatchFile(pluginId, path, () => {
          listener(path);
        });
        return track({
          dispose: () => {
            unsubscribe();
          }
        });
      }
    },
    commands: {
      register: (id, handler) => {
        assertUi();
        assertManifestContribution(manifest, 'commands', id);
        return track(registerCommand(pluginId, id, handler));
      },
      execute: async (id, ...args) => {
        const [ownerId, commandId] = id.includes(':') ? id.split(':', 2) : [pluginId, id];
        await executePluginCommand(ownerId, commandId, ...args);
      }
    },
    actions: {
      register: (namespace, handlers) => {
        assertUi();
        const disposables: Disposable[] = [];
        for (const [label, handler] of Object.entries(handlers)) {
          const commandId = `action:${namespace}:${label}`;
          disposables.push(registerCommand(pluginId, commandId, handler));
          disposables.push(
            registerActionContribution(pluginId, {
              namespace,
              label,
              commandId
            })
          );
        }
        return track({
          dispose: () => {
            for (const disposable of disposables) {
              disposable.dispose();
            }
          }
        });
      }
    },
    themes: {
      register: (theme) => {
        assertUi();
        assertManifestContribution(manifest, 'themes', theme.id);
        return track(registerThemeContribution(pluginId, theme));
      },
      getActive: async () => toActiveTheme(await window.api.getTheme()),
      onDidChange: (listener) => {
        let lastKey: string | null = null;

        /**
         * Notifies the listener when the active theme differs from the last emission.
         *
         * @param theme - Persisted theme preference.
         */
        const notify = (theme: ThemeSource): void => {
          const active = toActiveTheme(theme);
          const key = activeThemeKey(active);
          if (lastKey === key) {
            return;
          }
          lastKey = key;
          listener(active);
        };

        void window.api.getTheme().then(notify);
        const unsubscribe = window.api.onThemeChanged(notify);
        return track({
          dispose: () => {
            unsubscribe();
          }
        });
      }
    },
    ui: {
      registerSettingsSection: (section) => {
        assertUi();
        assertManifestContribution(manifest, 'settingsSections', section.id);
        return track(
          registerSettingsSectionContribution(pluginId, {
            id: pluginSettingsSectionId(pluginId, section.id),
            title: section.title,
            contributionId: section.id
          })
        );
      },
      registerSidebarPanel: (panel) => {
        assertUi();
        assertManifestContribution(manifest, 'sidebarPanels', panel.id);
        return track(
          registerSidebarPanelContribution(pluginId, {
            id: pluginContributionId(pluginId, panel.id),
            title: panel.title,
            icon: panel.icon,
            order: panel.order,
            contributionId: panel.id
          })
        );
      },
      registerSidebarSection: (section) => {
        assertUi();
        assertManifestContribution(manifest, 'sidebarSections', section.id);
        return track(
          registerSidebarSectionContribution(pluginId, {
            id: pluginContributionId(pluginId, section.id),
            title: section.title,
            order: section.order,
            contributionId: section.id,
            hasHeaderActions: Boolean(section.headerActions)
          })
        );
      },
      registerMainView: (view) => {
        assertUi();
        assertManifestContribution(manifest, 'mainViews', view.id);
        const rawIcon = (view as unknown as { icon?: unknown }).icon;
        const iconName = typeof rawIcon === 'string' ? rawIcon.trim() : '';
        return track(
          registerMainViewContribution(pluginId, {
            id: pluginContributionId(pluginId, view.id),
            title: view.title,
            contributionId: view.id,
            ...(iconName.length > 0 ? { icon: iconName } : {})
          })
        );
      },
      registerModal: (modal) => {
        assertUi();
        assertManifestContribution(manifest, 'modals', modal.id);
        return track(
          registerModalContribution(pluginId, {
            id: pluginContributionId(pluginId, modal.id),
            title: modal.title,
            contributionId: modal.id
          })
        );
      },
      registerRequestTab: (tab) => {
        assertUi();
        assertManifestContribution(manifest, 'requestTabs', tab.id);
        return track(
          registerRequestTabContribution(pluginId, {
            id: pluginContributionId(pluginId, tab.id),
            title: tab.title,
            order: tab.order,
            contributionId: tab.id
          })
        );
      },
      registerResponseTab: (tab) => {
        assertUi();
        assertManifestContribution(manifest, 'responseTabs', tab.id);
        return track(
          registerResponseTabContribution(pluginId, {
            id: pluginContributionId(pluginId, tab.id),
            title: tab.title,
            order: tab.order,
            when: tab.when,
            contributionId: tab.id
          })
        );
      },
      registerCollectionSettingsTab: (tab) => {
        assertUi();
        assertManifestContribution(manifest, 'collectionSettingsTabs', tab.id);
        return track(
          registerCollectionSettingsTabContribution(pluginId, {
            id: pluginContributionId(pluginId, tab.id),
            title: tab.title,
            order: tab.order,
            contributionId: tab.id
          })
        );
      },
      registerFooterPanel: (panel) => {
        assertUi();
        assertManifestContribution(manifest, 'footerPanels', panel.id);
        return track(
          registerFooterPanelContribution(pluginId, {
            id: pluginContributionId(pluginId, panel.id),
            title: panel.title,
            contributionId: panel.id
          })
        );
      },
      setFooterPanelIndicator: (panelId, state) => {
        assertUi();
        assertManifestContribution(manifest, 'footerPanels', panelId);
        setFooterPanelIndicatorState(pluginId, panelId, state);
      },
      registerMenuItem: (item) => {
        assertUi();
        assertManifestMenuCommand(manifest, item.command);
        return track(registerMenuItemContribution(pluginId, item));
      },
      registerRequestToolbarAction: (action) => {
        assertUi();
        assertManifestContribution(manifest, 'requestToolbarActions', action.id);
        return track(registerRequestToolbarActionContribution(pluginId, action));
      },
      registerScriptEditorAction: (action) => {
        assertUi();
        assertManifestContribution(manifest, 'scriptEditorActions', action.id);
        return track(registerScriptEditorActionContribution(pluginId, action));
      },
      registerContextMenuItem: (item) => {
        assertUi();
        assertManifestContribution(manifest, 'contextMenus', item.id);
        return track(registerContextMenuItemContribution(pluginId, item));
      },
      registerStatusBarItem: (item) => {
        assertUi();
        assertManifestContribution(manifest, 'statusBarItems', item.id);
        return track(
          registerStatusBarItemContribution(pluginId, {
            id: pluginContributionId(pluginId, item.id),
            alignment: item.alignment,
            order: item.order,
            contributionId: item.id
          })
        );
      },
      showToast: (message, options) => {
        assertUi();
        toast(message, { duration: options?.duration ?? 2000 });
      },
      openModal: (modalId, context) => {
        assertUi();
        assertManifestContribution(manifest, 'modals', modalId);
        store.dispatch(
          setHostedModal({
            pluginId,
            contributionId: modalId,
            context
          })
        );
      },
      closeModal: (modalId) => {
        assertUi();
        const current = store.getState().modals.hostedModal;
        if (!current || current.pluginId !== pluginId) {
          return;
        }
        if (modalId && current.contributionId !== modalId) {
          return;
        }
        store.dispatch(setHostedModal(null));
      }
    },
    http: {
      onAfterSend: (handler) => {
        assertPermission('http');
        return track(subscribePluginAfterSend(handler));
      }
    },
    ipc: {
      invoke: async <T>(channel: string, ...args: unknown[]) => {
        assertPermission('ipc');
        return (await invokePluginMainWithRetry(pluginId, channel, args)) as T;
      }
    },
    host: {
      openRequestDraft: async (payload) => {
        assertUi();
        openRequestDraft(payload);
      },
      loadRequest: async (requestId) => {
        assertUi();
        loadSavedRequest(requestId);
      },
      sendRequest: async () => {
        assertUi();
        triggerSendRequest();
      },
      createEnvironmentWithVariables: async (name, variables) => {
        assertUi();
        return createEnvironmentWithVariables(name, variables);
      },
      updateEnvironmentVariables: async (environmentId, variables) => {
        assertUi();
        await updateEnvironmentVariables(environmentId, variables);
      },
      createCollection: async (payload) => {
        assertUi();
        return createCollectionFromPlugin(payload);
      },
      listCollectionRequests: async (collectionId, folderId) => {
        assertUi();
        if (typeof collectionId !== 'number') {
          throw new Error('harborclient.listCollectionRequests requires a numeric collection id.');
        }
        return listCollectionRequestsForPlugin(collectionId, folderId);
      },
      getCollectionMetadata: async (collectionId) => {
        assertUi();
        if (typeof collectionId !== 'number') {
          throw new Error('harborclient.getCollectionMetadata requires a numeric collection id.');
        }
        return getCollectionMetadataForPlugin(collectionId);
      },
      logRequestToConsole: async (payload) => {
        assertUi();
        logRequestToConsole(payload as PluginConsoleLogPayload);
      },
      sendHttpRequest: async (input) => {
        assertNetwork();
        return sendHttpRequestForPlugin(input);
      },
      clearResponse: async () => {
        assertUi();
        clearActiveResponse();
      }
    },
    imports: {
      registerHandler: (extensions: string | string[], handler: ImportHandler) => {
        assertUi();
        const normalizedExtensions = normalizeImportExtensions(extensions);
        if (normalizedExtensions.length === 0) {
          throw new Error(
            'At least one file extension is required for import handler registration.'
          );
        }
        return track(registerImportHandlerContribution(pluginId, normalizedExtensions, handler));
      }
    },
    mcp: {
      registerServer: () => {
        assertPermission('mcp');
        return track({ dispose: () => undefined });
      }
    }
  };
}
