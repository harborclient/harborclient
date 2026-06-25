import { store } from '#/renderer/src/store/redux';
import { openPluginView, setActiveSidebarPanel } from '#/renderer/src/store/slices/navigationSlice';
import { executePluginCommand, registerCommand } from '#/renderer/src/plugins/createPluginContext';
import { registerHostRequestCommands } from '#/renderer/src/plugins/hostRequestCommands';

const HOST_PLUGIN_ID = 'harborclient';

/**
 * Registers built-in host commands plugins can invoke through hc.commands.execute.
 */
export function registerHostPluginCommands(): () => void {
  const unregisterRequestCommands = registerHostRequestCommands();
  const disposables = [
    registerCommand(HOST_PLUGIN_ID, 'openMainView', (pluginId, viewId) => {
      if (typeof pluginId !== 'string' || typeof viewId !== 'string') {
        throw new Error('harborclient.openMainView requires pluginId and viewId strings.');
      }
      store.dispatch(openPluginView({ pluginId, viewId }));
    }),
    registerCommand(HOST_PLUGIN_ID, 'openSidebarPanel', (pluginId, panelId) => {
      if (typeof pluginId !== 'string' || typeof panelId !== 'string') {
        throw new Error('harborclient.openSidebarPanel requires pluginId and panelId strings.');
      }
      store.dispatch(setActiveSidebarPanel(`plugin:${pluginId}:${panelId}`));
    }),
    registerCommand(HOST_PLUGIN_ID, 'closeSidebarPanel', () => {
      store.dispatch(setActiveSidebarPanel(null));
    })
  ];

  return () => {
    unregisterRequestCommands();
    for (const disposable of disposables) {
      disposable.dispose();
    }
  };
}

/**
 * Executes a host-provided command by id.
 *
 * @param commandId - Host command id without the harborclient prefix.
 * @param args - Arguments passed to the handler.
 */
export async function executeHostPluginCommand(
  commandId: string,
  ...args: unknown[]
): Promise<void> {
  await executePluginCommand(HOST_PLUGIN_ID, commandId, ...args);
}
