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
  };
}

/**
 * Persisted visibility for the left and AI sidebars.
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
}

/**
 * Theme preference for light, dark, system, or high-contrast appearance.
 */
export type ThemeSource =
  | 'light'
  | 'dark'
  | 'system'
  | 'high-contrast'
  | `plugin:${string}:${string}`;

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
   * When true, switching appearance themes from the View menu shows a confirmation dialog.
   */
  warnWhenSwitchingThemes: boolean;

  /**
   * CodeMirror syntax theme applied to all editor instances.
   */
  codeEditorTheme: CodeEditorTheme;

  /**
   * CodeMirror basicSetup options for editable editor instances.
   */
  codeEditorSetup: CodeEditorSetup;

  /**
   * Global HTTP proxy applied to every outbound request.
   */
  proxy: ProxySettings;

  /**
   * App-wide variables for {{key}} substitution; lowest precedence in the variable chain.
   */
  globalVariables: Variable[];
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
  | 'snippets'
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
