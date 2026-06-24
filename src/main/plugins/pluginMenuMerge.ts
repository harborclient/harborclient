import type { MenuItemConstructorOptions } from 'electron';
import type { SerializableMenuContribution } from '#/shared/plugin/types';

/**
 * Merges plugin menu contributions into a built application menu template.
 *
 * @param template - Base menu template.
 * @param contributions - Plugin menu contributions sorted by menu/group/order.
 * @param onCommand - Invoked when a plugin menu item is clicked.
 */
export function mergePluginMenuItemsIntoTemplate(
  template: MenuItemConstructorOptions[],
  contributions: SerializableMenuContribution[],
  onCommand: (contribution: SerializableMenuContribution) => void
): void {
  const menuIndex = new Map<string, MenuItemConstructorOptions>();
  for (const item of template) {
    if (typeof item.label === 'string') {
      menuIndex.set(item.label.toLowerCase(), item);
    }
  }

  let previousGroup: string | undefined;
  for (const contribution of contributions) {
    const target = menuIndex.get(contribution.menu);
    if (!target || !Array.isArray(target.submenu)) {
      continue;
    }
    const group = contribution.group ?? 'plugin';
    if (previousGroup !== group) {
      target.submenu.push({ type: 'separator' });
      previousGroup = group;
    }
    target.submenu.push({
      label: contribution.label ?? contribution.command,
      click: () => onCommand(contribution)
    });
  }
}
