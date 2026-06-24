import { getRegisteredMenuItems, subscribePluginRegistry } from '#/renderer/src/plugins/registry';

/**
 * Pushes serialized menu contributions to the main process for menu merge.
 */
async function syncMenuContributions(): Promise<void> {
  const items = getRegisteredMenuItems().map((entry) => ({
    pluginId: entry.pluginId,
    menu: entry.menu,
    command: entry.command,
    label: entry.label,
    group: entry.group,
    order: entry.order
  }));
  await window.api.setPluginMenuContributions(items);
}

/**
 * Subscribes to plugin menu registry changes and keeps the application menu in sync.
 */
export function startPluginMenuSync(): () => void {
  void syncMenuContributions();
  const unsubscribe = subscribePluginRegistry(() => {
    void syncMenuContributions();
  });
  return unsubscribe;
}
