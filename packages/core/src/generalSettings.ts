import { DEFAULT_PROXY_SETTINGS, HARD_MAX_RESPONSE_SIZE_MB } from '@harborclient/http/settings';
import {
  DEFAULT_CODE_EDITOR_FONT_SIZE,
  DEFAULT_CODE_EDITOR_SETUP,
  normalizeCodeEditorFontSize,
  normalizeCodeEditorSetup,
  normalizeCodeEditorTheme
} from './codeEditorSettings';
import { normalizeEditorTab } from './requestEditorTab';
import type {
  EditorTab,
  GeneralSettings,
  ProxyProtocol,
  ProxySettings,
  TrustedExternalDomain,
  Variable
} from './types';
import { DEFAULT_USER_AGENT, normalizeCustomUserAgents, normalizeUserAgent } from './userAgent';

export { HARD_MAX_RESPONSE_SIZE_MB, DEFAULT_PROXY_SETTINGS };

/**
 * Default general settings applied when storage is empty or fields are invalid.
 */
export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  requestTimeoutMs: 30000,
  scriptTimeoutMs: 5000,
  allowScriptNetworkRequests: false,
  allowedNetworkPlugins: [],
  allowScriptFileRead: false,
  allowScriptFileWrite: false,
  scriptFileRoot: '',
  workflowResultsDirectory: '',
  maxResponseSizeMb: 50,
  verifySsl: true,
  followRedirects: true,
  userAgent: DEFAULT_USER_AGENT,
  customUserAgents: [],
  scrollbarAutoHide: false,
  wrapTabs: true,
  closeToTray: false,
  spellCheckEnabled: true,
  warnWhenSwitchingThemes: true,
  warnWhenExitingWithUnsavedChanges: true,
  warnWhenClosingUnsavedRequests: true,
  warnWhenEditingSnippet: true,
  warnWhenCloningSnippet: true,
  warnWhenClickingReadonlySnippet: true,
  warnWhenCreatingWorkspace: true,
  warnWhenOpeningWorkspace: true,
  warnWhenAgentUsesTerminal: true,
  trustedExternalDomains: [],
  allowAllExternalDomains: false,
  dismissedRequestEditorNotices: [],
  gitAutoAdd: true,
  externalMergeEditorPath: '',
  gitCommitAuthorName: '',
  gitCommitAuthorEmail: '',
  gitCommitAuthorPrompted: false,
  codeEditorTheme: 'monokai',
  codeEditorSetup: { ...DEFAULT_CODE_EDITOR_SETUP },
  codeEditorFontSize: DEFAULT_CODE_EDITOR_FONT_SIZE,
  proxy: { ...DEFAULT_PROXY_SETTINGS },
  globalVariables: [],
  logFilePath: ''
};

/**
 * Returns whether a value looks like a trusted-domain registry row.
 *
 * @param value - Unknown entry from persisted settings.
 */
function isTrustedExternalDomain(value: unknown): value is { domain: unknown; enabled: unknown } {
  return typeof value === 'object' && value !== null && 'domain' in value;
}

/**
 * Normalizes the trusted external-domain registry, dropping empty hostnames
 * and collapsing duplicates (later entries win).
 *
 * @param value - Raw registry from storage or user input.
 */
function normalizeTrustedExternalDomains(value: unknown): TrustedExternalDomain[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byDomain = new Map<string, TrustedExternalDomain>();
  for (const entry of value) {
    if (!isTrustedExternalDomain(entry) || typeof entry.domain !== 'string') {
      continue;
    }
    const domain = entry.domain.trim().toLowerCase();
    if (!domain) {
      continue;
    }
    byDomain.set(domain, { domain, enabled: entry.enabled !== false });
  }
  return [...byDomain.values()];
}

/**
 * Normalizes a collection/environment variable row.
 *
 * @param v - Partial variable from storage or user input.
 * @returns Normalized variable.
 */
export function normalizeVariable(v: Partial<Variable>): Variable {
  return {
    key: typeof v.key === 'string' ? v.key : '',
    value: typeof v.value === 'string' ? v.value : '',
    defaultValue: typeof v.defaultValue === 'string' ? v.defaultValue : '',
    /**
     * Legacy rows without `enabled` remain active so existing data keeps working.
     */
    enabled: v.enabled !== false,
    share: v.share === true
  };
}

