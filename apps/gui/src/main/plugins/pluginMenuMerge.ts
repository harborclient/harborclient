import type { MenuItemConstructorOptions } from 'electron';
import type { SerializableMenuContribution } from '#/shared/plugin/types';

/**
 * Electron menu roles that should remain last in a submenu.
 */
const TERMINAL_MENU_ROLES = new Set(['quit', 'close']);

/**
 * Returns the index where plugin menu items should be inserted so they appear
 * above terminal entries such as Quit.
 *
 * @param submenu - Built-in submenu items for one application menu.
 * @returns Insertion index before the first terminal role, or the submenu length.
 */
function findPluginMenuInsertIndex(submenu: MenuItemConstructorOptions[]): number {
  for (let index = 0; index < submenu.length; index += 1) {
    const role = submenu[index]?.role;
    if (typeof role === 'string' && TERMINAL_MENU_ROLES.has(role)) {
      return index;
    }
  }
  return submenu.length;
}

/**
 * Builds Electron menu rows for one menu's plugin contributions.
 *
 * @param contributions - Plugin contributions targeting the same application menu.
 * @param onCommand - Invoked when a plugin menu item is clicked.
 * @returns Menu rows to splice into the built-in submenu.
 */
function buildPluginMenuItems(
  contributions: SerializableMenuContribution[],
  onCommand: (contribution: SerializableMenuContribution) => void
): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [];
  let previousGroup: string | undefined;

  for (const contribution of contributions) {
    const group = contribution.group ?? 'plugin';
    if (previousGroup !== group) {
      items.push({ type: 'separator' });
      previousGroup = group;
    }
    items.push({
      label: contribution.label ?? contribution.command,
      click: () => onCommand(contribution)
    });
  }

  return items;
}

/**
 * Merges plugin menu contributions into a built application menu template.
 *
 * Plugin items are inserted before terminal submenu entries such as Quit so
 * extensions appear with the rest of the menu instead of below app exit actions.
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

  const contributionsByMenu = new Map<string, SerializableMenuContribution[]>();
  for (const contribution of contributions) {
    const menuContributions = contributionsByMenu.get(contribution.menu) ?? [];
    menuContributions.push(contribution);
    contributionsByMenu.set(contribution.menu, menuContributions);
  }

  for (const [menu, menuContributions] of contributionsByMenu) {
    const target = menuIndex.get(menu);
    if (!target || !Array.isArray(target.submenu)) {
      continue;
    }

    const pluginItems = buildPluginMenuItems(menuContributions, onCommand);
    if (pluginItems.length === 0) {
      continue;
    }

    const insertIndex = findPluginMenuInsertIndex(target.submenu);
    const itemBeforeInsert = insertIndex > 0 ? target.submenu[insertIndex - 1] : undefined;
    if (itemBeforeInsert?.type === 'separator' && pluginItems[0]?.type === 'separator') {
      pluginItems.shift();
    }

    target.submenu.splice(insertIndex, 0, ...pluginItems);
  }
}
