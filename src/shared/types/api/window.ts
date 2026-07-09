import type { HarborDeepLink } from '#/shared/deepLink';
import type { MenuSelectThemePayload, ThemeMenuOption } from '#/shared/themes';
import type { MenuActionId, RootMenuLabel, UpdateCheckResult } from '#/shared/types/app';
import type { ThemeSource } from '#/shared/types/settings';

/**
 * IPC methods for window.
 */
export interface ApiWindow {
  /**
   * Subscribes to menu bar action events from the main process.
   *
   * @param callback - Handler invoked with the menu action id.
   * @returns Unsubscribe function.
   */
  onMenuAction: (callback: (action: MenuActionId) => void) => () => void;
  /**
   * Subscribes to harborclient:// deep-link events from the main process.
   *
   * @param callback - Handler invoked with a parsed deep-link action.
   * @returns Unsubscribe function.
   */
  onDeepLink: (callback: (payload: HarborDeepLink) => void) => () => void;
  /**
   * Syncs sidebar visibility to the View menu checkbox in the main process.
   *
   * @param visible - Whether the sidebar is currently visible in the renderer.
   */
  setMenuSidebarVisible: (visible: boolean) => Promise<void>;
  /**
   * Syncs AI sidebar visibility to the View menu checkbox in the main process.
   *
   * @param visible - Whether the AI sidebar is currently visible in the renderer.
   */
  setMenuAiSidebarVisible: (visible: boolean) => Promise<void>;
  /**
   * Syncs request editor visibility to the View menu checkbox in the main process.
   *
   * @param visible - Whether the request editor is currently visible in the renderer.
   */
  setMenuRequestEditorVisible: (visible: boolean) => Promise<void>;
  /**
   * Syncs response editor visibility to the View menu checkbox in the main process.
   *
   * @param visible - Whether the response editor is currently visible in the renderer.
   */
  setMenuResponseEditorVisible: (visible: boolean) => Promise<void>;
  /**
   * Syncs Collections section visibility to the View menu checkbox in the main process.
   *
   * @param visible - Whether the Collections section is currently visible in the sidebar.
   */
  setMenuCollectionsVisible: (visible: boolean) => Promise<void>;
  /**
   * Syncs Environments section visibility to the View menu checkbox in the main process.
   *
   * @param visible - Whether the Environments section is currently visible in the sidebar.
   */
  setMenuEnvironmentsVisible: (visible: boolean) => Promise<void>;
  /**
   * Syncs Run Results section visibility to the View menu checkbox in the main process.
   *
   * @param visible - Whether the Run Results section is currently visible in the sidebar.
   */
  setMenuRunResultsVisible: (visible: boolean) => Promise<void>;
  /**
   * Syncs active theme and plugin theme options to the View menu in the main process.
   *
   * @param theme - Persisted appearance theme preference.
   * @param options - Plugin-provided theme menu options.
   */
  setMenuThemeMenuState: (theme: ThemeSource, options: ThemeMenuOption[]) => Promise<void>;
  /**
   * Syncs Creator undo/redo ownership and enabled state to the Edit menu in the main process.
   *
   * @param active - Whether the Creator tab is open and should own undo/redo.
   * @param canUndo - Whether an undo step is available in the Creator history.
   * @param canRedo - Whether a redo step is available in the Creator history.
   */
  setMenuCreatorUndoRedo: (active: boolean, canUndo: boolean, canRedo: boolean) => Promise<void>;
  /**
   * Subscribes to View menu appearance theme selection events from the main process.
   *
   * @param callback - Handler invoked with the selected theme and label.
   * @returns Unsubscribe function.
   */
  onMenuSelectTheme: (callback: (payload: MenuSelectThemePayload) => void) => () => void;
  /**
   * Opens a root application submenu at the given window coordinates.
   *
   * @param label - Root menu label to open.
   * @param x - Left edge in window coordinates.
   * @param y - Top edge in window coordinates.
   */
  popupMenuSubmenu: (label: RootMenuLabel, x: number, y: number) => Promise<void>;
  /**
   * Returns the application version from package.json.
   */
  getAppVersion: () => Promise<string>;
  /**
   * Fetches the latest GitHub release and compares it to the running version.
   */
  checkForUpdates: () => Promise<UpdateCheckResult>;
  /**
   * Returns the persisted theme preference.
   */
  getTheme: () => Promise<ThemeSource>;
  /**
   * Persists and applies a theme preference.
   *
   * @param theme - Theme source to apply.
   */
  setTheme: (theme: ThemeSource) => Promise<void>;
  /**
   * Applies a theme preference without persisting it (theme picker live preview).
   *
   * @param theme - Theme source to preview.
   */
  previewTheme: (theme: ThemeSource) => Promise<void>;
  /**
   * Returns whether the first-run theme picker modal should open.
   */
  shouldPickTheme: () => Promise<boolean>;
  /**
   * Marks the first-run theme picker as seen so it is not shown again.
   */
  markThemePickerSeen: () => Promise<void>;
  /**
   * Returns whether the Getting Started tab should open automatically on launch.
   */
  shouldOpenGettingStarted: () => Promise<boolean>;
  /**
   * Marks Getting Started as seen so it is not auto-opened on future launches.
   */
  markGettingStartedSeen: () => Promise<void>;
  /**
   * Subscribes to theme preference changes pushed from the main process.
   *
   * @param callback - Called with the new persisted theme preference.
   * @returns Unsubscribe function.
   */
  onThemeChanged: (callback: (theme: ThemeSource) => void) => () => void;
  /**
   * Returns whether developer tooling (DevTools, Inspect Element) is available.
   */
  isDeveloperToolsEnabled: () => Promise<boolean>;
  /**
   * Inspects the DOM node at viewport coordinates and opens DevTools when enabled.
   *
   * @param x - Horizontal coordinate relative to the viewport.
   * @param y - Vertical coordinate relative to the viewport.
   */
  inspectElement: (x: number, y: number) => Promise<void>;
  /**
   * Minimizes the focused application window.
   */
  minimizeWindow: () => Promise<void>;
  /**
   * Toggles maximize on the focused application window.
   */
  toggleMaximizeWindow: () => Promise<void>;
  /**
   * Closes the focused application window, honoring the quit prompt when configured.
   */
  closeWindow: () => Promise<void>;
  /**
   * Subscribes to window close and app quit attempts from the main process.
   *
   * @param callback - Handler invoked when the user tries to close or quit.
   * @returns Unsubscribe function.
   */
  onBeforeClose: (callback: () => void) => () => void;
  /**
   * Responds to a close/quit attempt after checking unsaved state or user choice.
   *
   * @param proceed - True to allow close/quit, false to cancel.
   */
  confirmClose: (proceed: boolean) => void;
  /**
   * Opens a native file picker for one or more files.
   *
   * @returns Selected absolute file paths, or an empty array when canceled.
   */
  selectFiles: () => Promise<string[]>;
  /**
   * Opens a native directory picker.
   *
   * @param defaultPath - Initial directory shown in the dialog, if any.
   * @returns Selected absolute directory path, or null when canceled.
   */
  selectDirectory: (defaultPath: string) => Promise<string | null>;
}
