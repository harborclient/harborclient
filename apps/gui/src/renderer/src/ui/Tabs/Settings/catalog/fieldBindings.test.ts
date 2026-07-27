import { describe, expect, it } from 'vitest';
import type { UnknownAction } from '@reduxjs/toolkit';

import type { RootState } from '#/renderer/src/store/redux';
import settingsDraftReducer, {
  initSettingsDraft,
  setDraftCodeEditorSetupField,
  setDraftGeneralField,
  setDraftProxyField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_GENERAL_SETTINGS
} from '#/renderer/src/ui/Tabs/Settings/constants';

import type { FieldSettingId } from './catalog';
import {
  getFieldBinding,
  isFieldModified,
  resetFieldToDefault,
  SETTING_FIELD_BINDINGS
} from './fieldBindings';

/**
 * Field ids registered in `SETTINGS_FIELD_REGISTRY` (kept here to avoid importing
 * the React component registry in Node vitest).
 */
const SETTINGS_FIELD_REGISTRY_IDS: FieldSettingId[] = [
  'general.requestTimeoutMs',
  'general.scriptTimeoutMs',
  'general.allowScriptNetworkRequests',
  'general.allowScriptFileRead',
  'general.allowScriptFileWrite',
  'general.scriptFileRoot',
  'general.maxResponseSizeMb',
  'general.verifySsl',
  'general.followRedirects',
  'general.userAgent',
  'general.scrollbarAutoHide',
  'general.wrapTabs',
  'general.closeToTray',
  'general.spellCheckEnabled',
  'general.logFilePath',
  'general.trustedDomains',
  'proxy.enabled',
  'proxy.protocol',
  'proxy.host',
  'proxy.port',
  'proxy.authEnabled',
  'proxy.username',
  'proxy.password',
  'syntax.codeEditorTheme',
  'syntax.codeEditorFontSize',
  'syntax.lineNumbers',
  'syntax.foldGutter',
  'syntax.highlightActiveLine',
  'syntax.highlightActiveLineGutter',
  'ai.openaiApiKey',
  'ai.claudeApiKey',
  'ai.geminiApiKey'
];

/**
 * Builds a minimal root state containing only the settings draft slice.
 *
 * @param draft - Settings draft slice state.
 * @returns Partial root state suitable for binding helpers.
 */
function buildState(draft: ReturnType<typeof settingsDraftReducer>): RootState {
  return {
    settingsDraft: draft
  } as RootState;
}

/**
 * Initializes a draft at factory defaults.
 *
 * @returns Fresh draft state after init.
 */
function initDefaultDraft(): ReturnType<typeof settingsDraftReducer> {
  return settingsDraftReducer(
    undefined,
    initSettingsDraft({
      general: DEFAULT_GENERAL_SETTINGS,
      ai: DEFAULT_AI_SETTINGS
    })
  );
}

/**
 * Applies a sequence of draft actions via the settings draft reducer.
 *
 * Used as a stand-in for AppDispatch in reset tests.
 *
 * @param draft - Current draft slice state.
 * @returns Dispatch function that mutates and returns the latest draft.
 */
function createDraftDispatch(draft: {
  current: ReturnType<typeof settingsDraftReducer>;
}): (action: UnknownAction) => UnknownAction {
  return (action) => {
    draft.current = settingsDraftReducer(draft.current, action);
    return action;
  };
}

describe('SETTING_FIELD_BINDINGS', () => {
  it('registers a binding for every SETTINGS_FIELD_REGISTRY id', () => {
    expect(SETTINGS_FIELD_REGISTRY_IDS).toHaveLength(32);
    expect(Object.keys(SETTING_FIELD_BINDINGS).sort()).toEqual(
      [...SETTINGS_FIELD_REGISTRY_IDS].sort()
    );

    for (const id of SETTINGS_FIELD_REGISTRY_IDS) {
      expect(getFieldBinding(id)).toBeDefined();
    }
  });

  it('returns undefined for unbound catalog ids', () => {
    expect(getFieldBinding('ai.enterToSend')).toBeUndefined();
    expect(getFieldBinding('plugins.addCatalogEndpointUrl')).toBeUndefined();
  });
});

describe('isFieldModified / resetFieldToDefault', () => {
  it('detects and resets general.verifySsl', () => {
    let draft = initDefaultDraft();
    expect(isFieldModified(buildState(draft), 'general.verifySsl')).toBe(false);

    draft = settingsDraftReducer(draft, setDraftGeneralField({ key: 'verifySsl', value: false }));
    expect(isFieldModified(buildState(draft), 'general.verifySsl')).toBe(true);

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'general.verifySsl');
    expect(holder.current.general.verifySsl).toBe(true);
    expect(isFieldModified(buildState(holder.current), 'general.verifySsl')).toBe(false);
  });

  it('detects and resets proxy.host', () => {
    let draft = initDefaultDraft();
    expect(isFieldModified(buildState(draft), 'proxy.host')).toBe(false);

    draft = settingsDraftReducer(
      draft,
      setDraftProxyField({ key: 'host', value: 'proxy.example.com' })
    );
    expect(isFieldModified(buildState(draft), 'proxy.host')).toBe(true);

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'proxy.host');
    expect(holder.current.general.proxy.host).toBe('');
    expect(isFieldModified(buildState(holder.current), 'proxy.host')).toBe(false);
  });

  it('detects and resets syntax.lineNumbers', () => {
    let draft = initDefaultDraft();
    expect(isFieldModified(buildState(draft), 'syntax.lineNumbers')).toBe(false);

    draft = settingsDraftReducer(
      draft,
      setDraftCodeEditorSetupField({ key: 'lineNumbers', value: false })
    );
    expect(isFieldModified(buildState(draft), 'syntax.lineNumbers')).toBe(true);

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'syntax.lineNumbers');
    expect(holder.current.general.codeEditorSetup.lineNumbers).toBe(true);
    expect(isFieldModified(buildState(holder.current), 'syntax.lineNumbers')).toBe(false);
  });

  it('detects and resets general.trustedDomains as a composite', () => {
    let draft = initDefaultDraft();
    expect(isFieldModified(buildState(draft), 'general.trustedDomains')).toBe(false);

    draft = settingsDraftReducer(
      draft,
      setDraftGeneralField({ key: 'allowAllExternalDomains', value: true })
    );
    expect(isFieldModified(buildState(draft), 'general.trustedDomains')).toBe(true);

    draft = settingsDraftReducer(
      draft,
      setDraftGeneralField({
        key: 'trustedExternalDomains',
        value: [{ domain: 'example.com', enabled: true }]
      })
    );
    expect(isFieldModified(buildState(draft), 'general.trustedDomains')).toBe(true);

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'general.trustedDomains');
    expect(holder.current.general.allowAllExternalDomains).toBe(false);
    expect(holder.current.general.trustedExternalDomains).toEqual([]);
    expect(isFieldModified(buildState(holder.current), 'general.trustedDomains')).toBe(false);
  });

  it('treats unknown ids as not modified and no-op on reset', () => {
    const draft = initDefaultDraft();
    const before = structuredClone(draft);

    expect(isFieldModified(buildState(draft), 'ai.enterToSend')).toBe(false);
    expect(isFieldModified(buildState(draft), 'plugins.addTrustedEndpointUrl')).toBe(false);

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'ai.enterToSend');
    expect(holder.current).toEqual(before);
  });
});
