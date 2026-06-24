import type { ContextMenuTarget, RegisteredContextMenuItem } from '#/shared/plugin/types';
import type { MenuItem } from '#/renderer/src/components/RowActionsMenu';
import { executePluginCommand } from '#/renderer/src/plugins/createPluginContext';

/**
 * Builds row action menu groups from plugin context menu contributions.
 *
 * @param target - Sidebar row type being rendered.
 * @param payload - Command payload passed to the plugin handler.
 * @param items - Registered plugin context menu items.
 */
export function buildPluginContextMenuGroups(
  target: ContextMenuTarget,
  payload: unknown,
  items: RegisteredContextMenuItem[]
): MenuItem[][] {
  const matching = items.filter((item) => {
    const when = Array.isArray(item.when) ? item.when : [item.when];
    return when.includes(target);
  });
  if (matching.length === 0) {
    return [];
  }

  const grouped = new Map<string, MenuItem[]>();
  for (const item of matching) {
    const groupKey = item.group ?? 'plugin';
    const groupItems = grouped.get(groupKey) ?? [];
    groupItems.push({
      label: item.title,
      onSelect: () => {
        void executePluginCommand(item.pluginId, item.command, payload);
      }
    });
    grouped.set(groupKey, groupItems);
  }

  return [...grouped.values()];
}
