import type { PluginCatalog, PluginSourcesSettings } from '#/shared/plugin/catalog';
import type { PluginHttpRequest, PluginHttpResponse } from '@harborclient/sdk';
import type {
  PluginAssetResult,
  PluginEntryKind,
  PluginFsPickFileOptions,
  PluginFsSaveFileOptions,
  PluginGitPreview,
  PluginInfo,
  SerializableMenuContribution
} from '#/shared/plugin/types';
import type { TeamHubPluginSourcesView } from '#/shared/types/teamHub';

/** Payload pushed when a plugin surface webview reports its content height. */
export interface PluginSurfaceResizeMessage {
  pluginId: string;
  contributionId: string;
  kind: string;
  slot?: 'content' | 'headerActions' | 'indicator';
  height?: number;
  width?: number;
}

/**
 * IPC methods for plugins.
 */
export interface ApiPlugins {
  /**
   * Lists installed and unpacked plugins.
   */
  listPlugins: () => Promise<PluginInfo[]>;
  /**
   * Fetches the curated plugin marketplace catalog from configured sources.
   */
  getPluginCatalog: () => Promise<PluginCatalog>;
  /**
   * Returns persisted plugin catalog and trusted-key source settings.
   */
  getPluginSources: () => Promise<PluginSourcesSettings>;
  /**
   * Persists plugin catalog and trusted-key source settings.
   *
   * @param settings - Catalog and trusted registry endpoints to store.
   */
  setPluginSources: (settings: PluginSourcesSettings) => Promise<PluginSourcesSettings>;
  /**
   * Refreshes and returns read-only plugin source URLs from connected Team Hubs.
   */
  getTeamHubPluginSources: () => Promise<TeamHubPluginSourcesView>;
  /**
   * Installs a plugin from a native file picker (.hcp / .zip).
   */
  installPlugin: () => Promise<PluginInfo | null>;
  /**
   * Installs a plugin from an absolute archive path.
   *
   * @param path - Absolute path to a `.hcp` or `.zip` plugin package.
   */
  installPluginFromPath: (path: string) => Promise<PluginInfo>;
  /**
   * Installs a plugin by cloning a public git repository.
   *
   * @param url - Public https (or http) repository URL.
   * @param ref - Optional branch or tag to clone.
   */
  installPluginFromGit: (url: string, ref?: string) => Promise<PluginInfo>;
  /**
   * Fetches manifest and preview assets from a public git repository without installing.
   *
   * @param url - Public https (or http) repository URL.
   * @param ref - Optional branch or tag to read.
   */
  previewPluginFromGit: (url: string, ref?: string) => Promise<PluginGitPreview>;
  /**
   * Re-clones a git-installed plugin from its stored origin.
   *
   * @param pluginId - Plugin manifest id.
   */
  updatePluginFromGit: (pluginId: string) => Promise<PluginInfo>;
  /**
   * Uninstalls an installed plugin by id.
   *
   * @param pluginId - Plugin manifest id.
   */
  uninstallPlugin: (pluginId: string) => Promise<void>;
  /**
   * Enables or disables a plugin.
   *
   * @param pluginId - Plugin manifest id.
   * @param enabled - Whether the plugin should activate.
   */
  setPluginEnabled: (pluginId: string, enabled: boolean) => Promise<PluginInfo>;
  /**
   * Loads an unpacked plugin from a native directory picker.
   */
  loadUnpackedPlugin: () => Promise<PluginInfo | null>;
  /**
   * Loads an unpacked plugin from an absolute directory path.
   *
   * @param path - Absolute path to the plugin project folder.
   */
  loadUnpackedPluginFromPath: (path: string) => Promise<PluginInfo>;
  /**
   * Reloads one plugin from disk.
   *
   * @param pluginId - Plugin manifest id.
   */
  reloadPlugin: (pluginId: string) => Promise<PluginInfo>;
  /**
   * Removes an unpacked dev plugin registration.
   *
   * @param pluginId - Plugin manifest id.
   */
  removeUnpackedPlugin: (pluginId: string) => Promise<void>;
  /**
   * Reads a plugin entry bundle as UTF-8 source text.
   *
   * @param pluginId - Plugin manifest id.
   * @param kind - Renderer or main entry.
   */
  readPluginEntry: (pluginId: string, kind: PluginEntryKind) => Promise<string>;
  /**
   * Reads a plugin asset relative to the plugin root.
   *
   * @param pluginId - Plugin manifest id.
   * @param assetPath - Plugin-relative asset path.
   */
  readPluginAsset: (pluginId: string, assetPath: string) => Promise<PluginAssetResult>;
  /**
   * Returns a plugin-scoped persisted value.
   *
   * @param pluginId - Plugin manifest id.
   * @param key - Storage key within the plugin namespace.
   */
  getPluginStorage: (pluginId: string, key: string) => Promise<unknown>;
  /**
   * Persists a plugin-scoped JSON-serializable value.
   *
   * @param pluginId - Plugin manifest id.
   * @param key - Storage key within the plugin namespace.
   * @param value - Value to store.
   */
  setPluginStorage: (pluginId: string, key: string, value: unknown) => Promise<void>;
  /**
   * Runs one plugin database query outside or inside a transaction.
   *
   * @param pluginId - Plugin manifest id.
   * @param mode - Query shape to execute.
   * @param sql - Parameterized SQL statement.
   * @param params - Bound parameter values.
   * @param txnId - Active transaction id when applicable.
   */
  pluginDatabaseQuery: (
    pluginId: string,
    mode: 'get' | 'all' | 'run',
    sql: string,
    params?: unknown[],
    txnId?: string
  ) => Promise<unknown>;
  /**
   * Executes a plugin database migration script.
   *
   * @param pluginId - Plugin manifest id.
   * @param sql - Multi-statement SQL script.
   */
  pluginDatabaseExec: (pluginId: string, sql: string) => Promise<void>;
  /**
   * Starts a plugin database transaction and returns an opaque transaction id.
   *
   * @param pluginId - Plugin manifest id.
   */
  pluginDatabaseTxBegin: (pluginId: string) => Promise<string>;
  /**
   * Commits or rolls back a plugin database transaction.
   *
   * @param pluginId - Plugin manifest id.
   * @param txnId - Transaction id from {@link HostApi.pluginDatabaseTxBegin}.
   * @param action - Whether to commit or roll back.
   */
  pluginDatabaseTxEnd: (
    pluginId: string,
    txnId: string,
    action: 'commit' | 'rollback'
  ) => Promise<void>;
  /**
   * Activates a plugin main entry in the SES utilityProcess runner.
   *
   * Main entry source and permissions are resolved in the main process from disk.
   *
   * @param pluginId - Plugin manifest id.
   */
  activatePluginMain: (pluginId: string) => Promise<void>;
  /**
   * Deactivates a plugin main entry in the SES utilityProcess runner.
   *
   * @param pluginId - Plugin manifest id.
   */
  deactivatePluginMain: (pluginId: string) => Promise<void>;
  /**
   * Records or clears a plugin activation/runtime error shown in Settings.
   *
   * @param pluginId - Plugin manifest id.
   * @param message - Error message, or null to clear.
   * @param logDetails - Optional activation failure details for the main process terminal.
   */
  reportPluginRuntimeError: (
    pluginId: string,
    message: string | null,
    logDetails?: string
  ) => Promise<PluginInfo>;
  /**
   * Invokes a plugin IPC handler registered in the main runtime.
   *
   * @param pluginId - Plugin manifest id.
   * @param channel - Registered channel name.
   * @param args - Arguments from the renderer half.
   */
  invokePluginMain: (pluginId: string, channel: string, args: unknown[]) => Promise<unknown>;
  /**
   * Subscribes to plugin change notifications from the main process.
   *
   * @param callback - Called with the changed plugin id.
   */
  onPluginsChanged: (callback: (pluginId: string) => void) => () => void;
  /**
   * Pushes plugin menu contributions to the main process for menu merge.
   */
  setPluginMenuContributions: (contributions: SerializableMenuContribution[]) => Promise<void>;
  /**
   * Subscribes to plugin menu command clicks from the application menu.
   */
  onPluginMenuCommand: (
    callback: (payload: { pluginId: string; command: string }) => void
  ) => () => void;
  /**
   * Opens a native file picker for a plugin with filesystem:pick permission.
   */
  pluginFsPickFile: (pluginId: string, options?: PluginFsPickFileOptions) => Promise<string[]>;
  /**
   * Opens a native directory picker for a plugin with filesystem:pick permission.
   */
  pluginFsPickDirectory: (pluginId: string, defaultPath?: string) => Promise<string | null>;
  /**
   * Saves text to a user-selected path for a plugin with filesystem:pick permission.
   */
  pluginFsSaveFile: (
    pluginId: string,
    content: string,
    options?: PluginFsSaveFileOptions
  ) => Promise<string | null>;
  /**
   * Reads a UTF-8 file from an allowlisted path for a plugin.
   */
  pluginFsReadFile: (pluginId: string, path: string) => Promise<string>;
  /**
   * Writes a UTF-8 file to an allowlisted path for a plugin.
   */
  pluginFsWriteFile: (pluginId: string, path: string, content: string) => Promise<void>;
  /**
   * Watches an allowlisted file for changes and invokes the callback when it changes.
   */
  pluginFsWatchFile: (pluginId: string, path: string, callback: () => void) => () => void;
  /**
   * Pushes serialized view context to an isolated plugin surface webview.
   */
  pushPluginViewContext: (payload: {
    pluginId: string;
    contributionId: string;
    kind: string;
    context: unknown;
  }) => Promise<void>;
  /**
   * Pushes a completed HTTP exchange to plugin webviews with the `http` permission.
   */
  pushPluginHttpAfterSend: (payload: {
    request: PluginHttpRequest;
    response: PluginHttpResponse;
  }) => Promise<void>;
  /**
   * Executes a plugin command in the plugin agent webview.
   */
  executePluginAgentCommand: (
    pluginId: string,
    commandId: string,
    args?: unknown[]
  ) => Promise<void>;
  /**
   * Invokes one import handler phase in a plugin agent webview.
   */
  invokePluginImportHandler: (
    pluginId: string,
    registrationId: string,
    phase: 'canImport' | 'import',
    file: {
      name: string;
      path: string;
      extension: string;
      contents: string;
    }
  ) => Promise<unknown>;
  /**
   * Subscribes to contribution registry updates from plugin agent webviews.
   */
  onPluginsContributions: (
    callback: (message: {
      pluginId: string;
      op: string;
      kind?: string;
      contribution?: Record<string, unknown>;
      contributionId?: string;
    }) => void
  ) => () => void;
  /**
   * Subscribes to import handler metadata synced from plugin agent webviews.
   */
  onPluginsImportHandlers: (
    callback: (message: {
      pluginId: string;
      op: 'register' | 'unregister';
      registrationId: string;
      extensions?: string[];
    }) => void
  ) => () => void;
  /**
   * Subscribes to host bridge requests from isolated plugin webviews.
   */
  onPluginsHostBridge: (
    callback: (message: { pluginId: string; op: string; payload?: unknown }) => void
  ) => () => void;
  /**
   * Subscribes to correlated host bridge invokes that must return a result.
   */
  onPluginsHostBridgeInvoke: (
    callback: (message: {
      requestId: number;
      pluginId: string;
      op: string;
      payload?: unknown;
    }) => void
  ) => () => void;
  /**
   * Completes a correlated host bridge invoke started by the main-process broker.
   */
  completePluginHostBridge: (message: {
    requestId: number;
    ok: boolean;
    result?: unknown;
    error?: string;
  }) => void;
  /**
   * Subscribes to content height updates from isolated plugin surface webviews.
   */
  onPluginSurfaceResize: (callback: (message: PluginSurfaceResizeMessage) => void) => () => void;
  /**
   * Subscribes to plugin agent webview readiness notifications.
   */
  onPluginsAgentReady: (callback: (payload: { pluginId: string }) => void) => () => void;
  onPluginsAgentFailed: (
    callback: (payload: { pluginId: string; message: string }) => void
  ) => () => void;
}
