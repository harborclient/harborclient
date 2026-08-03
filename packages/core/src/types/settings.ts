import type { CodeEditorSetup, CodeEditorTheme } from '@harborclient/sdk';
import type { Variable } from './common';
import type { ProxySettings } from '@harborclient/http';

export type { ProxyProtocol, ProxySettings } from '@harborclient/http';

/**
 * Built-in collections sidebar section keys used for expansion, visibility, and
 * per-section sort preferences.
 */
export type SidebarSectionKey =
  | 'collections'
  | 'environments'
  | 'runResults'
  | 'history'
  | 'workspaces'
  | 'workflows'
  | 'websites'
  | 'liveServers'
  | 'liveServerLogs'
  | 'archive'
  | 'trash';

/**
 * Activity-rail mode that selects which sidebar sections are shown together.
 */
export type SidebarMode = 'collections' | 'environments' | 'workflows' | 'servers' | 'trash';

/**
 * Persisted sort mode for a collections sidebar section.
 */
export type SidebarSortMode =
  | 'default'
  | 'name-asc'
  | 'name-desc'
  | 'method-asc'
  | 'method-desc'
  | 'created-asc'
  | 'created-desc'
  | 'marker';

/**
 * Persisted sidebar expansion state for sections, collections, and folders.
 */
export interface SidebarExpansionState {
  /**
   * Expanded/collapsed state for top-level sidebar sections.
   */
  sections: {
    /**
     * Whether the Collections section body is visible.
     */
    collections: boolean;

    /**
     * Whether the Environments section body is visible.
     */
    environments: boolean;

    /**
     * Whether the Run Results section body is visible.
     */
    runResults: boolean;

    /**
     * Whether the History section body is visible.
     */
    history: boolean;

    /**
     * Whether the Workspaces section body is visible.
     */
    workspaces: boolean;

    /**
     * Whether the Workflows section body is visible.
     */
    workflows: boolean;

    /**
     * Whether the Websites section body is visible.
     */
    websites: boolean;

    /**
     * Whether the saved Live Servers section body is visible.
     */
    liveServers: boolean;

    /**
     * Whether the Server Logs section body is visible.
     */
    liveServerLogs: boolean;

    /**
     * Whether the Archive section body is visible.
     */
    archive: boolean;

    /**
     * Whether the Trash section body is visible.
     */
    trash: boolean;
  };

  /**
   * Collection ids whose request trees are expanded in the sidebar.
   */
  collectionIds: number[];

  /**
   * Folder ids whose request lists are expanded in the sidebar.
   */
  folderIds: number[];

  /**
   * Environment ids whose child environments are expanded in the sidebar.
   */
  environmentIds: number[];

  /**
   * Which activity-rail mode is active; drives which section set is mounted.
   */
  activeSidebarMode: SidebarMode;

  /**
   * Whether the activity rail shows labels beside icons.
   */
  sidebarRailExpanded: boolean;

  /**
   * Per-section sort mode for the collections sidebar lists.
   */
  sectionSort: Record<SidebarSectionKey, SidebarSortMode>;

  /**
   * Whether storage location name badges appear next to collection names.
   */
  showStorageLocationBadges: boolean;

  /**
   * Whether user-assigned color marker dots appear beside sidebar row names.
   */
  showMarkers: boolean;

  /**
   * Whether HTTP method badges use per-method colors in the sidebar.
   */
  showMethodColors: boolean;

  /**
   * Whether HTTP/run status indicator dots appear on History and Runs rows.
   */
  showIndicators: boolean;

  /**
   * Whether section-header filter controls appear in the collections sidebar.
   */
  showFilters: boolean;

  /**
   * Whether section-header sort controls appear in the collections sidebar.
   */
  showSorting: boolean;
}

/** Default request editor split height in pixels when both editors are visible. */
export const DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT = 340;

/**
 * Where the live-server logs viewer is docked when open.
 */
export type LiveServerLogsPlacement = 'footer' | 'sidebar';

/**
 * Persisted visibility for sidebars, request/response editors, and footer panels.
 */
