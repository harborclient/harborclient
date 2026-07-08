import { BrowserWindow, Menu } from 'electron';
import { buildMenu } from '#/main/menu';
import type { ThemeMenuOption } from '#/shared/themes';
import type { ThemeSource } from '#/shared/types';

let mainWindow: BrowserWindow | null = null;
let sidebarVisible = true;
let aiSidebarVisible = false;
let requestEditorVisible = true;
let responseEditorVisible = true;
let collectionsVisible = true;
let environmentsVisible = true;
let runResultsVisible = true;
let activeTheme: ThemeSource = 'system';
let pluginThemeOptions: ThemeMenuOption[] = [];
let creatorUndoRedoActive = false;
let creatorCanUndo = false;
let creatorCanRedo = false;

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
 * Returns the request editor visibility state reflected in the View menu checkbox.
 */
export function getMenuRequestEditorVisible(): boolean {
  return requestEditorVisible;
}

/**
 * Returns the response editor visibility state reflected in the View menu checkbox.
 */
export function getMenuResponseEditorVisible(): boolean {
  return responseEditorVisible;
}

/**
 * Returns the Collections section visibility state reflected in the View menu checkbox.
 */
export function getMenuCollectionsVisible(): boolean {
  return collectionsVisible;
}

/**
 * Returns the Environments section visibility state reflected in the View menu checkbox.
 */
export function getMenuEnvironmentsVisible(): boolean {
  return environmentsVisible;
}

/**
 * Returns the Run Results section visibility state reflected in the View menu checkbox.
 */
export function getMenuRunResultsVisible(): boolean {
  return runResultsVisible;
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
 * Updates the View menu Request checkbox and rebuilds the menu when the value changes.
 *
 * @param visible - Whether the request editor is currently visible in the renderer.
 */
export function setMenuRequestEditorVisible(visible: boolean): void {
  if (requestEditorVisible === visible) {
    return;
  }
  requestEditorVisible = visible;
  rebuildAppMenu();
}

/**
 * Updates the View menu Response checkbox and rebuilds the menu when the value changes.
 *
 * @param visible - Whether the response editor is currently visible in the renderer.
 */
export function setMenuResponseEditorVisible(visible: boolean): void {
  if (responseEditorVisible === visible) {
    return;
  }
  responseEditorVisible = visible;
  rebuildAppMenu();
}

/**
 * Updates the View menu Collections checkbox and rebuilds the menu when the value changes.
 *
 * @param visible - Whether the Collections section is currently visible in the sidebar.
 */
export function setMenuCollectionsVisible(visible: boolean): void {
  if (collectionsVisible === visible) {
    return;
  }
  collectionsVisible = visible;
  rebuildAppMenu();
}

/**
 * Updates the View menu Environments checkbox and rebuilds the menu when the value changes.
 *
 * @param visible - Whether the Environments section is currently visible in the sidebar.
 */
export function setMenuEnvironmentsVisible(visible: boolean): void {
  if (environmentsVisible === visible) {
    return;
  }
  environmentsVisible = visible;
  rebuildAppMenu();
}

/**
 * Updates the View menu Run Results checkbox and rebuilds the menu when the value changes.
 *
 * @param visible - Whether the Run Results section is currently visible in the sidebar.
 */
export function setMenuRunResultsVisible(visible: boolean): void {
  if (runResultsVisible === visible) {
    return;
  }
  runResultsVisible = visible;
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
 * Updates Edit menu Undo/Redo items for the Creator and rebuilds when values change.
 *
 * @param active - Whether the Creator tab is open and should own undo/redo.
 * @param canUndo - Whether an undo step is available in the Creator history.
 * @param canRedo - Whether a redo step is available in the Creator history.
 */
export function setMenuCreatorUndoRedo(active: boolean, canUndo: boolean, canRedo: boolean): void {
  if (
    creatorUndoRedoActive === active &&
    creatorCanUndo === canUndo &&
    creatorCanRedo === canRedo
  ) {
    return;
  }
  creatorUndoRedoActive = active;
  creatorCanUndo = canUndo;
  creatorCanRedo = canRedo;
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
    buildMenu(
      mainWindow,
      sidebarVisible,
      aiSidebarVisible,
      requestEditorVisible,
      responseEditorVisible,
      collectionsVisible,
      environmentsVisible,
      runResultsVisible,
      activeTheme,
      pluginThemeOptions,
      rebuildAppMenu,
      creatorUndoRedoActive,
      creatorCanUndo,
      creatorCanRedo
    )
  );
}
