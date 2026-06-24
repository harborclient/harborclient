import type * as React from 'react';
import type { KeyValue } from '#/shared/types';

/**
 * Request draft shape exposed to plugin request tabs.
 */
export interface RequestDraft {
  method: string;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: string;
}

/**
 * HTTP response shape exposed to plugin tabs.
 */
export interface HttpResponse {
  status: number;
  statusText: string;
  headers: KeyValue[];
  body: string;
  durationMs: number;
  sizeBytes: number;
}

/**
 * Plugin capability flags declared in manifest.json and enforced at runtime.
 */
export type PluginPermission =
  | 'ui'
  | 'storage'
  | 'filesystem:pick'
  | 'filesystem:read'
  | 'filesystem:write'
  | 'http'
  | 'ipc';

/**
 * Declarative UI slot entry in manifest.contributes.
 */
export interface ManifestContributionEntry {
  id: string;
  title: string;
}

/**
 * Screenshot entry in the plugin manifest.
 */
export type PluginScreenshot =
  | string
  | {
      path: string;
      caption?: string;
    };

/**
 * Parsed plugin manifest.json.
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  company?: string;
  description?: string;
  icon?: string;
  screenshots?: PluginScreenshot[];
  homepage?: string;
  bugs?: { url: string };
  engines: { harborclient: string };
  renderer?: string;
  main?: string;
  permissions: PluginPermission[];
  contributes?: {
    settingsSections?: ManifestContributionEntry[];
    sidebarPanels?: ManifestContributionEntry[];
    sidebarSections?: ManifestContributionEntry[];
    mainViews?: ManifestContributionEntry[];
    requestTabs?: ManifestContributionEntry[];
    responseTabs?: ManifestContributionEntry[];
    collectionSettingsTabs?: ManifestContributionEntry[];
    footerPanels?: ManifestContributionEntry[];
    requestToolbarActions?: ManifestContributionEntry[];
    contextMenus?: ManifestContributionEntry[];
    statusBarItems?: ManifestContributionEntry[];
    themes?: Array<ManifestContributionEntry & { type: 'light' | 'dark' }>;
    commands?: ManifestContributionEntry[];
    menus?: Array<{
      menu: 'file' | 'edit' | 'view' | 'help';
      command: string;
      group?: string;
    }>;
  };
}

/**
 * How a plugin package is loaded on disk.
 */
export type PluginSource = 'installed' | 'unpacked';

/**
 * Summary of a discovered or installed plugin for Settings and IPC.
 */
export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  source: PluginSource;
  path: string;
  enabled: boolean;
  permissions: PluginPermission[];
  manifest: PluginManifest;
  error?: string;
}

/**
 * Which bundled entry file to load from a plugin package.
 */
export type PluginEntryKind = 'renderer' | 'main';

/**
 * Result of reading a plugin asset or entry bundle from disk.
 */
export interface PluginAssetResult {
  content: string;
  mimeType: string;
}

/**
 * Disposable returned by plugin registration APIs.
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Shared fields for UI contributions registered at activation time.
 */
export interface UiContributionBase {
  /** Must match an id in the corresponding manifest contributes.* array */
  id: string;
  title: string;
}

/**
 * Settings sidebar section contribution.
 */
export interface SettingsSectionContribution extends UiContributionBase {
  Component: React.ComponentType;
}

/**
 * Full-height switchable sidebar panel contribution.
 */
export interface SidebarPanelContribution extends UiContributionBase {
  icon?: string;
  Component: React.ComponentType;
  order?: number;
}

/**
 * Collapsible block inside the scrollable sidebar.
 */
export interface SidebarSectionContribution extends UiContributionBase {
  Component: React.ComponentType;
  order?: number;
}

/**
 * Full main-area overlay contribution.
 */
export interface MainViewContribution extends UiContributionBase {
  Component: React.ComponentType;
}

/**
 * Context passed to request editor tab components.
 */
export interface RequestTabContext {
  draft: RequestDraft;
  response: HttpResponse | null;
  readOnly: true;
}

/**
 * Request editor segmented tab contribution.
 */
export interface RequestTabContribution extends UiContributionBase {
  Component: React.ComponentType<{ context: RequestTabContext }>;
  order?: number;
}

/**
 * Context passed to response viewer tab components.
 */
export interface ResponseTabContext {
  draft: RequestDraft;
  response: HttpResponse | null;
}

/**
 * Response viewer tab contribution.
 */
export interface ResponseTabContribution extends UiContributionBase {
  Component: React.ComponentType<{ context: ResponseTabContext }>;
  order?: number;
  when?: 'always' | 'hasResponse';
}

/**
 * Context passed to collection settings tab components.
 */
export interface CollectionSettingsTabContext {
  collectionId: number;
  readOnly: boolean;
}

/**
 * Collection settings segmented tab contribution.
 */
export interface CollectionSettingsTabContribution extends UiContributionBase {
  Component: React.ComponentType<{ context: CollectionSettingsTabContext }>;
  order?: number;
}

/**
 * Slide-up footer panel contribution.
 */
