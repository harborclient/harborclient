/**
 * Settings field and group bindings for modified detection and reset-to-default.
 *
 * ## Supported draft field ids (`SETTING_FIELD_BINDINGS`)
 *
 * All 32 ids in `SETTINGS_FIELD_REGISTRY` (General, Proxy, Syntax, AI API keys):
 * `general.*`, `proxy.*`, `syntax.*`, `ai.openaiApiKey`, `ai.claudeApiKey`,
 * `ai.geminiApiKey`. Values read/write `settingsDraft`.
 *
 * ## Supported group ids (`SETTING_GROUP_BINDINGS`)
 *
 * - `backup-restore.confirmations` — live `state.settings.general` via
 *   `patchGeneralSettings` (immediate persist; not draft).
 * - `git.autoTrack` — draft `general.gitAutoAdd`.
 * - `git.commitAuthor` — draft composite name + email.
 *
 * ## Deferred (no binding; see TODO(settings-modified) at call sites)
 *
 * - `ai.enterToSend` — `aiChatSlice` + immediate persist.
 * - `globals.variables` — local form state in `GlobalsSectionForm`.
 * - `plugins.addCatalogEndpointUrl` / `plugins.addTrustedEndpointUrl` — hosted
 *   plugin surfaces; needs plugin API for modified/reset.
 * - `git.identities` — IPC-backed identity CRUD, not a scalar setting.
 * - `git.externalMergeEditorPath` — draft field without a catalog FieldSettingId.
 */

import {
  DEFAULT_CODE_EDITOR_SETUP,
  normalizeCodeEditorFontSize,
  normalizeCodeEditorSetup,
  normalizeCodeEditorTheme
} from '@harborclient/core/codeEditorSettings';
import { DEFAULT_GENERAL_SETTINGS } from '@harborclient/core/generalSettings';
import type {
  AiSettings,
  CodeEditorSetup,
  GeneralSettings,
  ProxySettings,
  TrustedExternalDomain
} from '@harborclient/core/types';
import { DEFAULT_USER_AGENT, isGeneratedHarborClientUserAgent } from '@harborclient/core/userAgent';

