import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, WebContents } from 'electron';

const getApplicationMenu = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  Menu: {
    getApplicationMenu: (): unknown => getApplicationMenu()
  }
}));

/**
 * Builds a minimal fake Electron menu item for snapshot tests.
 *
 * @param overrides - Partial item fields to merge over the defaults.
 * @returns A fake menu item shaped like the parts `appMenuSnapshot` reads.
 */
function menuItem(overrides: Record<string, unknown>): Record<string, unknown> {
  return { type: 'normal', label: '', enabled: true, click: vi.fn(), ...overrides };
}

/**
 * Installs a fake application menu with a View menu that contains a nested Theme
 * submenu, returning the click spies for activation assertions.
 */
function installViewMenu(): {
  actionClick: ReturnType<typeof vi.fn>;
  lightClick: ReturnType<typeof vi.fn>;
  midnightClick: ReturnType<typeof vi.fn>;
} {
  const actionClick = vi.fn();
  const lightClick = vi.fn();
  const midnightClick = vi.fn();

  const themeSubmenu = {
    items: [
      menuItem({ type: 'checkbox', label: 'Light', checked: false, click: lightClick }),
      menuItem({ type: 'checkbox', label: 'Dark', checked: true }),
      menuItem({ type: 'separator' }),
      menuItem({ type: 'checkbox', label: 'Midnight', checked: false, click: midnightClick })
    ]
  };

  const viewSubmenu = {
    items: [
      menuItem({ label: 'Action menu', accelerator: 'CmdOrCtrl+K', click: actionClick }),
      menuItem({ type: 'separator' }),
      menuItem({ label: 'Theme', submenu: themeSubmenu })
    ]
  };

  getApplicationMenu.mockReturnValue({
    items: [menuItem({ label: 'View', submenu: viewSubmenu })]
  });

  return { actionClick, lightClick, midnightClick };
}

describe('appMenuSnapshot', () => {
  beforeEach(() => {
    getApplicationMenu.mockReset();
  });

  it('serializes a nested Theme submenu with its child entries', async () => {
    installViewMenu();
    const { getAppSubmenuSnapshot } = await import('./appMenuSnapshot');

    const snapshot = getAppSubmenuSnapshot('View');

    expect(snapshot[0]).toMatchObject({ index: 0, kind: 'normal', label: 'Action menu' });
    expect(snapshot[0].kind === 'normal' ? snapshot[0].accelerator : undefined).toBeTruthy();
    expect(snapshot[1]).toEqual({ index: 1, kind: 'separator' });

    const theme = snapshot[2];
    expect(theme.kind).toBe('submenu');
    if (theme.kind !== 'submenu') {
      throw new Error('expected a submenu entry');
    }
    expect(theme.label).toBe('Theme');
    expect(theme.submenu).toHaveLength(4);
    expect(theme.submenu[0]).toMatchObject({ index: 0, kind: 'checkbox', label: 'Light' });
    expect(theme.submenu[1]).toMatchObject({ kind: 'checkbox', label: 'Dark', checked: true });
    expect(theme.submenu[2]).toEqual({ index: 2, kind: 'separator' });
    expect(theme.submenu[3]).toMatchObject({ index: 3, kind: 'checkbox', label: 'Midnight' });
  });

  it('activates a top-level item by index', async () => {
    const { actionClick } = installViewMenu();
    const { activateAppSubmenuItem } = await import('./appMenuSnapshot');
    const window = {} as BrowserWindow;
    const webContents = {} as WebContents;

    activateAppSubmenuItem('View', 0, window, webContents);

    expect(actionClick).toHaveBeenCalledWith(undefined, window, webContents);
  });

  it('activates a nested submenu item by parent and child index', async () => {
    const { midnightClick } = installViewMenu();
    const { activateAppSubmenuItem } = await import('./appMenuSnapshot');
    const window = {} as BrowserWindow;
    const webContents = {} as WebContents;

    activateAppSubmenuItem('View', 2, window, webContents, 3);

    expect(midnightClick).toHaveBeenCalledWith(undefined, window, webContents);
  });

  it('ignores activation of a nested separator', async () => {
    installViewMenu();
    const { activateAppSubmenuItem } = await import('./appMenuSnapshot');
    const window = {} as BrowserWindow;
    const webContents = {} as WebContents;

    expect(() => activateAppSubmenuItem('View', 2, window, webContents, 2)).not.toThrow();
  });
});
