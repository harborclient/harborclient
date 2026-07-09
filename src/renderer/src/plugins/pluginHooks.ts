import { useSyncExternalStore } from 'react';
import type {
  RegisteredCollectionSettingsTab,
  RegisteredContextMenuItem,
  RegisteredFooterPanel,
  RegisteredMainView,
  RegisteredMenuItem,
  RegisteredPluginTheme,
  RegisteredRequestTab,
  RegisteredRequestToolbarAction,
  RegisteredScriptEditorAction,
  RegisteredResponseTab,
  RegisteredSettingsSection,
  RegisteredSidebarPanel,
  RegisteredSidebarSection,
  RegisteredStatusBarItem
} from '#/shared/plugin/types';
import {
  getRegisteredCollectionSettingsTabs,
  getRegisteredContextMenuItems,
  getRegisteredFooterPanels,
  getRegisteredMainViews,
  getRegisteredMenuItems,
  getRegisteredPluginThemes,
  getRegisteredRequestTabs,
  getRegisteredRequestToolbarActions,
  getRegisteredScriptEditorActions,
  getRegisteredResponseTabs,
  getRegisteredSettingsSections,
  getRegisteredSidebarPanels,
  getRegisteredSidebarSections,
  getRegisteredStatusBarItems,
  subscribePluginRegistry
} from '#/renderer/src/plugins/registry';

/**
 * Subscribes to plugin registry settings sections.
 */
export function usePluginSettingsSections(): RegisteredSettingsSection[] {
  return useSyncExternalStore(subscribePluginRegistry, getRegisteredSettingsSections, () => []);
}

/**
 * Subscribes to plugin registry themes.
 */
export function usePluginThemes(): RegisteredPluginTheme[] {
  return useSyncExternalStore(subscribePluginRegistry, getRegisteredPluginThemes, () => []);
}

/**
 * Subscribes to plugin sidebar section contributions.
 */
export function usePluginSidebarSections(): RegisteredSidebarSection[] {
  return useSyncExternalStore(subscribePluginRegistry, getRegisteredSidebarSections, () => []);
}

/**
 * Subscribes to plugin sidebar panel contributions.
 */
export function usePluginSidebarPanels(): RegisteredSidebarPanel[] {
  return useSyncExternalStore(subscribePluginRegistry, getRegisteredSidebarPanels, () => []);
}

/**
 * Subscribes to plugin main view contributions.
 */
export function usePluginMainViews(): RegisteredMainView[] {
  return useSyncExternalStore(subscribePluginRegistry, getRegisteredMainViews, () => []);
}

/**
 * Subscribes to plugin request editor tab contributions.
 */
export function usePluginRequestTabs(): RegisteredRequestTab[] {
  return useSyncExternalStore(subscribePluginRegistry, getRegisteredRequestTabs, () => []);
}

/**
 * Subscribes to plugin response viewer tab contributions.
 */
export function usePluginResponseTabs(): RegisteredResponseTab[] {
  return useSyncExternalStore(subscribePluginRegistry, getRegisteredResponseTabs, () => []);
}

/**
 * Subscribes to plugin collection settings tab contributions.
 */
export function usePluginCollectionSettingsTabs(): RegisteredCollectionSettingsTab[] {
  return useSyncExternalStore(
    subscribePluginRegistry,
    getRegisteredCollectionSettingsTabs,
    () => []
  );
}

/**
 * Subscribes to plugin footer panel contributions.
 */
export function usePluginFooterPanels(): RegisteredFooterPanel[] {
  return useSyncExternalStore(subscribePluginRegistry, getRegisteredFooterPanels, () => []);
}

/**
 * Subscribes to plugin status bar item contributions.
 */
export function usePluginStatusBarItems(): RegisteredStatusBarItem[] {
  return useSyncExternalStore(subscribePluginRegistry, getRegisteredStatusBarItems, () => []);
}

/**
 * Subscribes to plugin menu item contributions.
 */
export function usePluginMenuItems(): RegisteredMenuItem[] {
  return useSyncExternalStore(subscribePluginRegistry, getRegisteredMenuItems, () => []);
}

/**
 * Subscribes to plugin request toolbar action contributions.
 */
export function usePluginRequestToolbarActions(): RegisteredRequestToolbarAction[] {
  return useSyncExternalStore(
    subscribePluginRegistry,
    getRegisteredRequestToolbarActions,
    () => []
  );
}

/**
 * Subscribes to plugin script editor row action contributions for one phase.
 *
 * @param phase - Script phase whose rows should receive the actions.
 */
export function usePluginScriptEditorActions(
  phase: 'pre' | 'post'
): RegisteredScriptEditorAction[] {
  const actions = useSyncExternalStore(
    subscribePluginRegistry,
    getRegisteredScriptEditorActions,
    () => []
  );

  return actions.filter(
    (action) => !action.phases || action.phases.length === 0 || action.phases.includes(phase)
  );
}

/**
 * Subscribes to plugin sidebar context menu item contributions.
 */
export function usePluginContextMenuItems(): RegisteredContextMenuItem[] {
  return useSyncExternalStore(subscribePluginRegistry, getRegisteredContextMenuItems, () => []);
}
