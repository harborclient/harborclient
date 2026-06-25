import type * as React from 'react';
import type { ThemeSource } from '#/shared/types';
import type {
  ActiveTheme,
  AppMenu,
  BuiltinThemeId,
  CollectionSettingsTabContext,
  ContextMenuTarget,
  RequestTabContext,
  ResponseTabContext,
  ThemeColorToken
} from '@harborclient/plugin-api';

export type * from '@harborclient/plugin-api';

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
  author?: string;
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
export type PluginSource = 'installed' | 'unpacked' | 'git';

/**
 * Git origin metadata for plugins installed from a public repository.
 */
export interface GitPluginOrigin {
  url: string;
  ref?: string;
}

/**
 * Result of checking a plugin package against the trusted publisher registry.
 */
export type PluginSignatureStatus = 'verified' | 'unsigned' | 'untrusted' | 'invalid';

/**
 * Signature verification metadata attached to a discovered or installed plugin.
 */
export interface PluginSignatureInfo {
  status: PluginSignatureStatus;
  /** manifest.author the signature was checked against. */
  author?: string;
  /** keyId recorded in signature.json when verified. */
  keyId?: string;
  /** Human-readable reason for untrusted or invalid signatures. */
  error?: string;
}

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
  /** Public git URL when source is `git`. */
  repoUrl?: string;
  /** Branch or tag ref used for the last clone when source is `git`. */
  repoRef?: string;
  /** Manifest or discovery failure preventing the plugin package from loading. */
  error?: string;
  /** Activation or runtime hook failure on an otherwise valid plugin package. */
  runtimeError?: string;
  /** Publisher signature verification result when available. */
  signature?: PluginSignatureInfo;
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

/**
 * Converts a persisted theme preference to the plugin {@link ActiveTheme} shape.
 *
 * @param theme - Raw theme setting from storage or IPC.
 * @returns Built-in or plugin-scoped active theme reference.
 */
export function toActiveTheme(theme: ThemeSource): ActiveTheme {
  const parsed = parsePluginThemeValue(theme);
  if (parsed) {
    return { source: 'plugin', pluginId: parsed.pluginId, themeId: parsed.themeId };
  }
  return { source: 'builtin', id: theme as BuiltinThemeId };
}

/**
 * Returns a stable string key for comparing {@link ActiveTheme} values.
 *
 * @param theme - Active theme reference.
 * @returns Serialized key suitable for deduplication.
 */
export function activeThemeKey(theme: ActiveTheme): string {
  return theme.source === 'plugin'
    ? `plugin:${theme.pluginId}:${theme.themeId}`
    : `builtin:${theme.id}`;
}
