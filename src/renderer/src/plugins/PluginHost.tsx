import { useEffect } from 'react';
import {
  reloadAllPlugins,
  reloadPlugin,
  unloadAllPlugins
} from '#/renderer/src/plugins/pluginLoader';
import { registerHostPluginCommands } from '#/renderer/src/plugins/hostCommands';
import { startPluginMenuSync } from '#/renderer/src/plugins/pluginMenuSync';

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
      unsubscribe();
      void unloadAllPlugins();
    };
  }, []);

  return null;
}
