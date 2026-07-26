import { Menu, type BrowserWindow, type MenuItem, type WebContents } from 'electron';
import { formatMenuAcceleratorDisplay } from '@harborclient/core/shortcuts';
import type { AppSubmenuItemSnapshot, RootMenuLabel } from '@harborclient/core/types';

/**
 * Serializes a single Electron menu item into a themed-menu snapshot entry.
 *
 * Items with a nested submenu (such as View > Theme) become a `submenu` entry
 * whose children carry their own local indices for activation.
 *
 * @param entry - Electron menu item to serialize.
 * @param index - Index of the item within its owning submenu.
 * @returns Serializable snapshot entry for the renderer.
 */
function serializeSubmenuItem(entry: MenuItem, index: number): AppSubmenuItemSnapshot {
  if (entry.type === 'separator') {
    return { index, kind: 'separator' as const };
  }

  if (entry.submenu) {
    return {
      index,
      kind: 'submenu' as const,
      label: entry.label ?? '',
      enabled: entry.enabled !== false,
      submenu: entry.submenu.items.map(serializeSubmenuItem)
    };
  }

  return {
    index,
    kind: entry.type === 'checkbox' ? ('checkbox' as const) : ('normal' as const),
    label: entry.label ?? '',
    checked: entry.type === 'checkbox' ? entry.checked : undefined,
    enabled: entry.enabled !== false,
    accelerator: entry.accelerator
      ? formatMenuAcceleratorDisplay(entry.accelerator, process.platform)
      : undefined
  };
}

/**
 * Returns a serializable snapshot of a root application submenu for Linux in-app menus.
 *
 * GTK-backed native popups on Linux can ignore Electron nativeTheme overrides, so the
 * renderer draws themed dropdowns from this snapshot instead of calling Menu.popup().
 *
 * @param label - Root menu label to describe.
 * @returns Flat submenu entries with stable indices for activation.
 */
export function getAppSubmenuSnapshot(label: RootMenuLabel): AppSubmenuItemSnapshot[] {
  const appMenu = Menu.getApplicationMenu();
  if (!appMenu) {
    return [];
  }

  const root = appMenu.items.find((entry) => entry.label === label);
  if (!root?.submenu) {
    return [];
  }

  return root.submenu.items.map(serializeSubmenuItem);
}

/**
 * Activates an item from a root application submenu snapshot by index.
 *
 * @param label - Root menu label that owns the item.
 * @param index - Flat item index from {@link getAppSubmenuSnapshot}.
 * @param window - Browser window that opened the submenu.
 * @param webContents - Web contents that opened the submenu.
 * @param nestedIndex - Index of a child item when activating a nested submenu entry (such as View > Theme).
 */
export function activateAppSubmenuItem(
  label: RootMenuLabel,
  index: number,
  window: BrowserWindow,
  webContents: WebContents,
  nestedIndex?: number
): void {
  const appMenu = Menu.getApplicationMenu();
  if (!appMenu) {
    return;
  }

  const root = appMenu.items.find((entry) => entry.label === label);
  const parent = root?.submenu?.items[index];
  if (!parent) {
    return;
  }

  const item = nestedIndex === undefined ? parent : parent.submenu?.items[nestedIndex];
  if (!item || item.type === 'separator' || item.enabled === false) {
    return;
  }

  item.click(undefined, window, webContents);
}
