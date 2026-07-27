import { DEFAULT_CODE_EDITOR_SETUP } from '@harborclient/core/codeEditorSettings';
import { DEFAULT_GENERAL_SETTINGS } from '@harborclient/core/generalSettings';
import type {
  AiSettings,
  CodeEditorSetup,
  GeneralSettings,
  ProxySettings,
  TrustedExternalDomain
} from '@harborclient/core/types';

import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import {
  setDraftAiField,
  setDraftCodeEditorSetupField,
  setDraftCodeEditorTheme,
  setDraftGeneralField,
  setDraftProxyField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { DEFAULT_AI_SETTINGS } from '#/renderer/src/ui/Tabs/Settings/constants';

import type { FieldSettingId } from './catalog';

/**
 * Composite draft value for the trusted-domains setting (master toggle + registry).
 */
type TrustedDomainsValue = {
  allowAllExternalDomains: boolean;
  trustedExternalDomains: TrustedExternalDomain[];
};

/**
 * Maps a catalog field id to draft read, factory default, and reset dispatch.
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
   * Writes the factory default into the draft via existing slice actions.
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
      dispatch(setDraftGeneralField({ key, value: DEFAULT_GENERAL_SETTINGS[key] }));
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
      dispatch(setDraftCodeEditorSetupField({ key, value: DEFAULT_CODE_EDITOR_SETUP[key] }));
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
    trustedExternalDomains: DEFAULT_GENERAL_SETTINGS.trustedExternalDomains
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
      value: DEFAULT_GENERAL_SETTINGS.trustedExternalDomains
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
    dispatch(setDraftCodeEditorTheme(DEFAULT_GENERAL_SETTINGS.codeEditorTheme));
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
        value: DEFAULT_GENERAL_SETTINGS.codeEditorFontSize
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
  'general.userAgent': createGeneralBinding('userAgent'),
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
 * Looks up the field binding for a catalog id.
 *
 * @param id - Catalog field id.
 * @returns Binding when registered; otherwise undefined.
 */
export function getFieldBinding(id: FieldSettingId): SettingFieldBinding | undefined {
  return SETTING_FIELD_BINDINGS[id];
}

/**
 * Returns true when the draft value for a field differs from its factory default.
 *
 * Unbound ids are treated as not modified.
 *
 * @param state - Redux root state.
 * @param id - Catalog field id.
 * @returns True when the field is modified relative to factory defaults.
 */
export function isFieldModified(state: RootState, id: FieldSettingId): boolean {
  const binding = getFieldBinding(id);
  if (binding == null) {
    return false;
  }
  const equals = binding.equals ?? valuesEqual;
  return !equals(binding.getValue(state), binding.getDefault());
}

/**
 * Resets a settings field to its factory default in the draft.
 *
 * Unbound ids are a no-op.
 *
 * @param dispatch - Redux dispatch.
 * @param id - Catalog field id.
 */
export function resetFieldToDefault(dispatch: AppDispatch, id: FieldSettingId): void {
  const binding = getFieldBinding(id);
  if (binding == null) {
    return;
  }
  binding.reset(dispatch);
}