export interface PanelLayoutState {
  /**
   * Whether the collections sidebar is shown when not hidden by an overlay.
   */
  showSidebar: boolean;

  /**
   * Whether the collections sidebar activity rail is shown when chrome allows it.
   */
  showRail: boolean;

  /**
   * Whether the AI sidebar is shown when not hidden by an overlay.
   */
  showAiSidebar: boolean;

  /**
   * Whether the Git source-control sidebar is shown when not hidden by an overlay.
   */
  showGitSidebar: boolean;

  /**
   * Whether the Shortcuts editor sidebar is shown when not hidden by an overlay.
   */
  showShortcutsSidebar: boolean;

  /**
   * Whether the request editor panel is shown in the main content area.
   */
  showRequestEditor: boolean;

  /**
   * Whether the response editor panel is shown in the main content area.
   */
  showResponseEditor: boolean;

  /**
   * Request editor panel height in pixels when both request and response editors are visible.
   */
  requestEditorSplitHeight: number;

  /**
   * Whether the footer console panel is open.
   */
  showConsole: boolean;

  /**
   * Whether the footer variables panel is open.
   */
  showVariables: boolean;

  /**
   * Whether the footer MCP server panel is open.
   */
  showMcp: boolean;

  /**
   * Whether the footer terminal panel is open.
   */
  showTerminal: boolean;

  /**
   * Whether the live-server logs viewer is open (footer or right sidebar).
   */
  showLiveServerLogs: boolean;

  /**
   * Active dock placement for the currently open live-server logs viewer.
   */
  liveServerLogsPlacement: LiveServerLogsPlacement;

  /**
   * Per saved-server dock placement keyed by `String(savedLiveServerId)`.
   */
  liveServerLogsPlacements: Record<string, LiveServerLogsPlacement>;

  /**
   * Active plugin footer panel id, when a plugin panel is open.
   */
  activePluginFooterPanelId: string | null;
}

/**
 * Persisted AI chat tab session for restoring open tabs on launch.
 */
export interface AiChatSessionState {
  /**
   * Chat ids open in the tab bar, in display order.
   */
  openTabIds: number[];

  /**
   * Currently selected chat tab id, if any.
   */
  activeChatId: number | null;

  /**
   * When true, plain Enter submits the chat composer; when false, Ctrl/Cmd+Enter submits.
   */
  enterToSend: boolean;
}

/**
 * Theme preference for light, dark, system, or high-contrast appearance.
 */
export type ThemeSource =
  | 'light'
  | 'dark'
  | 'system'
  | 'high-contrast'
  | `plugin:${string}:${string}`
  | `custom:${string}`;

/**
 * Request editor tab identifiers.
 */
export type EditorTab =
  | 'params'
  | 'headers'
  | 'auth'
  | 'cookies'
  | 'body'
  | 'pre'
  | 'post'
  | 'comment';

/**
 * Live Server settings panel tab identifiers.
 */
export type LiveServerSettingsTab =
  | 'general'
  | 'proxy'
  | 'headers'
  | 'routing'
  | 'run'
  | 'ssl'
  | 'scripts';

/**
 * One hostname the user may open in the system browser without confirmation.
 */
export interface TrustedExternalDomain {
  /**
   * Hostname extracted from an external URL (for example `developer.mozilla.org`).
   */
  domain: string;

  /**
   * When true, links to this domain skip the open-external confirmation modal.
   */
  enabled: boolean;
}

/**
 * General application settings for HTTP request execution.
 */
export interface GeneralSettings {
  /**
   * Request timeout in milliseconds; 0 disables the timeout.
   */
  requestTimeoutMs: number;

  /**
   * Maximum time in milliseconds for each pre- or post-request script run; 0 disables the limit.
   */
  scriptTimeoutMs: number;

  /**
   * When true, pre/post scripts may call hc.sendRequest for outbound HTTP.
   */
  allowScriptNetworkRequests: boolean;

  /**
   * Plugin manifest ids allowed to call hc.host.sendHttpRequest when
   * {@link allowScriptNetworkRequests} is false.
   */
  allowedNetworkPlugins: string[];

