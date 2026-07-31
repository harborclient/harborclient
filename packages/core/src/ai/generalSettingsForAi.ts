import type { CodeEditorSetup } from '@harborclient/sdk';
import type { ProxySettings } from '@harborclient/http';
import type { Variable } from '../types/common.js';
import type { EditorTab, GeneralSettings, TrustedExternalDomain } from '../types/settings.js';

/**
 * Placeholder returned when a non-empty proxy password is present so secrets
 * are not leaked into AI chat / MCP tool results.
 */
export const REDACTED_PROXY_PASSWORD = '[redacted]';

/**
 * Partial general-settings patch accepted by `update_general_settings`.
 *
 * Nested `proxy` and `codeEditorSetup` objects are deep-merged onto the current
 * values; array fields replace the current list entirely when provided.
 */
export interface GeneralSettingsAiPatch {
  /**
   * Request timeout in milliseconds; 0 disables the timeout.
   */
  requestTimeoutMs?: number;

  /**
   * Maximum time in milliseconds for each pre- or post-request script run; 0 disables the limit.
   */
  scriptTimeoutMs?: number;

  /**
   * When true, pre/post scripts may call hc.sendRequest for outbound HTTP.
   */
  allowScriptNetworkRequests?: boolean;

  /**
   * Plugin manifest ids allowed to call hc.host.sendHttpRequest when script network is off.
   */
  allowedNetworkPlugins?: string[];

  /**
   * When true, pre/post scripts may call hc.fs read/exists/stat APIs.
   */
  allowScriptFileRead?: boolean;

  /**
   * When true, pre/post scripts may call hc.fs write/append APIs.
   */
  allowScriptFileWrite?: boolean;

  /**
   * When true, pre/post scripts may call hc.webpage to open and control browser tabs.
   */
  allowScriptWebpage?: boolean;

  /**
   * Absolute directory that confines script file access when the request is not git-backed.
   */
  scriptFileRoot?: string;

  /**
   * Absolute directory where completed workflow runs are auto-exported as JSON.
   */
  workflowResultsDirectory?: string;

  /**
   * Maximum response body size in megabytes; 0 disables the limit.
   */
  maxResponseSizeMb?: number;

  /**
   * When true, TLS certificates are verified for HTTPS requests. Set false to disable SSL checks.
   */
  verifySsl?: boolean;

  /**
   * When true, 3xx responses are followed automatically.
   */
  followRedirects?: boolean;

  /**
   * URL loaded when a new Live Page is opened with no explicit address.
   */
  startWebpageUrl?: string;

  /**
   * Default User-Agent header for outbound HTTP.
   */
  userAgent?: string;

  /**
   * User-added User-Agent presets.
   */
  customUserAgents?: string[];

  /**
   * When true, custom OverlayScrollbars handles fade out when idle.
   */
  scrollbarAutoHide?: boolean;

  /**
   * When true, request tabs and AI chat tabs wrap onto multiple rows.
   */
  wrapTabs?: boolean;

  /**
   * When true, closing the main window hides the app to the system tray.
   */
  closeToTray?: boolean;

  /**
   * When true, editable text fields show spellcheck underlines.
   */
  spellCheckEnabled?: boolean;

  /**
   * When true, switching appearance themes shows a confirmation dialog.
   */
  warnWhenSwitchingThemes?: boolean;

  /**
   * When true, quitting with unsaved request tabs shows a confirmation dialog.
   */
  warnWhenExitingWithUnsavedChanges?: boolean;

  /**
   * When true, closing a request tab with unsaved edits shows a confirmation dialog.
   */
  warnWhenClosingUnsavedRequests?: boolean;

  /**
   * When true, editing a linked snippet shows a confirmation dialog.
   */
  warnWhenEditingSnippet?: boolean;

  /**
   * When true, cloning a linked snippet shows a confirmation dialog.
   */
  warnWhenCloningSnippet?: boolean;

  /**
   * When true, clicking a read-only linked snippet shows an informational dialog.
   */
  warnWhenClickingReadonlySnippet?: boolean;

  /**
   * When true, creating a workspace from open tabs shows a confirmation dialog.
   */
  warnWhenCreatingWorkspace?: boolean;

  /**
   * When true, opening a workspace shows a confirmation dialog.
   */
  warnWhenOpeningWorkspace?: boolean;

  /**
   * When true, the AI agent must confirm before sending terminal commands.
   */
  warnWhenAgentUsesTerminal?: boolean;

  /**
   * Hostnames trusted for opening external links without confirmation.
   */
  trustedExternalDomains?: TrustedExternalDomain[];

  /**
   * When true, external links open without confirmation for every domain.
   */
  allowAllExternalDomains?: boolean;

  /**
   * Built-in request editor tabs whose inline help notice the user dismissed.
   */
  dismissedRequestEditorNotices?: EditorTab[];

  /**
   * When true, HarborClient auto-tracks files in git-backed collections before commit.
   */
  gitAutoAdd?: boolean;

  /**
   * Absolute path to an external merge-conflict editor executable.
   */
  externalMergeEditorPath?: string;