export interface FooterPanelContribution extends UiContributionBase {
  Component: React.ComponentType;
}

/**
 * Application menu identifiers open to plugin menu items.
 */
export type AppMenu = 'file' | 'edit' | 'view' | 'help';

/**
 * Application menu item contribution.
 */
export interface MenuItemContribution {
  menu: AppMenu;
  command: string;
  label?: string;
  group?: string;
  order?: number;
}

/**
 * Request URL bar toolbar action contribution.
 */
export interface RequestToolbarActionContribution {
  id: string;
  title: string;
  command: string;
  icon?: string;
  order?: number;
}

/**
 * Sidebar row types eligible for context menu contributions.
 */
export type ContextMenuTarget = 'collection' | 'folder' | 'request';

/**
 * Sidebar row context menu item contribution.
 */
export interface ContextMenuItemContribution {
  id: string;
  title: string;
  command: string;
  when: ContextMenuTarget | ContextMenuTarget[];
  group?: string;
  order?: number;
}

/**
 * Footer status bar item contribution.
 */
export interface StatusBarItemContribution {
  id: string;
  Component: React.ComponentType;
  alignment?: 'left' | 'right';
  order?: number;
}

/**
 * HarborClient UI color tokens overridable by plugin themes.
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
 * Plugin theme registration payload.
 */
export interface ThemeContribution {
  id: string;
  title: string;
  type: 'light' | 'dark';
  colors?: Partial<Record<ThemeColorToken, string>>;
  stylesheet?: string;
}

/**
 * Built-in appearance theme identifiers.
 */
export type BuiltinThemeId = 'light' | 'dark' | 'system' | 'high-contrast';

/**
 * Active theme selection — built-in or plugin-provided.
 */
export type ActiveTheme =
  | { source: 'builtin'; id: BuiltinThemeId }
  | { source: 'plugin'; pluginId: string; themeId: string };

/**
 * Plugin theme registration and observation API.
 */
export interface PluginThemes {
  register(theme: ThemeContribution): Disposable;
  getActive(): Promise<ActiveTheme>;
  onDidChange(listener: (theme: ActiveTheme) => void): Disposable;
}

/**
 * Plugin-scoped persistent key-value storage.
 */
export interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
}

/**
 * Command registration and execution API.
 */
export interface PluginCommands {
  register(id: string, handler: (...args: unknown[]) => void | Promise<void>): Disposable;
  execute(id: string, ...args: unknown[]): Promise<void>;
}

/**
 * UI registration and toast API exposed to renderer plugins.
 */
export interface PluginUi {
  registerSettingsSection(section: SettingsSectionContribution): Disposable;
  registerSidebarPanel(panel: SidebarPanelContribution): Disposable;
  registerSidebarSection(section: SidebarSectionContribution): Disposable;
  registerMainView(view: MainViewContribution): Disposable;
  registerRequestTab(tab: RequestTabContribution): Disposable;
  registerResponseTab(tab: ResponseTabContribution): Disposable;
  registerCollectionSettingsTab(tab: CollectionSettingsTabContribution): Disposable;
  registerFooterPanel(panel: FooterPanelContribution): Disposable;
  registerMenuItem(item: MenuItemContribution): Disposable;
  registerRequestToolbarAction(action: RequestToolbarActionContribution): Disposable;
  registerContextMenuItem(item: ContextMenuItemContribution): Disposable;
  registerStatusBarItem(item: StatusBarItemContribution): Disposable;
  showToast(message: string, options?: { duration?: number }): void;
}

/**
 * Renderer plugin activation context.
 */
export interface PluginContext {
  react: typeof React;
  ui: PluginUi;
  themes: PluginThemes;
  commands: PluginCommands;
  storage: PluginStorage;
  fs: PluginFs;
  subscriptions: Disposable[];
}

/**
 * Registered settings section exposed to the Settings UI.
 */
export interface RegisteredSettingsSection {
  pluginId: string;
  id: string;
  title: string;
  Component: React.ComponentType;
}

/**
 * Registered plugin theme exposed to the appearance picker.
 */
export interface RegisteredPluginTheme {
  pluginId: string;
  id: string;
  title: string;
  type: 'light' | 'dark';
  colors?: Partial<Record<ThemeColorToken, string>>;
  stylesheet?: string;
}

/**
 * Registered sidebar section contribution.
 */
export interface RegisteredSidebarSection {
  pluginId: string;
  id: string;
  title: string;
  order?: number;
  Component: React.ComponentType;
}

/**
 * Registered switchable sidebar panel contribution.
 */
export interface RegisteredSidebarPanel {
  pluginId: string;
  id: string;
  title: string;
  icon?: string;
  order?: number;
  Component: React.ComponentType;
}

/**
 * Registered main-area overlay contribution.
 */
export interface RegisteredMainView {
  pluginId: string;
  id: string;
  title: string;
  Component: React.ComponentType;
}

/**
 * Registered request editor tab contribution.
 */
export interface RegisteredRequestTab {
  pluginId: string;
  id: string;
  title: string;
  order?: number;
  Component: React.ComponentType<{ context: RequestTabContext }>;
}

