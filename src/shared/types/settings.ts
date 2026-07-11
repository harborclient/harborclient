import type { CodeEditorSetup, CodeEditorTheme } from '@harborclient/sdk';
import type { Variable } from '#/shared/types/common';
import type { ProxySettings } from '@harborclient/http';

export type { ProxyProtocol, ProxySettings } from '@harborclient/http';

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
     * Whether the Tab Groups section body is visible.
     */
    tabGroups: boolean;
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
   * Whether entire top-level sidebar sections are rendered.
   */
  sectionVisibility: {
    /**
     * Whether the Collections section is shown in the sidebar.
     */
    collections: boolean;

    /**
     * Whether the Environments section is shown in the sidebar.
     */
    environments: boolean;

    /**
     * Whether the Run Results section is shown in the sidebar.
     */
    runResults: boolean;

    /**
     * Whether the History section is shown in the sidebar.
     */
    history: boolean;

    /**
     * Whether the Tab Groups section is shown in the sidebar.
     */
    tabGroups: boolean;
  };

  /**
   * Whether storage location name badges appear next to collection names.
   */
  showStorageLocationBadges: boolean;
}

/** Default request editor split height in pixels when both editors are visible. */
export const DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT = 340;

/**
 * Persisted visibility for the left and AI sidebars and request/response editors.
 */
export interface PanelLayoutState {
  /**
   * Whether the collections sidebar is shown when not hidden by an overlay.
   */
  showSidebar: boolean;

  /**
   * Whether the AI sidebar is shown when not hidden by an overlay.
   */
  showAiSidebar: boolean;

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
   * When true, custom OverlayScrollbars handles fade out when idle.
   */
  scrollbarAutoHide: boolean;

  /**
   * When true, request tabs and AI chat tabs wrap onto multiple rows instead of scrolling horizontally.
   */
  wrapTabs: boolean;

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
   * When true, creating a tab group from open request tabs shows a confirmation dialog.
   */
  warnWhenCreatingTabGroup: boolean;

  /**
   * When true, clicking a tab group in the sidebar shows a confirmation dialog before opening tabs.
   */
  warnWhenOpeningTabGroup: boolean;

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
 * Settings sidebar section identifiers.
 */
export type SettingsSection =
  | 'general'
  | 'syntax'
  | 'storage'
  | 'shortcuts'
  | 'proxy'
  | 'globals'
  | 'ai'
  | 'backup-restore'
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