  /**
   * Display name stamped on commits created through HarborClient.
   */
  gitCommitAuthorName?: string;

  /**
   * Email address stamped on commits created through HarborClient.
   */
  gitCommitAuthorEmail?: string;

  /**
   * Whether the first-commit author prompt has been shown.
   */
  gitCommitAuthorPrompted?: boolean;

  /**
   * CodeMirror syntax theme applied to all editor instances.
   */
  codeEditorTheme?: GeneralSettings['codeEditorTheme'];

  /**
   * Partial CodeMirror basicSetup options; deep-merged onto the current setup.
   */
  codeEditorSetup?: Partial<CodeEditorSetup>;

  /**
   * CodeMirror editor font size.
   */
  codeEditorFontSize?: string;

  /**
   * Partial HTTP proxy settings; deep-merged onto the current proxy.
   */
  proxy?: Partial<ProxySettings>;

  /**
   * App-wide variables for {{key}} substitution (replaces the full list when set).
   */
  globalVariables?: Variable[];

  /**
   * Absolute path to a rotating log file; empty disables file logging.
   */
  logFilePath?: string;
}

/**
 * General settings returned to the AI agent with secrets redacted.
 */
export type SanitizedGeneralSettingsForAi = Omit<GeneralSettings, 'proxy'> & {
  /**
   * Proxy settings with password redacted when non-empty.
   */
  proxy: Omit<ProxySettings, 'password'> & {
    /**
     * Literal password, empty string, or {@link REDACTED_PROXY_PASSWORD}.
     */
    password: string;
  };
};

/**
 * Returns whether a patch object contains at least one own enumerable key.
 *
 * @param patch - Candidate settings patch from the model.
 * @returns True when the patch has at least one field to apply.
 */
export function hasGeneralSettingsAiPatch(patch: GeneralSettingsAiPatch): boolean {
  return Object.keys(patch).length > 0;
}

/**
 * Deep-merges an AI settings patch onto the current general settings.
 *
 * Top-level scalars and arrays replace when provided. Nested `proxy` and
 * `codeEditorSetup` objects merge field-by-field so partial updates do not
 * wipe sibling nested values.
 *
 * @param current - Current persisted general settings.
 * @param patch - Partial settings from `update_general_settings`.
 * @returns Fully merged settings ready to persist.
 */
