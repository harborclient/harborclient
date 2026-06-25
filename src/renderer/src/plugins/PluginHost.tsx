import { useEffect, useRef } from 'react';
import {
  reloadAllPlugins,
  reloadPlugin,
  unloadAllPlugins
} from '#/renderer/src/plugins/pluginLoader';
import { registerHostPluginCommands } from '#/renderer/src/plugins/hostCommands';
import { startPluginMenuSync } from '#/renderer/src/plugins/pluginMenuSync';
import { store } from '#/renderer/src/store/redux';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/modals/dialogHelpers';

/**
 * Shows a blocking alert for a plugin load failure after initial boot.
 *
 * @param pluginId - Plugin manifest id.
 * @param error - Thrown activation error.
 */
async function notifyPluginLoadFailure(pluginId: string, error: unknown): Promise<void> {
  const plugins = await window.api.listPlugins();
  const plugin = plugins.find((entry) => entry.id === pluginId);
  const name = plugin?.name ?? pluginId;
  showAlert(
    store.dispatch,
    formatErrorMessage(error, `Plugin "${name}" failed to activate.`),
    'Plugin error'
  );
}

/**
 * Mounts the plugin host lifecycle and hot-reload listeners.
 */
export function PluginHost(): null {
  const initialLoadCompleteRef = useRef(false);

  /**
   * Loads enabled plugins on mount and when the plugin list changes.
   */
  useEffect(() => {
    const unregisterHostCommands = registerHostPluginCommands();
    const stopMenuSync = startPluginMenuSync();
    let active = true;
    void reloadAllPlugins()
      .catch((error) => {
        console.error('Failed to load plugins:', error);
      })
      .finally(() => {
        if (active) {
          initialLoadCompleteRef.current = true;
        }
      });
    const unsubscribe = window.api.onPluginsChanged((pluginId) => {
      if (!active) {
        return;
      }
      void reloadPlugin(pluginId).catch((error) => {
        console.error(`Failed to reload plugin ${pluginId}:`, error);
        if (initialLoadCompleteRef.current) {
          void notifyPluginLoadFailure(pluginId, error);
        }
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