/**
 * Normalizes a non-negative number, falling back to the default when invalid.
 *
 * @param value - Raw numeric value from storage or input.
 * @param fallback - Default when value is not a finite number >= 0.
 * @returns Normalized number.
 */
function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

/**
 * Normalizes a positive integer port, falling back to the default when invalid.
 *
 * @param value - Raw port from storage or input.
 * @param fallback - Default when value is not a finite integer in 1–65535.
 * @returns Normalized port.
 */
function normalizePort(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return fallback;
  }
  return parsed;
}

/**
 * Normalizes proxy protocol to http or https.
 *
 * @param value - Raw protocol from storage or input.
 * @returns Normalized protocol.
 */
function normalizeProxyProtocol(value: unknown): ProxyProtocol {
  return value === 'https' ? 'https' : 'http';
}

/**
 * Normalizes proxy settings with defaults for invalid fields.
 *
 * @param input - Raw proxy settings from storage or user input.
 * @returns Normalized proxy settings.
 */
function normalizeProxySettings(input: Partial<ProxySettings> | undefined): ProxySettings {
  return {
    enabled: input?.enabled === true,
    protocol: normalizeProxyProtocol(input?.protocol),
    host: typeof input?.host === 'string' ? input.host.trim() : DEFAULT_PROXY_SETTINGS.host,
    port: normalizePort(input?.port, DEFAULT_PROXY_SETTINGS.port),
    authEnabled: input?.authEnabled === true,
    username:
      typeof input?.username === 'string' ? input.username : DEFAULT_PROXY_SETTINGS.username,
    password: typeof input?.password === 'string' ? input.password : DEFAULT_PROXY_SETTINGS.password
  };
}

/**
 * Normalizes stored global variable rows with defaults for invalid entries.
 *
 * @param input - Raw global variable list from storage or user input.
 * @returns Normalized variable rows.
 */
function normalizeGlobalVariables(input: unknown): Variable[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((entry) => normalizeVariable(entry as Partial<Variable>));
}

/**
 * Normalizes the plugin allowlist used when script network requests are disabled globally.
 *
 * @param input - Raw plugin id list from storage or user input.
 * @returns Unique trimmed plugin manifest ids.
 */