export function mergeGeneralSettingsAiPatch(
  current: GeneralSettings,
  patch: GeneralSettingsAiPatch
): GeneralSettings {
  const next: GeneralSettings = { ...current };

  if (patch.requestTimeoutMs !== undefined) {
    next.requestTimeoutMs = patch.requestTimeoutMs;
  }
  if (patch.scriptTimeoutMs !== undefined) {
    next.scriptTimeoutMs = patch.scriptTimeoutMs;
  }
  if (patch.allowScriptNetworkRequests !== undefined) {
    next.allowScriptNetworkRequests = patch.allowScriptNetworkRequests;
  }
  if (patch.allowedNetworkPlugins !== undefined) {
    next.allowedNetworkPlugins = [...patch.allowedNetworkPlugins];
  }
  if (patch.allowScriptFileRead !== undefined) {
    next.allowScriptFileRead = patch.allowScriptFileRead;
  }
  if (patch.allowScriptFileWrite !== undefined) {
    next.allowScriptFileWrite = patch.allowScriptFileWrite;
  }
  if (patch.allowScriptWebpage !== undefined) {
    next.allowScriptWebpage = patch.allowScriptWebpage;
  }
  if (patch.scriptFileRoot !== undefined) {
    next.scriptFileRoot = patch.scriptFileRoot;
  }
  if (patch.workflowResultsDirectory !== undefined) {
    next.workflowResultsDirectory = patch.workflowResultsDirectory;
  }
  if (patch.maxResponseSizeMb !== undefined) {
    next.maxResponseSizeMb = patch.maxResponseSizeMb;
  }
  if (patch.verifySsl !== undefined) {
    next.verifySsl = patch.verifySsl;
  }
  if (patch.followRedirects !== undefined) {
    next.followRedirects = patch.followRedirects;
  }
  if (patch.startWebpageUrl !== undefined) {
    next.startWebpageUrl = patch.startWebpageUrl;
  }
  if (patch.userAgent !== undefined) {
    next.userAgent = patch.userAgent;
  }
  if (patch.customUserAgents !== undefined) {
    next.customUserAgents = [...patch.customUserAgents];
  }
  if (patch.scrollbarAutoHide !== undefined) {
    next.scrollbarAutoHide = patch.scrollbarAutoHide;
  }
  if (patch.wrapTabs !== undefined) {
    next.wrapTabs = patch.wrapTabs;
  }
  if (patch.closeToTray !== undefined) {
    next.closeToTray = patch.closeToTray;
  }
  if (patch.spellCheckEnabled !== undefined) {
    next.spellCheckEnabled = patch.spellCheckEnabled;
  }
  if (patch.warnWhenSwitchingThemes !== undefined) {
    next.warnWhenSwitchingThemes = patch.warnWhenSwitchingThemes;
  }
  if (patch.warnWhenExitingWithUnsavedChanges !== undefined) {
    next.warnWhenExitingWithUnsavedChanges = patch.warnWhenExitingWithUnsavedChanges;
  }
  if (patch.warnWhenClosingUnsavedRequests !== undefined) {
    next.warnWhenClosingUnsavedRequests = patch.warnWhenClosingUnsavedRequests;
  }
  if (patch.warnWhenEditingSnippet !== undefined) {
    next.warnWhenEditingSnippet = patch.warnWhenEditingSnippet;
  }
  if (patch.warnWhenCloningSnippet !== undefined) {
    next.warnWhenCloningSnippet = patch.warnWhenCloningSnippet;
  }
  if (patch.warnWhenClickingReadonlySnippet !== undefined) {
    next.warnWhenClickingReadonlySnippet = patch.warnWhenClickingReadonlySnippet;
  }
  if (patch.warnWhenCreatingWorkspace !== undefined) {
    next.warnWhenCreatingWorkspace = patch.warnWhenCreatingWorkspace;
  }
  if (patch.warnWhenOpeningWorkspace !== undefined) {
    next.warnWhenOpeningWorkspace = patch.warnWhenOpeningWorkspace;
  }
  if (patch.warnWhenAgentUsesTerminal !== undefined) {
    next.warnWhenAgentUsesTerminal = patch.warnWhenAgentUsesTerminal;
  }
  if (patch.trustedExternalDomains !== undefined) {
    next.trustedExternalDomains = patch.trustedExternalDomains.map((entry) => ({ ...entry }));
  }
  if (patch.allowAllExternalDomains !== undefined) {
    next.allowAllExternalDomains = patch.allowAllExternalDomains;
  }
  if (patch.dismissedRequestEditorNotices !== undefined) {
    next.dismissedRequestEditorNotices = [...patch.dismissedRequestEditorNotices];
  }
  if (patch.gitAutoAdd !== undefined) {
    next.gitAutoAdd = patch.gitAutoAdd;
  }
  if (patch.externalMergeEditorPath !== undefined) {
    next.externalMergeEditorPath = patch.externalMergeEditorPath;
  }
  if (patch.gitCommitAuthorName !== undefined) {
    next.gitCommitAuthorName = patch.gitCommitAuthorName;
  }
  if (patch.gitCommitAuthorEmail !== undefined) {
    next.gitCommitAuthorEmail = patch.gitCommitAuthorEmail;
  }
  if (patch.gitCommitAuthorPrompted !== undefined) {
    next.gitCommitAuthorPrompted = patch.gitCommitAuthorPrompted;
  }
  if (patch.codeEditorTheme !== undefined) {
    next.codeEditorTheme = patch.codeEditorTheme;
  }
  if (patch.codeEditorSetup !== undefined) {
    next.codeEditorSetup = { ...current.codeEditorSetup, ...patch.codeEditorSetup };
  }
  if (patch.codeEditorFontSize !== undefined) {
    next.codeEditorFontSize = patch.codeEditorFontSize;
  }
  if (patch.proxy !== undefined) {
    next.proxy = { ...current.proxy, ...patch.proxy };
  }
  if (patch.globalVariables !== undefined) {
    next.globalVariables = patch.globalVariables.map((variable) => ({ ...variable }));
  }
  if (patch.logFilePath !== undefined) {
    next.logFilePath = patch.logFilePath;
  }

  return next;
}

/**
 * Returns a copy of general settings safe to expose to the AI agent.
 *
 * Non-empty `proxy.password` values are replaced with {@link REDACTED_PROXY_PASSWORD}.
 *
 * @param settings - Live general settings from the store.
 * @returns Sanitized settings for tool results.
 */
export function sanitizeGeneralSettingsForAi(
  settings: GeneralSettings
): SanitizedGeneralSettingsForAi {
  const password =
    settings.proxy.password.length > 0 ? REDACTED_PROXY_PASSWORD : settings.proxy.password;

  return {
    ...settings,
    allowedNetworkPlugins: [...settings.allowedNetworkPlugins],
    customUserAgents: [...settings.customUserAgents],
    trustedExternalDomains: settings.trustedExternalDomains.map((entry) => ({ ...entry })),
    dismissedRequestEditorNotices: [...settings.dismissedRequestEditorNotices],
    codeEditorSetup: { ...settings.codeEditorSetup },
    proxy: { ...settings.proxy, password },
    globalVariables: settings.globalVariables.map((variable) => ({ ...variable }))
  };
}

/**
 * Lists top-level general-settings keys whose values differ after a merge.
 *
 * Nested objects (`proxy`, `codeEditorSetup`) are reported as a single key when
 * any nested field changed.
 *
 * @param before - Settings before the patch.
 * @param after - Settings after the patch.
 * @returns Sorted list of changed top-level keys.
 */
export function listChangedGeneralSettingsKeys(
  before: GeneralSettings,
  after: GeneralSettings
): Array<keyof GeneralSettings> {
  const keys = Object.keys(before) as Array<keyof GeneralSettings>;
  return keys.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).sort();
}