/**
 * Registered response viewer tab contribution.
 */
export interface RegisteredResponseTab {
  pluginId: string;
  id: string;
  title: string;
  order?: number;
  when?: 'always' | 'hasResponse';
  Component: React.ComponentType<{ context: ResponseTabContext }>;
}

/**
 * Registered collection settings tab contribution.
 */
export interface RegisteredCollectionSettingsTab {
  pluginId: string;
  id: string;
  title: string;
  order?: number;
  Component: React.ComponentType<{ context: CollectionSettingsTabContext }>;
}

/**
 * Registered footer slide-up panel contribution.
 */
export interface RegisteredFooterPanel {
  pluginId: string;
  id: string;
  title: string;
  Component: React.ComponentType;
}

/**
 * Registered application menu item contribution.
 */
export interface RegisteredMenuItem {
  pluginId: string;
  menu: AppMenu;
  command: string;
  label?: string;
  group?: string;
  order?: number;
}

/**
 * Registered request toolbar action contribution.
 */
export interface RegisteredRequestToolbarAction {
  pluginId: string;
  id: string;
  title: string;
  command: string;
  icon?: string;
  order?: number;
}

/**
 * Registered sidebar context menu item contribution.
 */
export interface RegisteredContextMenuItem {
  pluginId: string;
  id: string;
  title: string;
  command: string;
  when: ContextMenuTarget | ContextMenuTarget[];
  group?: string;
  order?: number;
}

/**
 * Registered footer status bar item contribution.
 */
export interface RegisteredStatusBarItem {
  pluginId: string;
  id: string;
  alignment?: 'left' | 'right';
  order?: number;
  Component: React.ComponentType;
}

/**
 * Options for picking a file through hc.fs.
 */
export interface PluginFsPickFileOptions {
  /** Dialog title. */
  title?: string;
  /** File extension filters. */
  filters?: Array<{ name: string; extensions: string[] }>;
  /** Allow multiple file selection. */
  multiple?: boolean;
}

/**
 * Options for saving a file through hc.fs.
 */
export interface PluginFsSaveFileOptions {
  /** Suggested file name or path. */
  defaultPath?: string;
  /** File extension filters. */
  filters?: Array<{ name: string; extensions: string[] }>;
}

/**
 * Plugin filesystem API backed by main-process allowlist enforcement.
 */
export interface PluginFs {
  pickFile: (options?: PluginFsPickFileOptions) => Promise<string[]>;
  pickDirectory: (defaultPath?: string) => Promise<string | null>;
  saveFile: (content: string, options?: PluginFsSaveFileOptions) => Promise<string | null>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
}

/**
 * Serializable menu contribution pushed to the main process for menu merge.
 */
export interface SerializableMenuContribution {
  pluginId: string;
  menu: AppMenu;
  command: string;
  label?: string;
  group?: string;
  order?: number;
}

/**
 * Serialized HTTP request context for main-process plugin hooks.
 */
export interface PluginHttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * Serialized HTTP response context for main-process plugin hooks.
 */
export interface PluginHttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * Namespaced settings section id for a plugin contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param sectionId - Contribution id from manifest.contributes.settingsSections.
 * @returns Stable section key for Settings navigation.
 */
export function pluginSettingsSectionId(pluginId: string, sectionId: string): string {
  return pluginContributionId(pluginId, sectionId);
}

/**
 * Namespaced contribution id for plugin UI slots.
 *
 * @param pluginId - Plugin manifest id.
 * @param contributionId - Contribution id from the manifest.
 * @returns Stable namespaced id used as tab/section keys in the host UI.
 */
export function pluginContributionId(pluginId: string, contributionId: string): string {
  return `plugin:${pluginId}:${contributionId}`;
}

/**
 * Parses a namespaced plugin settings section id.
 *
 * @param value - Settings section identifier.
 * @returns Plugin and section ids when the value is plugin-scoped.
 */
export function parsePluginSettingsSectionId(
  value: string
): { pluginId: string; sectionId: string } | null {
  const match = /^plugin:([^:]+):([^:]+)$/.exec(value);
  if (!match) {
    return null;
  }
  return { pluginId: match[1], sectionId: match[2] };
}

/**
 * Persisted plugin theme value stored via theme:get/set.
 *
 * @param pluginId - Plugin manifest id.
 * @param themeId - Theme id within the plugin.
 * @returns Serialized theme preference string.
 */
export function formatPluginThemeValue(pluginId: string, themeId: string): string {
  return `plugin:${pluginId}:${themeId}`;
}

/**
 * Parses a persisted plugin theme preference.
 *
 * @param value - Raw theme setting from storage.
 * @returns Plugin and theme ids when the value is plugin-scoped.
 */
export function parsePluginThemeValue(value: string): { pluginId: string; themeId: string } | null {
  const match = /^plugin:([^:]+):([^:]+)$/.exec(value);
  if (!match) {
    return null;
  }
  return { pluginId: match[1], themeId: match[2] };
}