function normalizeAllowedNetworkPlugins(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const ids = input
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

/**
 * Normalizes the list of request editor tabs whose inline notice was dismissed,
 * dropping unknown tab ids and duplicates.
 *
 * @param input - Raw tab id list from storage or user input.
 * @returns Unique valid built-in editor tab ids.
 */
function normalizeDismissedRequestEditorNotices(input: unknown): EditorTab[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const tabs = input
    .map((entry) => normalizeEditorTab(entry))
    .filter((entry): entry is EditorTab => entry != null);
  return [...new Set(tabs)];
}

/**
 * Normalizes a general settings object with defaults for invalid fields.
 *
 * Accepts legacy `warnWhenCreatingTabGroup` / `warnWhenOpeningTabGroup` keys from
 * older persisted blobs and maps them onto the renamed workspace fields.
 * Legacy `warnWhenOpeningExternalLinks: false` maps to `allowAllExternalDomains: true`.
 *
 * @param input - Raw settings from storage or user input.
 * @returns Normalized settings.
 */
export function normalizeGeneralSettings(input: Partial<GeneralSettings>): GeneralSettings {
  const legacy = input as Partial<GeneralSettings> & {
    warnWhenCreatingTabGroup?: boolean;
    warnWhenOpeningTabGroup?: boolean;
    warnWhenOpeningExternalLinks?: boolean;
  };
  const warnWhenCreatingWorkspace =
    typeof legacy.warnWhenCreatingWorkspace === 'boolean'
      ? legacy.warnWhenCreatingWorkspace
      : typeof legacy.warnWhenCreatingTabGroup === 'boolean'
        ? legacy.warnWhenCreatingTabGroup
        : true;
  const warnWhenOpeningWorkspace =
    typeof legacy.warnWhenOpeningWorkspace === 'boolean'
      ? legacy.warnWhenOpeningWorkspace
      : typeof legacy.warnWhenOpeningTabGroup === 'boolean'
        ? legacy.warnWhenOpeningTabGroup
        : true;
  const allowAllExternalDomains =
    typeof legacy.allowAllExternalDomains === 'boolean'
      ? legacy.allowAllExternalDomains
      : legacy.warnWhenOpeningExternalLinks === false;

  return {
    requestTimeoutMs: normalizeNonNegativeNumber(
      input.requestTimeoutMs,
      DEFAULT_GENERAL_SETTINGS.requestTimeoutMs
    ),
    scriptTimeoutMs: normalizeNonNegativeNumber(
      input.scriptTimeoutMs,
      DEFAULT_GENERAL_SETTINGS.scriptTimeoutMs
    ),
    allowScriptNetworkRequests: input.allowScriptNetworkRequests === true,
    allowedNetworkPlugins: normalizeAllowedNetworkPlugins(input.allowedNetworkPlugins),
    allowScriptFileRead: input.allowScriptFileRead === true,
    allowScriptFileWrite: input.allowScriptFileWrite === true,
    scriptFileRoot: typeof input.scriptFileRoot === 'string' ? input.scriptFileRoot.trim() : '',
    workflowResultsDirectory:
      typeof input.workflowResultsDirectory === 'string'
        ? input.workflowResultsDirectory.trim()
        : '',
    maxResponseSizeMb: Math.min(
      normalizeNonNegativeNumber(
        input.maxResponseSizeMb,
        DEFAULT_GENERAL_SETTINGS.maxResponseSizeMb
      ),
      HARD_MAX_RESPONSE_SIZE_MB
    ),
    verifySsl: input.verifySsl !== false,
    followRedirects: input.followRedirects !== false,
    userAgent: normalizeUserAgent(input.userAgent) || DEFAULT_USER_AGENT,
    customUserAgents: normalizeCustomUserAgents(input.customUserAgents),
    scrollbarAutoHide: input.scrollbarAutoHide === true,
    wrapTabs: input.wrapTabs !== false,
    closeToTray: input.closeToTray === true,
    spellCheckEnabled: input.spellCheckEnabled !== false,
    warnWhenSwitchingThemes: input.warnWhenSwitchingThemes !== false,
    warnWhenExitingWithUnsavedChanges: input.warnWhenExitingWithUnsavedChanges !== false,
    warnWhenClosingUnsavedRequests: input.warnWhenClosingUnsavedRequests !== false,
    warnWhenEditingSnippet: input.warnWhenEditingSnippet !== false,
    warnWhenCloningSnippet: input.warnWhenCloningSnippet !== false,
    warnWhenClickingReadonlySnippet: input.warnWhenClickingReadonlySnippet !== false,
    warnWhenCreatingWorkspace,
    warnWhenOpeningWorkspace,
    warnWhenAgentUsesTerminal: input.warnWhenAgentUsesTerminal !== false,
    trustedExternalDomains: normalizeTrustedExternalDomains(input.trustedExternalDomains),
    allowAllExternalDomains,
    dismissedRequestEditorNotices: normalizeDismissedRequestEditorNotices(
      input.dismissedRequestEditorNotices
    ),
    gitAutoAdd: input.gitAutoAdd !== false,
    externalMergeEditorPath:
      typeof input.externalMergeEditorPath === 'string' ? input.externalMergeEditorPath.trim() : '',
    gitCommitAuthorName:
      typeof input.gitCommitAuthorName === 'string' ? input.gitCommitAuthorName.trim() : '',
    gitCommitAuthorEmail:
      typeof input.gitCommitAuthorEmail === 'string' ? input.gitCommitAuthorEmail.trim() : '',
    gitCommitAuthorPrompted: input.gitCommitAuthorPrompted === true,
    codeEditorTheme: normalizeCodeEditorTheme(input.codeEditorTheme),
    codeEditorSetup: normalizeCodeEditorSetup(input.codeEditorSetup),
    codeEditorFontSize: normalizeCodeEditorFontSize(input.codeEditorFontSize),
    proxy: normalizeProxySettings(input.proxy),
    globalVariables: normalizeGlobalVariables(input.globalVariables),
    logFilePath: typeof input.logFilePath === 'string' ? input.logFilePath.trim() : ''
  };
}
