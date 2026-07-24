import { Menu, type BrowserWindow, type WebContents } from 'electron';
import { formatMenuAcceleratorDisplay } from '#/shared/shortcuts';
import type { AppSubmenuItemSnapshot, RootMenuLabel } from '#/shared/types';

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

  return root.submenu.items.map((entry, index) => {
    if (entry.type === 'separator') {
      return { index, kind: 'separator' as const };
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
  });
}

/**
 * Activates an item from a root application submenu snapshot by index.
 *
 * @param label - Root menu label that owns the item.
 * @param index - Flat item index from {@link getAppSubmenuSnapshot}.
 * @param window - Browser window that opened the submenu.
 * @param webContents - Web contents that opened the submenu.
 */
export function activateAppSubmenuItem(
  label: RootMenuLabel,
  index: number,
  window: BrowserWindow,
  webContents: WebContents
): void {
  const appMenu = Menu.getApplicationMenu();
  if (!appMenu) {
    return;
  }

  const root = appMenu.items.find((entry) => entry.label === label);
  const item = root?.submenu?.items[index];
  if (!item || item.type === 'separator' || item.enabled === false) {
    return;
  }

  item.click(undefined, window, webContents);
}
