import type * as React from 'react';
/**
 * A resource that can be released when no longer needed.
 *
 * Registration APIs (`hc.ui.register*`, `hc.themes.register`, `hc.commands.register`, etc.)
 * return a `Disposable` that unregisters the contribution when {@link Disposable.dispose}
 * is called. Push every returned disposable onto {@link PluginContext.subscriptions}
 * so the host cleans up automatically on plugin deactivation.
 */
export interface Disposable {
  /**
   * Releases this registration and any resources it holds.
   */
  dispose(): void;
}
/**
 * Common fields shared by UI contribution types registered via {@link PluginUi}.
 *
 * The {@link UiContributionBase.id} must match an entry in the corresponding
 * `manifest.contributes.*` array declared in your plugin package.
 */
export interface UiContributionBase {
  /**
   * Contribution id — must match an id in the corresponding manifest `contributes.*` array.
   */
  id: string;
  /**
   * Display label shown in the target UI surface (Settings sidebar, tab strip, etc.).
   */
  title: string;
}
/**
 * Registers a React component as a Settings panel alongside built-in sections
 * (General, Storage, and so on).
 *
 * Manifest: `contributes.settingsSections`. Requires the `ui` permission.
 */
export interface SettingsSectionContribution extends UiContributionBase {
  /**
   * Panel content rendered when the user selects this settings section. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType;
}
/**
 * Registers a switchable left sidebar destination — a full-height panel the user
 * selects instead of the default collections view.
 *
 * Manifest: `contributes.sidebarPanels`. Requires the `ui` permission.
 */
export interface SidebarPanelContribution extends UiContributionBase {
  /**
   * Optional icon name shown when switching sidebar mode.
   */
  icon?: string;
  /**
   * Full sidebar content for this panel. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType;
  /**
   * Sort order among plugin sidebar panels. Lower values appear first.
   */
  order?: number;
}
/**
 * Adds a collapsible block inside the scrollable sidebar, using the same pattern
 * as the built-in Collections and Environments sections.
 *
 * Manifest: `contributes.sidebarSections`. Requires the `ui` permission.
 */
export interface SidebarSectionContribution extends UiContributionBase {
  /**
   * Section body rendered below the collapsible heading. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType;
  /**
   * Sort order below Collections / Environments. Lower values appear first.
   */
  order?: number;
}
/**
 * Registers a full main-area overlay, replacing the request editor while open
 * (same pattern as Team Hubs or Sharing Keys). Open the view with
 * {@link PluginCommands.execute} from a menu item or other trigger.
 *
 * Manifest: `contributes.mainViews`. Requires the `ui` permission.
 */
export interface MainViewContribution extends UiContributionBase {
  /**
   * Full main-area content. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType;
}
/**
 * Authorization type for the Auth tab; none inherits collection auth at send time.
 */
export type AuthType = 'none' | 'basic' | 'bearer';

/**
 * Basic and bearer credential fields stored together so switching type preserves values.
 */
export interface AuthConfig {
  /**
   * Selected auth mode; none means no request-level override.
   */
  type: AuthType;
  /**
   * Username and password for Basic Auth.
   */
  basic: {
    username: string;
    password: string;
  };
  /**
   * Token value for Bearer Token auth.
   */
  bearer: {
    token: string;
  };
}

/**
 * Request body encoding selected in the Body tab.
 */
export type BodyType = 'none' | 'json' | 'text' | 'multipart' | 'urlencoded';

/**
 * Snapshot of the active request being edited in the request editor.
 *
 * Passed to request and response tab components via {@link RequestTabContext} and
 * {@link ResponseTabContext}. Updates locally as the user edits — no IPC round-trip
 * per keystroke.
 */
export interface RequestDraft {
  /**
   * HTTP method (for example `GET`, `POST`).
   */
  method: string;
  /**
   * Request URL including scheme, host, path, and query string.
   */
  url: string;
  /**
   * Query parameter rows. Each element has `key`, `value`, and `enabled` — only rows
   * with `enabled: true` and a non-empty `key` are sent.
   */
  params: Array<{
    key: string;
    value: string;
    enabled: boolean;
  }>;
  /**
   * Header rows. Each element has `key`, `value`, and `enabled` — only rows with
   * `enabled: true` and a non-empty `key` are sent.
   */
  headers: Array<{
    key: string;
    value: string;
    enabled: boolean;
  }>;
  /**
   * Request body content as a string.
   */
  body: string;
  /**
   * Authorization settings from the Auth tab.
   */
  auth: AuthConfig;
  /**
   * Body encoding selected in the Body tab.
   */
  body_type: BodyType;
}
/**
 * Snapshot of the last HTTP response received for the active request send.
 *
 * `null` on {@link RequestTabContext.response} and {@link ResponseTabContext.response}
 * when no response exists yet.
 */
export interface HttpResponse {
  /**
   * HTTP status code (for example `200`, `404`).
   */
  status: number;
  /**
   * HTTP status text (for example `OK`, `Not Found`).
   */
  statusText: string;
  /**
   * Response header rows. Each element has `key` and `value`.
   */
  headers: Array<{
    key: string;
    value: string;
  }>;
  /**
   * Response body content as a string.
   */
  body: string;
  /**
   * Time from send to response completion, in milliseconds.
   */
  durationMs: number;
  /**
   * Response body size in bytes.
   */
  sizeBytes: number;
}
/**
 * Context passed to {@link RequestTabContribution} components.
 *
 * The tab re-renders locally when the user edits the request. Use
 * {@link RequestTabContext.response} when you need the last response for the active send.
 */
export interface RequestTabContext {
  /**
   * Active request draft for the open editor tab.
   */
  draft: RequestDraft;
  /**
   * Last response for the active send, or `null` if none yet.
   */
  response: HttpResponse | null;
  /**
   * Always `true` — request tab content must not mutate the draft.
   */
  readOnly: true;
  /**
   * Collection-level auth used when {@link RequestDraft.auth} type is `none`.
   */
  collectionAuth: AuthConfig;
  /**
   * Collection-level headers merged before request headers at send time.
   */
  collectionHeaders: Array<{
    key: string;
    value: string;
    enabled: boolean;
  }>;
  /**
   * Merged collection and environment values for {{key}} substitution.
   *
   * Environment overrides collection on duplicate keys. Empty variable values
   * fall back to each variable's defaultValue (same as Send).
   */
  variables: Record<string, string>;
}
/**
 * Adds a segmented tab to the request editor (alongside Params, Headers, Body, and so on).
 *
 * Manifest: `contributes.requestTabs`. Requires the `ui` permission.
 */
export interface RequestTabContribution extends UiContributionBase {
  /**
   * Tab content. Receives `{ context: RequestTabContext }`. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType<{
    context: RequestTabContext;
  }>;
  /**
   * Sort order among editor tabs. Lower values appear first.
   */
  order?: number;
}
/**
 * Context passed to {@link ResponseTabContribution} components.
 */
export interface ResponseTabContext {
  /**
   * Active request draft associated with the response viewer.
   */
  draft: RequestDraft;
  /**
   * Last response, or `null` when no response exists yet.
   */
  response: HttpResponse | null;
}
/**
 * Adds a tab to the response viewer (alongside Body, Headers, Tests).
 *
 * Manifest: `contributes.responseTabs`. Requires the `ui` permission.
 */
export interface ResponseTabContribution extends UiContributionBase {
  /**
   * Tab content. Receives `{ context: ResponseTabContext }`. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType<{
    context: ResponseTabContext;
  }>;
  /**
   * Sort order among response tabs. Lower values appear first.
   */
  order?: number;
  /**
   * When the tab is visible. Default `'hasResponse'`.
   */
  when?: 'always' | 'hasResponse';
}
/**
 * Context passed to {@link CollectionSettingsTabContribution} components.
 */
export interface CollectionSettingsTabContext {
  /**
   * Database id of the collection whose settings are open.
   */
  collectionId: number;
  /**
   * When `true`, the collection settings UI is read-only.
   */
  readOnly: boolean;
}
/**
 * Adds a segmented tab to Collection Settings (alongside General, Variables, Headers, and so on).
 *
 * Manifest: `contributes.collectionSettingsTabs`. Requires the `ui` permission.
 */
export interface CollectionSettingsTabContribution extends UiContributionBase {
  /**
   * Tab content. Receives `{ context: CollectionSettingsTabContext }`. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType<{
    context: CollectionSettingsTabContext;
  }>;
  /**
   * Sort order among collection settings tabs. Lower values appear first.
   */
  order?: number;
}
/**
 * Registers a slide-up footer panel using the same pattern as Console and Variables.
 *
 * Manifest: `contributes.footerPanels`. Requires the `ui` permission.
 */
export interface FooterPanelContribution extends UiContributionBase {
  /**
   * Slide-up panel content. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType;
}
/**
 * Target application menu for {@link MenuItemContribution} entries.
 *
 * Menu contributions use the application menu only — not native window chrome.
 */
export type AppMenu = 'file' | 'edit' | 'view' | 'help';
/**
 * Adds an item to an application menu (File, Edit, View, or Help).
 *
 * Register the command handler with {@link PluginCommands.register} separately.
 * Manifest: `contributes.menus` plus a matching `contributes.commands` entry.
 * Requires the `ui` permission.
 */
export interface MenuItemContribution {
  /**
   * Target application menu.
   */
  menu: AppMenu;
  /**
   * Command id to run on click — must match a registered command and manifest entry.
   */
  command: string;
  /**
   * Menu label override. Falls back to the command title when omitted.
   */
  label?: string;
  /**
   * Menu group for separator placement.
   */
  group?: string;
  /**
   * Sort order within the group. Lower values appear first.
   */
  order?: number;
}
/**
 * Adds a button to the request URL bar toolbar near the Send button.
 *
 * Register the command handler with {@link PluginCommands.register} separately.
 * Manifest: `contributes.requestToolbarActions` plus a matching `contributes.commands` entry.
 * Requires the `ui` permission.
 */
export interface RequestToolbarActionContribution {
  /**
   * Action id — must match an entry in `contributes.requestToolbarActions`.
   */
  id: string;
  /**
   * Button label or tooltip text.
   */
  title: string;
  /**
   * Command id to run on click — must match a registered command and manifest entry.
   */
  command: string;
  /**
   * Optional icon name.
   */
  icon?: string;
  /**
   * Sort order near the Send button. Lower values appear first.
   */
  order?: number;
}
/**
 * Sidebar row type that a context menu item applies to.
 *
 * Used by {@link ContextMenuItemContribution.when} to filter which rows show the action.
 */
export type ContextMenuTarget = 'collection' | 'folder' | 'request';
/**
 * Adds an action to row context menus in the sidebar.
 *
 * The command handler receives target context as arguments (for example `requestId`).
 * Register the handler with {@link PluginCommands.register} separately.
 * Manifest: `contributes.contextMenus` plus a matching `contributes.commands` entry.
 * Requires the `ui` permission.
 */
export interface ContextMenuItemContribution {
  /**
   * Menu item id — must match an entry in `contributes.contextMenus`.
   */
  id: string;
  /**
   * Menu label shown in the context menu.
   */
  title: string;
  /**
   * Command id to run on click — must match a registered command and manifest entry.
   */
  command: string;
  /**
   * Sidebar row type(s) that show this menu item.
   */
  when: ContextMenuTarget | ContextMenuTarget[];
  /**
   * Menu group for separator placement.
   */
  group?: string;
  /**
   * Sort order within the group. Lower values appear first.
   */
  order?: number;
}
/**
 * Adds a custom status indicator to the footer bar (beside sidebar / AI toggles).
 *
 * Manifest: `contributes.statusBarItems`. Requires the `ui` permission.
 */
export interface StatusBarItemContribution {
  /**
   * Item id — must match an entry in `contributes.statusBarItems`.
   */
  id: string;
  /**
   * Status content rendered in the footer. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType;
  /**
   * Footer side. Default `'right'`.
   */
  alignment?: 'left' | 'right';
  /**
   * Sort order on that side. Lower values appear first.
   */
  order?: number;
}
/**
 * HarborClient UI color token ids.
 *
 * Override via {@link ThemeContribution.colors} or a bundled stylesheet.
 * Each token maps to a `--mac-<token>` CSS custom property on `:root`.
 *
 * Token usage:
 * - `surface` — main content background
 * - `sidebar` — left sidebar background
 * - `sidebar-section` — sidebar section headers
 * - `control` — panels, inputs, footer bar
 * - `field` — input field fill
 * - `separator` — borders and dividers
 * - `text` — primary text
 * - `text-secondary` — secondary labels
 * - `muted` — de-emphasized text
 * - `accent` — links, focus rings, primary actions
 * - `selection` — selected row / highlight fill
 * - `danger`, `danger-light`, `warning`, `success`, `info` — status colors
 * - `method-get`, `method-post`, `method-put`, `method-patch`, `method-delete`, `method-head`, `method-options` — HTTP method badge colors
 */
export type ThemeColorToken =
  | 'surface'
  | 'sidebar'
  | 'sidebar-section'
  | 'control'
  | 'field'
  | 'separator'
  | 'text'
  | 'text-secondary'
  | 'muted'
  | 'accent'
  | 'selection'
  | 'danger'
  | 'danger-light'
  | 'warning'
  | 'success'
  | 'info'
  | 'method-get'
  | 'method-post'
  | 'method-put'
  | 'method-patch'
  | 'method-delete'
  | 'method-head'
  | 'method-options';
/**
 * Custom appearance theme registered via {@link PluginThemes.register}.
 *
 * Plugin themes appear in **Settings → General → Appearance** alongside built-in options.
 * When active, the host sets `data-theme="plugin-<pluginId>-<themeId>"` on `<html>` and
 * applies token overrides or an injected stylesheet.
 *
 * Manifest: `contributes.themes`. Requires the `ui` permission.
 */
export interface ThemeContribution {
  /**
   * Theme id unique within your plugin — must match an entry in `contributes.themes`.
   */
  id: string;
  /**
   * Label shown in the appearance dropdown.
   */
  title: string;
  /**
   * Base appearance for `color-scheme` and Electron native window chrome.
   */
  type: 'light' | 'dark';
  /**
   * Token overrides without the `--mac-` prefix. Use for simple palette swaps.
   */
  colors?: Partial<Record<ThemeColorToken, string>>;
  /**
   * Plugin-relative CSS path (for example `dist/theme.css`) for complex themes.
   */
  stylesheet?: string;
}
/**
 * Built-in appearance theme ids selectable in **Settings → General**.
 *
 * When a built-in theme is active, plugin theme overrides are not applied.
 */
export type BuiltinThemeId = 'light' | 'dark' | 'system' | 'high-contrast';
/**
 * Currently active appearance theme — either a built-in HarborClient theme or a plugin theme.
 *
 * When the user selects a plugin theme, the persisted value is
 * `plugin:<pluginId>:<themeId>`. If the plugin is disabled or uninstalled while its
 * theme is active, HarborClient falls back to **System**.
 */
export type ActiveTheme =
  | {
      /**
       * Theme provided by HarborClient.
       */
      source: 'builtin';
      /**
       * Built-in theme id.
       */
      id: BuiltinThemeId;
    }
  | {
      /**
       * Theme registered by a plugin via {@link PluginThemes.register}.
       */
      source: 'plugin';
      /**
       * Plugin package id from `manifest.json`.
       */
      pluginId: string;
      /**
       * Theme id from {@link ThemeContribution.id}.
       */
      themeId: string;
    };
/**
 * Custom appearance theme registration and change notifications.
 *
 * Requires the `ui` permission. Push returned disposables onto
 * {@link PluginContext.subscriptions}.
 */
export interface PluginThemes {
  /**
   * Registers a custom appearance theme.
   *
   * Provide {@link ThemeContribution.colors}, a {@link ThemeContribution.stylesheet}, or both.
   * The host injects stylesheets while the theme is registered and removes them on deactivation.
   *
   * @param theme - Theme definition. `theme.id` must match `contributes.themes`.
   * @returns A {@link Disposable} that unregisters the theme when disposed.
   */
  register(theme: ThemeContribution): Disposable;
  /**
   * Returns the currently active theme.
   *
   * @returns The active built-in or plugin theme reference.
   */
  getActive(): Promise<ActiveTheme>;
  /**
   * Fires when the user changes the appearance theme in Settings or when the host
   * resets the theme after plugin deactivation.
   *
   * @param listener - Called with the new {@link ActiveTheme}.
   * @returns A {@link Disposable} that removes the listener when disposed.
   */
  onDidChange(listener: (theme: ActiveTheme) => void): Disposable;
}
/**
 * Plugin-scoped persistent key-value storage backed by the main process.
 *
 * Keys are namespaced by plugin `id`. Requires the `storage` permission.
 * Use for settings and preferences — debounce text-field writes; load once on panel mount.
 */
export interface PluginStorage {
  /**
   * Returns the stored value for a key.
   *
   * @param key - Storage key within this plugin's namespace.
   * @returns The stored value, or `undefined` if the key has never been set.
   */
  get<T>(key: string): Promise<T | undefined>;
  /**
   * Persists a JSON-serializable value.
   *
   * @param key - Storage key within this plugin's namespace.
   * @param value - Value to persist.
   */
  set<T>(key: string, value: T): Promise<void>;
}
/**
 * Command handlers that tie together menus, toolbar actions, and context menu items.
 *
 * Requires the `ui` permission for {@link PluginCommands.register}. Push returned
 * disposables onto {@link PluginContext.subscriptions}.
 */
export interface PluginCommands {
  /**
   * Registers a command handler.
   *
   * The `id` must match a command declared in `manifest.contributes.commands` and
   * referenced by menu, toolbar, or context menu contributions.
   *
   * @param id - Command id.
   * @param handler - Called when the command runs. Context menu handlers receive target context as args.
   * @returns A {@link Disposable} that unregisters the handler when disposed.
   */
  register(id: string, handler: (...args: unknown[]) => void | Promise<void>): Disposable;
  /**
   * Runs a registered command programmatically.
   *
   * For example, open a {@link MainViewContribution} from another part of your plugin.
   *
   * @param id - Command id to execute.
   * @param args - Arguments forwarded to the command handler.
   */
  execute(id: string, ...args: unknown[]): Promise<void>;
}
/**
 * Options for picking a file through {@link PluginFs.pickFile}.
 */
export interface PluginFsPickFileOptions {
  /**
   * Dialog title.
   */
  title?: string;
  /**
   * File extension filters.
   */
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
  /**
   * Allow multiple file selection.
   */
  multiple?: boolean;
}
/**
 * Options for saving a file through {@link PluginFs.saveFile}.
 */
export interface PluginFsSaveFileOptions {
  /**
   * Suggested file name or path.
   */
  defaultPath?: string;
  /**
   * File extension filters.
   */
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
}
/**
 * Plugin-scoped filesystem access backed by main-process permission checks and a
 * per-plugin path allowlist.
 *
 * Requires `filesystem:pick` for open/save dialogs, `filesystem:read` for
 * {@link PluginFs.readFile}, and `filesystem:write` for {@link PluginFs.writeFile}.
 * User-selected paths from pick/save dialogs are added to the allowlist automatically;
 * the plugin package directory is allowlisted on load.
 */
export interface PluginFs {
  /**
   * Opens a native file picker. Returns absolute paths for selected files, or an
   * empty array when the dialog is canceled. Requires the `filesystem:pick` permission.
   *
   * @param options - Optional dialog configuration.
   */
  pickFile: (options?: PluginFsPickFileOptions) => Promise<string[]>;
  /**
   * Opens a native directory picker. Returns the selected directory path, or `null`
   * when canceled. Requires the `filesystem:pick` permission.
   *
   * @param defaultPath - Optional starting directory.
   */
  pickDirectory: (defaultPath?: string) => Promise<string | null>;
  /**
   * Opens a native save dialog and writes content to the chosen path. Returns the
   * saved path, or `null` when canceled. Requires `filesystem:pick` and
   * `filesystem:write` permissions.
   *
   * @param content - UTF-8 text to write.
   * @param options - Optional dialog configuration.
   */
  saveFile: (content: string, options?: PluginFsSaveFileOptions) => Promise<string | null>;
  /**
   * Reads a UTF-8 text file from an allowlisted path. Requires the `filesystem:read`
   * permission.
   *
   * @param path - Absolute path on the allowlist.
   */
  readFile: (path: string) => Promise<string>;
  /**
   * Writes UTF-8 text to an allowlisted path. Requires the `filesystem:write`
   * permission.
   *
   * @param path - Absolute path on the allowlist.
   * @param content - UTF-8 text to write.
   */
  writeFile: (path: string, content: string) => Promise<void>;
}
/**
 * UI contribution registration and feedback APIs available on {@link PluginContext.ui}.
 *
 * All `register*` methods require the `ui` permission, return a {@link Disposable},
 * and require contribution ids that match `manifest.contributes.*` entries.
 * Push every returned disposable onto {@link PluginContext.subscriptions}.
 */
export interface PluginUi {
  /**
   * Registers a Settings panel alongside built-in sections (General, Storage, etc.).
   *
   * Manifest: `contributes.settingsSections` — `section.id` must match an entry there.
   *
   * @param section - Settings section contribution.
   * @returns A {@link Disposable} that unregisters the section when disposed.
   */
  registerSettingsSection(section: SettingsSectionContribution): Disposable;
  /**
   * Registers a switchable left sidebar destination.
   *
   * Manifest: `contributes.sidebarPanels` — `panel.id` must match an entry there.
   *
   * @param panel - Sidebar panel contribution.
   * @returns A {@link Disposable} that unregisters the panel when disposed.
   */
  registerSidebarPanel(panel: SidebarPanelContribution): Disposable;
  /**
   * Adds a collapsible block inside the scrollable sidebar.
   *
   * Manifest: `contributes.sidebarSections` — `section.id` must match an entry there.
   *
   * @param section - Sidebar section contribution.
   * @returns A {@link Disposable} that unregisters the section when disposed.
   */
  registerSidebarSection(section: SidebarSectionContribution): Disposable;
  /**
   * Registers a full main-area overlay replacing the request editor while open.
   *
   * Manifest: `contributes.mainViews` — `view.id` must match an entry there.
   *
   * @param view - Main view contribution.
   * @returns A {@link Disposable} that unregisters the view when disposed.
   */
  registerMainView(view: MainViewContribution): Disposable;
  /**
   * Adds a segmented tab to the request editor.
   *
   * Manifest: `contributes.requestTabs` — `tab.id` must match an entry there.
   *
   * @param tab - Request tab contribution.
   * @returns A {@link Disposable} that unregisters the tab when disposed.
   */
  registerRequestTab(tab: RequestTabContribution): Disposable;
  /**
   * Adds a tab to the response viewer.
   *
   * Manifest: `contributes.responseTabs` — `tab.id` must match an entry there.
   *
   * @param tab - Response tab contribution.
   * @returns A {@link Disposable} that unregisters the tab when disposed.
   */
  registerResponseTab(tab: ResponseTabContribution): Disposable;
  /**
   * Adds a segmented tab to Collection Settings.
   *
   * Manifest: `contributes.collectionSettingsTabs` — `tab.id` must match an entry there.
   *
   * @param tab - Collection settings tab contribution.
   * @returns A {@link Disposable} that unregisters the tab when disposed.
   */
  registerCollectionSettingsTab(tab: CollectionSettingsTabContribution): Disposable;
  /**
   * Registers a slide-up footer panel.
   *
   * Manifest: `contributes.footerPanels` — `panel.id` must match an entry there.
   *
   * @param panel - Footer panel contribution.
   * @returns A {@link Disposable} that unregisters the panel when disposed.
   */
  registerFooterPanel(panel: FooterPanelContribution): Disposable;
  /**
   * Adds an item to an application menu.
   *
   * Manifest: `contributes.menus` plus a matching `contributes.commands` entry.
   *
   * @param item - Menu item contribution.
   * @returns A {@link Disposable} that unregisters the menu item when disposed.
   */
  registerMenuItem(item: MenuItemContribution): Disposable;
  /**
   * Adds a button to the request URL bar toolbar.
   *
   * Manifest: `contributes.requestToolbarActions` plus a matching `contributes.commands` entry.
   *
   * @param action - Toolbar action contribution.
   * @returns A {@link Disposable} that unregisters the action when disposed.
   */
  registerRequestToolbarAction(action: RequestToolbarActionContribution): Disposable;
  /**
   * Adds an action to sidebar row context menus.
   *
   * Manifest: `contributes.contextMenus` plus a matching `contributes.commands` entry.
   *
   * @param item - Context menu item contribution.
   * @returns A {@link Disposable} that unregisters the menu item when disposed.
   */
  registerContextMenuItem(item: ContextMenuItemContribution): Disposable;
  /**
   * Adds a custom status indicator to the footer bar.
   *
   * Manifest: `contributes.statusBarItems` — `item.id` must match an entry there.
   *
   * @param item - Status bar item contribution.
   * @returns A {@link Disposable} that unregisters the item when disposed.
   */
  registerStatusBarItem(item: StatusBarItemContribution): Disposable;
  /**
   * Shows a non-blocking toast for success or info feedback.
   *
   * Do not use toasts for errors that require acknowledgment — show those inline
   * in your plugin UI instead.
   *
   * @param message - Text shown in the toast.
   * @param options - Optional display options.
   * @param options.duration - Display duration in milliseconds.
   */
  showToast(
    message: string,
    options?: {
      duration?: number;
    }
  ): void;
}
/**
 * The plugin API surface passed as `hc` to your renderer entry's `activate(hc)` function.
 *
 * Export `activate(hc: PluginContext)` and optionally `deactivate()` from your renderer
 * bundle. Use {@link PluginContext.react} for hooks and JSX — do not import or bundle
 * `react` / `react-dom` in your plugin bundle.
 */
export interface PluginContext {
  /**
   * The same React instance HarborClient uses in the renderer.
   *
   * Use for `useState`, `useEffect`, and JSX. Do not bundle React in your plugin.
   */
  react: typeof React;
  /**
   * UI contribution registration and toast APIs. Requires the `ui` permission.
   */
  ui: PluginUi;
  /**
   * Custom appearance theme registration and change notifications. Requires the `ui` permission.
   */
  themes: PluginThemes;
  /**
   * Command registration and execution. Requires the `ui` permission.
   */
  commands: PluginCommands;
  /**
   * Plugin-scoped persistent storage. Requires the `storage` permission.
   */
  storage: PluginStorage;
  /**
   * Plugin-scoped filesystem access. Requires `filesystem:*` permissions as documented
   * on each method.
   */
  fs: PluginFs;
  /**
   * Disposables to clean up on deactivation.
   *
   * Push every disposable returned by registration APIs here. The host disposes all
   * entries when the plugin deactivates.
   */
  subscriptions: Disposable[];
}
/**
 * Serialized HTTP request passed to main-process before-send hooks.
 *
 * Handlers may mutate this object to change method, URL, headers, or body before
 * the request is sent.
 */
export interface PluginHttpRequest {
  /**
   * HTTP method (for example `GET`, `POST`).
   */
  method: string;
  /**
   * Request URL including scheme, host, path, and query string.
   */
  url: string;
  /**
   * Outgoing request headers as a flat key/value map.
   */
  headers: Record<string, string>;
  /**
   * Request body content as a string.
   */
  body: string;
  /**
   * Request body content type when captured from the send pipeline.
   */
  bodyType?: string;
  /**
   * Enabled query parameters from the outgoing request.
   */
  params?: Array<{ key: string; value: string }>;
  /**
   * Saved collection request id when the send originated from a saved request tab.
   */
  sourceRequestId?: number;
  /**
   * Display name from the request tab when {@link sourceRequestId} is set.
   */
  sourceRequestName?: string;
}
/**
 * Serialized HTTP response passed to main-process after-send hooks.
 */
export interface PluginHttpResponse {
  /**
   * HTTP status code (for example `200`, `404`).
   */
  status: number;
  /**
   * HTTP status text (for example `OK`, `Not Found`).
   */
  statusText: string;
  /**
   * Response headers as a flat key/value map.
   */
  headers: Record<string, string>;
  /**
   * Response body content as a string.
   */
  body: string;
}
/**
 * HTTP hook registration API available on {@link MainPluginContext.http}.
 *
 * Requires the `http` permission. Push returned disposables onto
 * {@link MainPluginContext.subscriptions}.
 */
export interface PluginHttp {
  /**
   * Registers a callback that runs before each outgoing HTTP request.
   *
   * Mutate the request object to change method, URL, headers, or body.
   *
   * @param handler - Called with the mutable request snapshot.
   * @returns A {@link Disposable} that unregisters the handler when disposed.
   */
  onBeforeSend(handler: (request: PluginHttpRequest) => void | Promise<void>): Disposable;
  /**
   * Registers a callback that runs after the response is received.
   *
   * @param handler - Called with the request that was sent and the response payload.
   * @returns A {@link Disposable} that unregisters the handler when disposed.
   */
  onAfterSend(
    handler: (request: PluginHttpRequest, response: PluginHttpResponse) => void | Promise<void>
  ): Disposable;
}
/**
 * Custom IPC registration API available on {@link MainPluginContext.ipc}.
 *
 * Exposes RPC channels callable from the renderer half of the same plugin.
 * Requires the `ipc` permission. Push returned disposables onto
 * {@link MainPluginContext.subscriptions}.
 */
export interface PluginIpc {
  /**
   * Registers a handler for a plugin-scoped IPC channel.
   *
   * @param channel - Channel name unique within this plugin.
   * @param handler - Called when the renderer invokes this channel.
   * @returns A {@link Disposable} that unregisters the handler when disposed.
   */
  handle(channel: string, handler: (...args: unknown[]) => unknown): Disposable;
}
/**
 * The plugin API surface passed as `hc` to your main entry's `activate(hc)` function.
 *
 * Main entries run inside the SES-hardened utilityProcess — not in the renderer.
 * Use this entry for HTTP hooks and custom IPC, not for React UI. Export
 * `activate(hc: MainPluginContext)` and optionally `deactivate()` from your main bundle.
 */
export interface MainPluginContext {
  /**
   * Disposables to clean up on deactivation.
   *
   * Push every disposable returned by registration APIs here. The host disposes all
   * entries when the plugin deactivates.
   */
  subscriptions: Disposable[];
  /**
   * Plugin-scoped persistent storage. Requires the `storage` permission.
   */
  storage: PluginStorage;
  /**
   * HTTP hook registration. Requires the `http` permission.
   */
  http: PluginHttp;
  /**
   * Custom IPC handler registration. Requires the `ipc` permission.
   */
  ipc: PluginIpc;
}
