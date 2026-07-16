import { BrowserWindow, Menu } from 'electron';
import { buildMenu } from './menu';
import type { ThemeMenuOption } from '#/shared/themes';
import type { ThemeSource } from '#/shared/types';

let mainWindow: BrowserWindow | null = null;
let sidebarVisible = true;
let gitSidebarVisible = false;
let aiSidebarVisible = false;
let requestEditorVisible = true;
let responseEditorVisible = true;
let collectionsVisible = true;
let environmentsVisible = true;
let runResultsVisible = true;
let activeTheme: ThemeSource = 'system';
let pluginThemeOptions: ThemeMenuOption[] = [];
let designerUndoRedoActive = false;
let designerCanUndo = false;
let designerCanRedo = false;
let tabGroupAvailable = false;
let sidebarDeselectAllAvailable = false;
let gitCollectionActive = false;

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
 * Returns the Git sidebar visibility state reflected in the View menu checkbox.
 */
export function getMenuGitSidebarVisible(): boolean {
  return gitSidebarVisible;
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
 * Updates the View menu Git checkbox and rebuilds the menu when the value changes.
 *
 * @param visible - Whether the Git sidebar is currently visible in the renderer.
 */
export function setMenuGitSidebarVisible(visible: boolean): void {
  if (gitSidebarVisible === visible) {
    return;
  }
  gitSidebarVisible = visible;
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
 * Updates Edit menu Undo/Redo items for the Designer and rebuilds when values change.
 *
 * @param active - Whether the Designer tab is open and should own undo/redo.
 * @param canUndo - Whether an undo step is available in the Designer history.
 * @param canRedo - Whether a redo step is available in the Designer history.
 */
export function setMenuDesignerUndoRedo(active: boolean, canUndo: boolean, canRedo: boolean): void {
  if (
    designerUndoRedoActive === active &&
    designerCanUndo === canUndo &&
    designerCanRedo === canRedo
  ) {
    return;
  }
  designerUndoRedoActive = active;
  designerCanUndo = canUndo;
  designerCanRedo = canRedo;
  rebuildAppMenu();
}

/**
 * Updates the File menu New Tab Group item and rebuilds when the value changes.
 *
 * @param available - Whether at least one saved request tab is open.
 */
export function setMenuTabGroupAvailable(available: boolean): void {
  if (tabGroupAvailable === available) {
    return;
  }
  tabGroupAvailable = available;
  rebuildAppMenu();
}

/**
 * Updates the Edit menu Deselect all item and rebuilds when the value changes.
 *
 * @param available - Whether the collections sidebar has selection to clear.
 */
export function setMenuSidebarDeselectAllAvailable(available: boolean): void {
  if (sidebarDeselectAllAvailable === available) {
    return;
  }
  sidebarDeselectAllAvailable = available;
  rebuildAppMenu();
}

/**
 * Updates Git menu item enabled state and rebuilds when the value changes.
 *
 * @param active - Whether the active collection is git-backed.
 */
export function setMenuGitCollectionActive(active: boolean): void {
  if (gitCollectionActive === active) {
    return;
  }
  gitCollectionActive = active;
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
      gitSidebarVisible,
      requestEditorVisible,
      responseEditorVisible,
      collectionsVisible,
      environmentsVisible,
      runResultsVisible,
      activeTheme,
      pluginThemeOptions,
      rebuildAppMenu,
      designerUndoRedoActive,
      designerCanUndo,
      designerCanRedo,
      tabGroupAvailable,
      sidebarDeselectAllAvailable,
      gitCollectionActive
    )
  );
}