import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import {
  setDraftAiField,
  setDraftCodeEditorSetupField,
  setDraftCodeEditorTheme,
  setDraftGeneralField,
  setDraftProxyField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';
import {
  CONFIRMATION_ROWS,
  confirmationSettingsPatch
} from '#/renderer/src/ui/Tabs/Settings/BackupRestoreSection/confirmations';
import { DEFAULT_AI_SETTINGS } from '#/renderer/src/ui/Tabs/Settings/constants';

import type { FieldSettingId, GroupSettingId, SettingId } from './catalog';

/**
 * Composite draft value for the trusted-domains setting (master toggle + registry).
 */
type TrustedDomainsValue = {
  allowAllExternalDomains: boolean;
  trustedExternalDomains: TrustedExternalDomain[];
};

/**
 * Composite draft value for the git commit-author group.
 */
type CommitAuthorValue = {
  gitCommitAuthorName: string;
  gitCommitAuthorEmail: string;
};

/**
 * Snapshot of confirmation-related general settings keys.
 */
type ConfirmationsSnapshot = Partial<GeneralSettings>;

/**
 * Maps a catalog field or group id to draft/live read, factory default, and reset.
 */
export type SettingFieldBinding = {
  /**
   * Reads the current value from the settings draft (or live store when noted).
   */
  getValue: (state: RootState) => unknown;
  /**
   * Returns the factory default for this field.
   */
  getDefault: () => unknown;
  /**
   * Writes the factory default into the draft via existing slice actions
   * (or persists immediately for live bindings).
   */
  reset: (dispatch: AppDispatch) => void;
  /**
   * Optional deep equality for arrays/objects; defaults to {@link valuesEqual}.
   */
  equals?: (a: unknown, b: unknown) => boolean;
};

/**
 * Compares two values for equality using Object.is for primitives and
 * JSON.stringify for objects/arrays (matching draft dirty detection).
 *
 * @param a - First value.
 * @param b - Second value.
 * @returns True when the values are considered equal.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Returns a fresh copy of an object/array default so reset never shares
 * references with {@link DEFAULT_GENERAL_SETTINGS} (or similar constants).
 *
 * @param value - Factory default value.
 * @returns Cloned value for objects/arrays; primitives unchanged.
 */
function cloneDefaultValue<T>(value: T): T {
  return typeof value === 'object' && value !== null ? structuredClone(value) : value;
}

/**
 * Builds a binding for a top-level general settings field.
 *
 * @param key - Key on {@link GeneralSettings}.
 * @returns Binding that reads and resets that key via {@link setDraftGeneralField}.
 */
function createGeneralBinding<K extends keyof GeneralSettings>(key: K): SettingFieldBinding {
  return {
    getValue: (state) => state.settingsDraft.general[key],
    getDefault: () => DEFAULT_GENERAL_SETTINGS[key],
    reset: (dispatch) => {
      dispatch(
        setDraftGeneralField({
          key,
          value: cloneDefaultValue(DEFAULT_GENERAL_SETTINGS[key])
        })
      );
    }
  };
}

/**
 * Builds a binding for a nested proxy settings field.
 *
 * @param key - Key on {@link ProxySettings}.
 * @returns Binding that reads and resets that key via {@link setDraftProxyField}.
 */
function createProxyBinding<K extends keyof ProxySettings>(key: K): SettingFieldBinding {
  return {
    getValue: (state) => state.settingsDraft.general.proxy[key],
    getDefault: () => DEFAULT_GENERAL_SETTINGS.proxy[key],
    reset: (dispatch) => {
      dispatch(setDraftProxyField({ key, value: DEFAULT_GENERAL_SETTINGS.proxy[key] }));
    }
  };
}

/**
 * Builds a binding for a CodeMirror setup boolean under `general.codeEditorSetup`.
 *
 * @param key - Key on {@link CodeEditorSetup}.
 * @returns Binding that reads and resets that key via {@link setDraftCodeEditorSetupField}.
 */
function createCodeEditorSetupBinding(key: keyof CodeEditorSetup): SettingFieldBinding {
  return {
    getValue: (state) => state.settingsDraft.general.codeEditorSetup[key],
    getDefault: () => DEFAULT_CODE_EDITOR_SETUP[key],
    reset: (dispatch) => {
      const normalized = normalizeCodeEditorSetup(DEFAULT_CODE_EDITOR_SETUP);
      dispatch(setDraftCodeEditorSetupField({ key, value: normalized[key] }));
    }
  };
}

/**
 * Builds a binding for an AI API key field.
 *
 * @param key - Key on {@link AiSettings}.
 * @returns Binding that reads and resets that key via {@link setDraftAiField}.
 */
function createAiBinding<K extends keyof AiSettings>(key: K): SettingFieldBinding {
  return {
    getValue: (state) => state.settingsDraft.ai[key],
    getDefault: () => DEFAULT_AI_SETTINGS[key],
    reset: (dispatch) => {
      dispatch(setDraftAiField({ key, value: DEFAULT_AI_SETTINGS[key] }));
    }
  };
}

/**
 * Reads the composite trusted-domains value from draft general settings.
 *
 * @param state - Redux root state.
 * @returns Master toggle and domain registry.
 */
function getTrustedDomainsValue(state: RootState): TrustedDomainsValue {
  const { allowAllExternalDomains, trustedExternalDomains } = state.settingsDraft.general;
  return { allowAllExternalDomains, trustedExternalDomains };
}

/**
 * Returns the factory default for the trusted-domains composite field.
 *
 * @returns Default master toggle and empty domain registry.
 */
function getTrustedDomainsDefault(): TrustedDomainsValue {
  return {
    allowAllExternalDomains: DEFAULT_GENERAL_SETTINGS.allowAllExternalDomains,
    trustedExternalDomains: cloneDefaultValue(DEFAULT_GENERAL_SETTINGS.trustedExternalDomains)
  };
}

/**
 * Compares two trusted-domains composite values.
 *
 * @param a - First value (expected {@link TrustedDomainsValue}).
 * @param b - Second value (expected {@link TrustedDomainsValue}).
 * @returns True when both properties match.
 */
function trustedDomainsEqual(a: unknown, b: unknown): boolean {
  return valuesEqual(a, b);
}

/**
 * Resets both trusted-domain draft keys to factory defaults.
 *
 * @param dispatch - Redux dispatch.
 */
function resetTrustedDomains(dispatch: AppDispatch): void {
  dispatch(
    setDraftGeneralField({
      key: 'allowAllExternalDomains',
      value: DEFAULT_GENERAL_SETTINGS.allowAllExternalDomains
    })
  );
  dispatch(
    setDraftGeneralField({
      key: 'trustedExternalDomains',
      value: cloneDefaultValue(DEFAULT_GENERAL_SETTINGS.trustedExternalDomains)
    })
  );
}

/**
 * Binding for `syntax.codeEditorTheme`.
 */
const codeEditorThemeBinding: SettingFieldBinding = {
  getValue: (state) => state.settingsDraft.general.codeEditorTheme,
  getDefault: () => DEFAULT_GENERAL_SETTINGS.codeEditorTheme,
  reset: (dispatch) => {
    dispatch(
      setDraftCodeEditorTheme(normalizeCodeEditorTheme(DEFAULT_GENERAL_SETTINGS.codeEditorTheme))
    );
  }
};

/**
 * Binding for `syntax.codeEditorFontSize`.
 */
const codeEditorFontSizeBinding: SettingFieldBinding = {
  getValue: (state) => state.settingsDraft.general.codeEditorFontSize,
  getDefault: () => DEFAULT_GENERAL_SETTINGS.codeEditorFontSize,
  reset: (dispatch) => {
    dispatch(
      setDraftGeneralField({
        key: 'codeEditorFontSize',
        value: normalizeCodeEditorFontSize(DEFAULT_GENERAL_SETTINGS.codeEditorFontSize)
      })
    );
  }
};

/**
 * Binding for the composite `general.trustedDomains` catalog field.
 */
const trustedDomainsBinding: SettingFieldBinding = {
  getValue: getTrustedDomainsValue,
  getDefault: getTrustedDomainsDefault,
  reset: resetTrustedDomains,
  equals: trustedDomainsEqual
};

/**
 * Returns true when a User-Agent string matches the factory placeholder or a
 * machine-generated HarborClient User-Agent (treated as the effective default).
 *
 * @param value - Candidate User-Agent string.
 * @returns True when the value should not count as modified.
 */
function isDefaultUserAgentValue(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  if (value === DEFAULT_USER_AGENT) {
    return true;
  }
  return isGeneratedHarborClientUserAgent(value);
}

/**
 * Binding for `general.userAgent`.
 *
 * Machine-generated HarborClient User-Agents are treated as unmodified so real
 * installs are not flagged after first-run UA capture. Reset still writes
 * {@link DEFAULT_USER_AGENT}; startup migration may replace it again later.
 */
const userAgentBinding: SettingFieldBinding = {
  getValue: (state) => state.settingsDraft.general.userAgent,
  getDefault: () => DEFAULT_USER_AGENT,
  reset: (dispatch) => {
    dispatch(setDraftGeneralField({ key: 'userAgent', value: DEFAULT_USER_AGENT }));
  },
  equals: (a, b) => {
    // Any generated HarborClient UA counts as equal to the factory placeholder.
    if (isDefaultUserAgentValue(a) && isDefaultUserAgentValue(b)) {
      return true;
    }
    return valuesEqual(a, b);
  }
};

/**
 * Reads confirmation prompt keys from live general settings.
 *
 * @param state - Redux root state.
 * @returns Snapshot of warnWhen* flags and dismissed request-editor notices.
 */
function getConfirmationsValue(state: RootState): ConfirmationsSnapshot {
  const general = state.settings.general;
  const snapshot: ConfirmationsSnapshot = {};
  for (const row of CONFIRMATION_ROWS) {
    snapshot[row.key] = general[row.key];
  }
  snapshot.dismissedRequestEditorNotices = [...general.dismissedRequestEditorNotices];
  return snapshot;
}

/**
 * Returns the factory default for the confirmations group (all prompts enabled).
 *
 * @returns Patch that enables every confirmation row.
 */
function getConfirmationsDefault(): ConfirmationsSnapshot {
  return confirmationSettingsPatch(true);
}

/**
 * Binding for `backup-restore.confirmations` (live store, immediate persist).
 */
const confirmationsBinding: SettingFieldBinding = {
  getValue: getConfirmationsValue,
  getDefault: getConfirmationsDefault,
  reset: (dispatch) => {
    void dispatch(patchGeneralSettings(confirmationSettingsPatch(true)));
  }
};

/**
 * Binding for the composite `git.commitAuthor` group.
 */
const commitAuthorBinding: SettingFieldBinding = {
  getValue: (state): CommitAuthorValue => ({
    gitCommitAuthorName: state.settingsDraft.general.gitCommitAuthorName,
    gitCommitAuthorEmail: state.settingsDraft.general.gitCommitAuthorEmail
  }),
  getDefault: (): CommitAuthorValue => ({
    gitCommitAuthorName: DEFAULT_GENERAL_SETTINGS.gitCommitAuthorName,
    gitCommitAuthorEmail: DEFAULT_GENERAL_SETTINGS.gitCommitAuthorEmail
  }),
  reset: (dispatch) => {
    dispatch(
      setDraftGeneralField({
        key: 'gitCommitAuthorName',
        value: DEFAULT_GENERAL_SETTINGS.gitCommitAuthorName
      })
    );
    dispatch(
      setDraftGeneralField({
        key: 'gitCommitAuthorEmail',
        value: DEFAULT_GENERAL_SETTINGS.gitCommitAuthorEmail
      })
    );
  }
};

/**
 * Maps every id in `SETTINGS_FIELD_REGISTRY` to draft get/default/reset handlers.
 */
export const SETTING_FIELD_BINDINGS: Partial<Record<FieldSettingId, SettingFieldBinding>> = {
  'general.requestTimeoutMs': createGeneralBinding('requestTimeoutMs'),
  'general.scriptTimeoutMs': createGeneralBinding('scriptTimeoutMs'),
  'general.allowScriptNetworkRequests': createGeneralBinding('allowScriptNetworkRequests'),
  'general.allowScriptFileRead': createGeneralBinding('allowScriptFileRead'),
  'general.allowScriptFileWrite': createGeneralBinding('allowScriptFileWrite'),
  'general.scriptFileRoot': createGeneralBinding('scriptFileRoot'),
  'general.maxResponseSizeMb': createGeneralBinding('maxResponseSizeMb'),
  'general.verifySsl': createGeneralBinding('verifySsl'),
  'general.followRedirects': createGeneralBinding('followRedirects'),
  'general.userAgent': userAgentBinding,
  'general.scrollbarAutoHide': createGeneralBinding('scrollbarAutoHide'),
  'general.wrapTabs': createGeneralBinding('wrapTabs'),
  'general.closeToTray': createGeneralBinding('closeToTray'),
  'general.spellCheckEnabled': createGeneralBinding('spellCheckEnabled'),
  'general.logFilePath': createGeneralBinding('logFilePath'),
  'general.trustedDomains': trustedDomainsBinding,
  'proxy.enabled': createProxyBinding('enabled'),
  'proxy.protocol': createProxyBinding('protocol'),
  'proxy.host': createProxyBinding('host'),
  'proxy.port': createProxyBinding('port'),
  'proxy.authEnabled': createProxyBinding('authEnabled'),
  'proxy.username': createProxyBinding('username'),
  'proxy.password': createProxyBinding('password'),
  'syntax.codeEditorTheme': codeEditorThemeBinding,
  'syntax.codeEditorFontSize': codeEditorFontSizeBinding,
  'syntax.lineNumbers': createCodeEditorSetupBinding('lineNumbers'),
  'syntax.foldGutter': createCodeEditorSetupBinding('foldGutter'),
  'syntax.highlightActiveLine': createCodeEditorSetupBinding('highlightActiveLine'),
  'syntax.highlightActiveLineGutter': createCodeEditorSetupBinding('highlightActiveLineGutter'),
  'ai.openaiApiKey': createAiBinding('openaiApiKey'),
  'ai.claudeApiKey': createAiBinding('claudeApiKey'),
  'ai.geminiApiKey': createAiBinding('geminiApiKey')
};

/**
 * Maps catalog group ids to get/default/reset handlers (draft or live).
 */
export const SETTING_GROUP_BINDINGS: Partial<Record<GroupSettingId, SettingFieldBinding>> = {
  'backup-restore.confirmations': confirmationsBinding,
  'git.autoTrack': createGeneralBinding('gitAutoAdd'),
  'git.commitAuthor': commitAuthorBinding
};

/**
 * Looks up the field binding for a catalog field id.
 *
 * @param id - Catalog field id.
 * @returns Binding when registered; otherwise undefined.
 */
export function getFieldBinding(id: FieldSettingId): SettingFieldBinding | undefined {
  return SETTING_FIELD_BINDINGS[id];
}

/**
 * Looks up the binding for a catalog field or group id.
 *
 * @param id - Catalog setting id (field or group).
 * @returns Binding when registered; otherwise undefined.
 */
export function getSettingBinding(id: SettingId): SettingFieldBinding | undefined {
  if (id in SETTING_FIELD_BINDINGS) {
    return SETTING_FIELD_BINDINGS[id as FieldSettingId];
  }
  if (id in SETTING_GROUP_BINDINGS) {
    return SETTING_GROUP_BINDINGS[id as GroupSettingId];
  }
  return undefined;
}

/**
 * Returns true when the draft (or live) value for a setting differs from its
 * factory default.
 *
 * Unbound ids are treated as not modified. This is independent of
 * `selectSettingsDraftDirty`, which compares the full draft against the last
 * saved baseline.
 *
 * @param state - Redux root state.
 * @param id - Catalog field or group id.
 * @returns True when the setting is modified relative to factory defaults.
 */
export function isFieldModified(state: RootState, id: SettingId): boolean {
  const binding = getSettingBinding(id);
  if (binding == null) {
    return false;
  }
  const equals = binding.equals ?? valuesEqual;
  return !equals(binding.getValue(state), binding.getDefault());
}

/**
 * Resets a settings field or group to its factory default.
 *
 * Draft bindings write the draft only — they do not call IPC or
 * `saveSettingsDraft`. Live bindings (confirmations) persist immediately via
 * `patchGeneralSettings`. Nested object/array defaults are cloned so factory
 * constants are never mutated in place.
 *
 * After a draft reset, `isFieldModified` is false (draft matches factory
 * default), but `selectSettingsDraftDirty` may become true when the saved
 * baseline differs from the factory default — the user must Save to persist.
 *
 * Unbound ids are a no-op.
 *
 * @param dispatch - Redux dispatch.
 * @param id - Catalog field or group id.
 */
export function resetFieldToDefault(dispatch: AppDispatch, id: SettingId): void {
  const binding = getSettingBinding(id);
  if (binding == null) {
    return;
  }
  binding.reset(dispatch);
}

/**
 * Formats a setting id and current value as a JSON property snippet for the
 * clipboard (e.g. `"general.verifySsl": false`).
 *
 * @param id - Catalog setting id.
 * @param value - Current bound value.
 * @returns JSON property string.
 */
export function formatSettingAsJson(id: SettingId, value: unknown): string {
  return `${JSON.stringify(id)}: ${JSON.stringify(value)}`;
}