  /**
   * When true, pre/post scripts may call hc.fs read/exists/stat APIs.
   */
  allowScriptFileRead: boolean;

  /**
   * When true, pre/post scripts may call hc.fs write/append APIs.
   */
  allowScriptFileWrite: boolean;

  /**
   * When true, pre/post scripts may call hc.livePage to open and control browser tabs.
   */
  allowScriptWebpage: boolean;

  /**
   * Absolute directory that confines script file access when the request is not
   * in a git-backed collection. Empty resolves to the user home directory.
   */
  scriptFileRoot: string;

  /**
   * Absolute directory where completed workflow runs are auto-exported as JSON.
   * Empty disables automatic export.
   */
  workflowResultsDirectory: string;

  /**
   * Maximum response body size in megabytes; 0 disables the limit.
   */
  maxResponseSizeMb: number;

  /**
   * When true, TLS certificates are verified for HTTPS requests.
   */
  verifySsl: boolean;

  /**
   * When true, 3xx responses are followed automatically.
   */
  followRedirects: boolean;

  /**
   * URL loaded by File → New → Browser.
   * Also used as the Home button target for that new tab. Defaults to about:blank.
   */
  startWebpageUrl: string;

  /**
   * Default User-Agent header for outbound HTTP when no scoped override or
   * key/value User-Agent header is set.
   */
  userAgent: string;

  /**
   * User-added User-Agent presets shown alongside the built-in list in every
   * User-Agent control.
   */
  customUserAgents: string[];

  /**
   * When true, custom OverlayScrollbars handles fade out when idle.
   */
  scrollbarAutoHide: boolean;

  /**
   * When true, request tabs and AI chat tabs wrap onto multiple rows instead of scrolling horizontally.
   */
  wrapTabs: boolean;

  /**
   * When true, closing the main window hides the app to the system tray instead of quitting.
   * Use File → Quit or the tray Quit action to exit completely.
   */
  closeToTray: boolean;

  /**
   * When true, editable text fields show spellcheck underlines and spelling context-menu actions.
   */
  spellCheckEnabled: boolean;

  /**
   * When true, switching appearance themes from the View menu shows a confirmation dialog.
   */
  warnWhenSwitchingThemes: boolean;

  /**
   * When true, quitting or closing the app with unsaved request tabs shows a confirmation dialog.
   */
  warnWhenExitingWithUnsavedChanges: boolean;

  /**
   * When true, closing a request tab with unsaved edits shows a confirmation dialog.
   */
  warnWhenClosingUnsavedRequests: boolean;

  /**
   * When true, editing a linked snippet in the request script list shows a confirmation dialog.
   */
  warnWhenEditingSnippet: boolean;

  /**
   * When true, cloning a linked snippet in the request script list shows a confirmation dialog.
   */
  warnWhenCloningSnippet: boolean;

  /**
   * When true, clicking a read-only linked snippet in the script list shows an informational dialog.
   */
  warnWhenClickingReadonlySnippet: boolean;

  /**
   * When true, creating a workspace from open request tabs shows a confirmation dialog.
   */
  warnWhenCreatingWorkspace: boolean;

  /**
   * When true, clicking a workspace in the sidebar shows a confirmation dialog before opening tabs.
   */
  warnWhenOpeningWorkspace: boolean;

  /**
   * When true, the AI agent must confirm before sending commands to the footer terminal.
   */
  warnWhenAgentUsesTerminal: boolean;

  /**
   * Hostnames the user has trusted for opening external links without confirmation.
   */
  trustedExternalDomains: TrustedExternalDomain[];

  /**
   * When true, external links open without confirmation for every domain.
   */
  allowAllExternalDomains: boolean;

  /**
   * Built-in request editor tabs whose inline help notice the user dismissed.
   * Empty means every tab still shows its notice.
   */
  dismissedRequestEditorNotices: EditorTab[];

  /**
   * Live Server settings panel tabs whose inline help notice the user dismissed.
   * Empty means every tab still shows its notice.
   */
  dismissedLiveServerNotices: LiveServerSettingsTab[];

