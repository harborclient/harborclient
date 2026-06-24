import toast from 'react-hot-toast';
import * as React from 'react';
import type {
  PluginContext,
  PluginManifest,
  PluginPermission,
  Disposable
} from '#/shared/plugin/types';
import {
  registerCollectionSettingsTabContribution,
  registerContextMenuItemContribution,
  registerFooterPanelContribution,
  registerMainViewContribution,
  registerMenuItemContribution,
  registerRequestTabContribution,
  registerRequestToolbarActionContribution,
  registerResponseTabContribution,
  registerSettingsSectionContribution,
  registerSidebarPanelContribution,
  registerSidebarSectionContribution,
  registerStatusBarItemContribution,
  registerThemeContribution
} from '#/renderer/src/plugins/registry';
import { pluginContributionId, pluginSettingsSectionId } from '#/shared/plugin/types';

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

  const assertPermission = (permission: PluginPermission): void => {
    if (!permissions.has(permission)) {
      throw new Error(`Plugin ${pluginId} lacks permission: ${permission}`);
    }
  };

  const assertUi = (): void => assertPermission('ui');

  return {
    react: React,
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
      }
    },
    commands: {
      register: (id, handler) => {
        assertUi();
        assertManifestContribution(manifest, 'commands', id);
        return registerCommand(pluginId, id, handler);
      },
      execute: async (id, ...args) => {
        const [ownerId, commandId] = id.includes(':') ? id.split(':', 2) : [pluginId, id];
        await executePluginCommand(ownerId, commandId, ...args);
      }
    },
    themes: {
      register: (theme) => {
        assertUi();
        assertManifestContribution(manifest, 'themes', theme.id);
        return registerThemeContribution(pluginId, theme);
      },
      getActive: async () => {
        const theme = await window.api.getTheme();
        if (theme.startsWith('plugin:')) {
          const [, activePluginId, themeId] = theme.split(':');
          return { source: 'plugin', pluginId: activePluginId, themeId };
        }
        return { source: 'builtin', id: theme as 'light' | 'dark' | 'system' | 'high-contrast' };
      },
      onDidChange: (listener) => {
        let active = true;
        const poll = async (): Promise<void> => {
          if (!active) return;
          const theme = await window.api.getTheme();
          if (theme.startsWith('plugin:')) {
            const [, activePluginId, themeId] = theme.split(':');
            listener({ source: 'plugin', pluginId: activePluginId, themeId });
          } else {
            listener({
              source: 'builtin',
              id: theme as 'light' | 'dark' | 'system' | 'high-contrast'
            });
          }
        };
        void poll();
        const interval = window.setInterval(() => {
          void poll();
        }, 1000);
        return {
          dispose: () => {
            active = false;
            window.clearInterval(interval);
          }
        };
      }
    },
    ui: {
      registerSettingsSection: (section) => {
        assertUi();
        assertManifestContribution(manifest, 'settingsSections', section.id);
        return registerSettingsSectionContribution(pluginId, {
          id: pluginSettingsSectionId(pluginId, section.id),
          title: section.title,
          Component: section.Component
        });
      },
      registerSidebarPanel: (panel) => {
        assertUi();
        assertManifestContribution(manifest, 'sidebarPanels', panel.id);
        return registerSidebarPanelContribution(pluginId, {
          id: pluginContributionId(pluginId, panel.id),
          title: panel.title,
          icon: panel.icon,
          order: panel.order,
          Component: panel.Component
        });
      },
      registerSidebarSection: (section) => {
        assertUi();
        assertManifestContribution(manifest, 'sidebarSections', section.id);
        return registerSidebarSectionContribution(pluginId, {
          id: pluginContributionId(pluginId, section.id),
          title: section.title,
          order: section.order,
          Component: section.Component
        });
      },
      registerMainView: (view) => {
        assertUi();
        assertManifestContribution(manifest, 'mainViews', view.id);
        return registerMainViewContribution(pluginId, {
          id: pluginContributionId(pluginId, view.id),
          title: view.title,
          Component: view.Component
        });
      },
      registerRequestTab: (tab) => {
        assertUi();
        assertManifestContribution(manifest, 'requestTabs', tab.id);
        return registerRequestTabContribution(pluginId, {
          id: pluginContributionId(pluginId, tab.id),
          title: tab.title,
          order: tab.order,
          Component: tab.Component
        });
      },
      registerResponseTab: (tab) => {
        assertUi();
        assertManifestContribution(manifest, 'responseTabs', tab.id);
        return registerResponseTabContribution(pluginId, {
          id: pluginContributionId(pluginId, tab.id),
          title: tab.title,
          order: tab.order,
          when: tab.when,
          Component: tab.Component
        });
      },
      registerCollectionSettingsTab: (tab) => {
        assertUi();
        assertManifestContribution(manifest, 'collectionSettingsTabs', tab.id);
        return registerCollectionSettingsTabContribution(pluginId, {
          id: pluginContributionId(pluginId, tab.id),
          title: tab.title,
          order: tab.order,
          Component: tab.Component
        });
      },
      registerFooterPanel: (panel) => {
        assertUi();
        assertManifestContribution(manifest, 'footerPanels', panel.id);
        return registerFooterPanelContribution(pluginId, {
          id: pluginContributionId(pluginId, panel.id),
          title: panel.title,
          Component: panel.Component
        });
      },
      registerMenuItem: (item) => {
        assertUi();
        assertManifestMenuCommand(manifest, item.command);
        return registerMenuItemContribution(pluginId, item);
      },
      registerRequestToolbarAction: (action) => {
        assertUi();
        assertManifestContribution(manifest, 'requestToolbarActions', action.id);
        return registerRequestToolbarActionContribution(pluginId, action);
      },
      registerContextMenuItem: (item) => {
        assertUi();
        assertManifestContribution(manifest, 'contextMenus', item.id);
        return registerContextMenuItemContribution(pluginId, item);
      },
      registerStatusBarItem: (item) => {
        assertUi();
        assertManifestContribution(manifest, 'statusBarItems', item.id);
        return registerStatusBarItemContribution(pluginId, {
          id: pluginContributionId(pluginId, item.id),
          alignment: item.alignment,
          order: item.order,
          Component: item.Component
        });
      },
      showToast: (message, options) => {
        assertUi();
        toast(message, { duration: options?.duration ?? 2000 });
      }
    }
  };
}
