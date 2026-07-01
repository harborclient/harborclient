import { BrowserWindow, Menu } from 'electron';
import { buildMenu } from '#/main/menu';
import type { ThemeMenuOption } from '#/shared/themes';
import type { ThemeSource } from '#/shared/types';

let mainWindow: BrowserWindow | null = null;
let sidebarVisible = true;
let aiSidebarVisible = false;
let activeTheme: ThemeSource = 'system';
let pluginThemeOptions: ThemeMenuOption[] = [];

/**
 * Returns the sidebar visibility state reflected in the View menu checkbox.
 */
export function getMenuSidebarVisible(): boolean {
  return sidebarVisible;
}

/**
 * Returns the AI sidebar visibility state reflected in the View menu checkbox.
 */
export function getMenuAiSidebarVisible(): boolean {
  return aiSidebarVisible;
}

/**
 * Returns the active appearance theme reflected in the View menu checkmarks.
 */
export function getMenuActiveTheme(): ThemeSource {
  return activeTheme;
}

/**
 * Returns plugin theme options currently shown in the View menu.
 */
export function getMenuPluginThemeOptions(): ThemeMenuOption[] {
  return pluginThemeOptions;
}

/**
 * Updates the View menu Sidebar checkbox and rebuilds the menu when the value changes.
 *
 * @param visible - Whether the sidebar is currently visible in the renderer.
 */
export function setMenuSidebarVisible(visible: boolean): void {
  if (sidebarVisible === visible) {
    return;
  }
  sidebarVisible = visible;
  rebuildAppMenu();
}

/**
 * Updates the View menu AI checkbox and rebuilds the menu when the value changes.
 *
 * @param visible - Whether the AI sidebar is currently visible in the renderer.
 */
export function setMenuAiSidebarVisible(visible: boolean): void {
  if (aiSidebarVisible === visible) {
    return;
  }
  aiSidebarVisible = visible;
  rebuildAppMenu();
}

/**
 * Updates the View menu theme checkmarks and rebuilds the menu when the value changes.
 *
 * @param theme - Persisted appearance theme preference.
 */
export function setMenuActiveTheme(theme: ThemeSource): void {
  if (activeTheme === theme) {
    return;
  }
  activeTheme = theme;
  rebuildAppMenu();
}

/**
 * Updates plugin theme entries in the View menu and rebuilds when the list changes.
 *
 * @param options - Plugin-provided theme menu options from the renderer registry.
 */
export function setMenuPluginThemes(options: ThemeMenuOption[]): void {
  if (
    pluginThemeOptions.length === options.length &&
    pluginThemeOptions.every(
      (entry, index) =>
        entry.value === options[index]?.value && entry.label === options[index]?.label
    )
  ) {
    return;
  }
  pluginThemeOptions = options;
  rebuildAppMenu();
}

/**
 * Syncs active theme and plugin theme options from the renderer in one menu rebuild.
 *
 * @param theme - Persisted appearance theme preference.
 * @param options - Plugin-provided theme menu options from the renderer registry.
 */
export function setMenuThemeMenuState(theme: ThemeSource, options: ThemeMenuOption[]): void {
  const themeChanged = activeTheme !== theme;
  const optionsChanged =
    pluginThemeOptions.length !== options.length ||
    !pluginThemeOptions.every(
      (entry, index) =>
        entry.value === options[index]?.value && entry.label === options[index]?.label
    );

  if (!themeChanged && !optionsChanged) {
    return;
  }

  activeTheme = theme;
  pluginThemeOptions = options;
  rebuildAppMenu();
}

/**
 * Registers the browser window used when rebuilding the application menu.
 *
 * @param window - Active main window, or null when closed.
 */
export function setMenuWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

/**
 * Rebuilds the application menu so updated shortcut accelerators take effect.
 */
export function rebuildAppMenu(): void {
  if (mainWindow == null || mainWindow.isDestroyed()) {
    return;
  }
  Menu.setApplicationMenu(
    buildMenu(mainWindow, sidebarVisible, aiSidebarVisible, activeTheme, pluginThemeOptions)
  );
}