  /**
   * When true, HarborClient automatically tracks all requests and files added to git-backed
   * collections before committing. When false, only files tracked via request Add actions are
   * included in commits.
   */
  gitAutoAdd: boolean;

  /**
   * Absolute path to an external executable used to resolve merge conflicts.
   * When empty, HarborClient opens its built-in merge editor tab.
   */
  externalMergeEditorPath: string;

  /**
   * Display name stamped on commits created through HarborClient.
   * When empty, HarborClient falls back to repo-local git config or a default identity.
   */
  gitCommitAuthorName: string;

  /**
   * Email address stamped on commits created through HarborClient.
   * When empty, HarborClient falls back to repo-local git config or a default identity.
   */
  gitCommitAuthorEmail: string;

  /**
   * Whether the first-commit author prompt has been shown and dismissed or saved.
   */
  gitCommitAuthorPrompted: boolean;

  /**
   * CodeMirror syntax theme applied to all editor instances.
   */
  codeEditorTheme: CodeEditorTheme;

  /**
   * CodeMirror basicSetup options for editable editor instances.
   */
  codeEditorSetup: CodeEditorSetup;

  /**
   * CodeMirror editor font size applied to all editor instances.
   */
  codeEditorFontSize: string;

  /**
   * Footer terminal xterm.js appearance and buffer options.
   */
  terminal: TerminalSettings;

  /**
   * Global HTTP proxy applied to every outbound request.
   */
  proxy: ProxySettings;

  /**
   * App-wide variables for {{key}} substitution; lowest precedence in the variable chain.
   */
  globalVariables: Variable[];

  /**
   * Absolute path to a rotating log file; empty disables file logging.
   */
  logFilePath: string;
}

/**
 * Cursor style when the footer terminal is focused (xterm.js `cursorStyle`).
 */
export type TerminalCursorStyle = 'block' | 'underline' | 'bar';

/**
 * Font weight for terminal text (xterm.js `fontWeight`).
 */
export type TerminalFontWeight =
  | 'normal'
  | 'bold'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900';

/**
 * Persisted xterm.js options for the footer terminal panel.
 */
export interface TerminalSettings {
  /**
   * Rows retained beyond the viewport when content scrolls off-screen.
   */
  scrollback: number;

  /**
   * Whether the cursor blinks when the terminal is focused.
   */
  cursorBlink: boolean;

  /**
   * Blink attribute interval in milliseconds; 0 disables blinking text.
   * Applied only when the installed xterm.js build exposes the option.
   */
  blinkIntervalDuration: number;

  /**
   * Cursor shape when the terminal is focused.
   */
  cursorStyle: TerminalCursorStyle;

  /**
   * Scroll speed multiplier used for fast scrolling when Alt is held.
   */
  fastScrollSensitivity: number;

  /**
   * Terminal font size in CSS pixels.
   */
  fontSize: number;

  /**
   * CSS font-family stack for terminal text.
   */
  fontFamily: string;

  /**
   * Font weight used to render non-bold terminal text.
   */
  fontWeight: TerminalFontWeight;

  /**
   * Minimum contrast ratio for dynamically adjusted foreground colors.
   */
  minimumContrastRatio: number;

  /**
   * When true, exposes DOM elements that support screen readers.
   */
  screenReaderMode: boolean;
}

/**
 * Settings sidebar section identifiers.
 */
export type SettingsSection =
  | 'general'
  | 'syntax'
  | 'storage'
  | 'proxy'
  | 'globals'
  | 'ai'
  | 'terminal'
  | 'backup-restore'
  | 'git'
  | 'runtimes'
  | `plugin:${string}:${string}`;

/**
 * AI provider API keys stored locally for future assistant features.
 */
export interface AiSettings {
  /**
   * OpenAI API key.
   */
  openaiApiKey: string;

  /**
   * Anthropic Claude API key.
   */
  claudeApiKey: string;

  /**
   * Google Gemini API key.
   */
  geminiApiKey: string;
}
