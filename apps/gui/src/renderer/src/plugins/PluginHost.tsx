import { useEffect } from 'react';
import {
  reloadAllPlugins,
  reloadPlugin,
  unloadAllPlugins,
  notifyAgentReady,
  rejectAgentReady
} from './pluginLoader';
import { registerHostPluginCommands } from './hostCommands';
import { startPluginMenuSync } from './pluginMenuSync';
import { startThemeMenuSync } from './themeMenuSync';
import { startPluginBridgeHost } from './pluginBridgeHost';

/**
 * Mounts the plugin host lifecycle and hot-reload listeners.
 */
export function PluginHost(): null {
  /**
   * Loads enabled plugins on mount and when the plugin list changes.
   */
  useEffect(() => {
    const unregisterHostCommands = registerHostPluginCommands();
    const stopMenuSync = startPluginMenuSync();
    const stopThemeMenuSync = startThemeMenuSync();
    const stopBridgeHost = startPluginBridgeHost();
    const unsubscribeAgentReady = window.api.onPluginsAgentReady(({ pluginId }) => {
      notifyAgentReady(pluginId);
    });
    const unsubscribeAgentFailed = window.api.onPluginsAgentFailed(({ pluginId, message }) => {
      rejectAgentReady(pluginId, message);
    });
    let active = true;
    void reloadAllPlugins().catch((error) => {
      console.error('Failed to load plugins:', error);
    });
    const unsubscribe = window.api.onPluginsChanged((pluginId) => {
      if (!active) {
        return;
      }
      void reloadPlugin(pluginId).catch(() => {
        // Activation failures are logged in handleActivationFailure.
      });
    });
    return () => {
      active = false;
      unregisterHostCommands();
      stopMenuSync();
      stopThemeMenuSync();
      stopBridgeHost();
      unsubscribeAgentReady();
      unsubscribeAgentFailed();
      unsubscribe();
      void unloadAllPlugins();
    };
  }, []);

  return null;
}
