import { getRegisteredMenuItems, subscribePluginRegistry } from './registry';

/**
 * Pushes serialized menu contributions to the main process for menu merge.
 */
/** Last serialized menu payload sent to the main process. */
let lastSyncedMenuKey = '';

/**
 * Syncs plugin menu contributions to the main process when the payload changes.
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
  const nextKey = JSON.stringify(items);
  const unchanged = nextKey === lastSyncedMenuKey;
  if (unchanged) {
    return;
  }
  lastSyncedMenuKey = nextKey;
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
