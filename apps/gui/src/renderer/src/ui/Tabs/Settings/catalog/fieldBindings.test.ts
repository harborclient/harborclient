import { describe, expect, it } from 'vitest';
import type { UnknownAction } from '@reduxjs/toolkit';

import type { RootState } from '#/renderer/src/store/redux';
import settingsDraftReducer, {
  initSettingsDraft,
  selectSettingsDraftDirty,
  setDraftAiField,
  setDraftCodeEditorSetupField,
  setDraftGeneralField,
  setDraftProxyField,
  setDraftTerminalField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import navigationReducer, { setShowSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { DEFAULT_GENERAL_SETTINGS } from '@harborclient/core/generalSettings';
import { BUILTIN_USER_AGENT_PRESETS, DEFAULT_USER_AGENT } from '@harborclient/core/userAgent';
import { DEFAULT_AI_SETTINGS } from '#/renderer/src/ui/Tabs/Settings/constants';
import { APPEARANCE_PANEL_DEFAULTS } from '#/renderer/src/ui/Tabs/Settings/appearanceDefaults';

import type { FieldSettingId } from './catalog';
import {
  formatSettingAsJson,
  getFieldBinding,
  getSettingBinding,
  isFieldModified,
  resetFieldToDefault,
  SETTING_FIELD_BINDINGS,
  SETTING_GROUP_BINDINGS
} from './fieldBindings';

/**
 * Field ids registered in `SETTINGS_FIELD_REGISTRY` that have draft bindings
 * (kept here to avoid importing the React component registry in Node vitest).
 */
const SETTINGS_FIELD_REGISTRY_BOUND_IDS: FieldSettingId[] = [
  'general.requestTimeoutMs',
  'general.scriptTimeoutMs',
  'general.allowScriptNetworkRequests',
  'general.allowScriptFileRead',
  'general.allowScriptFileWrite',
  'general.allowScriptWebpage',
  'general.scriptFileRoot',
  'general.maxResponseSizeMb',
  'general.verifySsl',
  'general.followRedirects',
  'general.startWebpageUrl',
  'general.userAgent',
  'general.scrollbarAutoHide',
  'general.wrapTabs',
  'general.closeToTray',
  'general.spellCheckEnabled',
  'general.logFilePath',
  'general.trustedDomains',
  'general.workflowResultsDirectory',
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
  'terminal.scrollback',
  'terminal.cursorBlink',
  'terminal.blinkIntervalDuration',
  'terminal.cursorStyle',
  'terminal.fastScrollSensitivity',
  'terminal.fontSize',
  'terminal.fontFamily',
  'terminal.fontWeight',
  'terminal.minimumContrastRatio',
  'terminal.screenReaderMode',
  'ai.openaiApiKey',
  'ai.claudeApiKey',
  'ai.geminiApiKey',
  'appearance.showSidebar',
  'appearance.showRail',
  'appearance.showAiSidebar',
  'appearance.showGitSidebar',
  'appearance.showShortcutsSidebar',
  'appearance.showRequestEditor',
  'appearance.showResponseEditor',
  'appearance.showConsole',
  'appearance.showVariables',
  'appearance.showMcp',
  'appearance.showTerminal'
];

/**
 * Registry field ids that apply immediately via sidebar expansion context and
 * use SettingField `live` overrides for modified/reset (no Redux binding).
 */
const SETTINGS_FIELD_REGISTRY_DEFERRED_IDS: FieldSettingId[] = [
  'appearance.showStorageLocationBadges',
  'appearance.showMarkers',
  'appearance.showMethodColors',
  'appearance.showIndicators',
  'appearance.showFilters',
  'appearance.showSorting'
];

/**
 * Builds a minimal root state containing the settings draft (and optional live
 * settings) slices.
 *
 * @param draft - Settings draft slice state.
 * @param general - Optional live general settings for group bindings.
 * @param navigation - Optional navigation slice overrides for appearance bindings.
 * @returns Partial root state suitable for binding helpers.
 */
function buildState(
  draft: ReturnType<typeof settingsDraftReducer>,
  general: typeof DEFAULT_GENERAL_SETTINGS = DEFAULT_GENERAL_SETTINGS,
  navigation: ReturnType<typeof navigationReducer> = navigationReducer(undefined, {
    type: '@@init'
  })
): RootState {
  return {
    settingsDraft: draft,
    settings: { general },
    navigation
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
      ai: DEFAULT_AI_SETTINGS,
      mcpServerEnabled: false
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
  it('registers a binding for every draft-backed and live panel SETTINGS_FIELD_REGISTRY id', () => {
    expect(SETTINGS_FIELD_REGISTRY_BOUND_IDS).toHaveLength(56);
    expect(Object.keys(SETTING_FIELD_BINDINGS).sort()).toEqual(
      [...SETTINGS_FIELD_REGISTRY_BOUND_IDS].sort()
    );

    for (const id of SETTINGS_FIELD_REGISTRY_BOUND_IDS) {
      expect(getFieldBinding(id)).toBeDefined();
    }
  });

  it('returns undefined for unbound catalog ids', () => {
    expect(getFieldBinding('ai.enterToSend')).toBeUndefined();
    expect(getFieldBinding('plugins.addCatalogEndpointUrl')).toBeUndefined();
    for (const id of SETTINGS_FIELD_REGISTRY_DEFERRED_IDS) {
      expect(getFieldBinding(id)).toBeUndefined();
    }
  });
});

describe('SETTING_GROUP_BINDINGS', () => {
  it('registers bindings for git and backup confirmation groups', () => {
    expect(getSettingBinding('git.autoTrack')).toBeDefined();
    expect(getSettingBinding('git.commitAuthor')).toBeDefined();
    expect(getSettingBinding('backup-restore.confirmations')).toBeDefined();
    expect(Object.keys(SETTING_GROUP_BINDINGS).sort()).toEqual([
      'backup-restore.confirmations',
      'git.autoTrack',
      'git.commitAuthor'
    ]);
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

  it('detects and resets proxy.password to an empty string', () => {
    let draft = initDefaultDraft();
    expect(isFieldModified(buildState(draft), 'proxy.password')).toBe(false);

    draft = settingsDraftReducer(draft, setDraftProxyField({ key: 'password', value: 's3cret' }));
    expect(isFieldModified(buildState(draft), 'proxy.password')).toBe(true);

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'proxy.password');
    expect(holder.current.general.proxy.password).toBe('');
    expect(isFieldModified(buildState(holder.current), 'proxy.password')).toBe(false);
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

  it('detects and resets terminal.scrollback', () => {
    let draft = initDefaultDraft();
    expect(isFieldModified(buildState(draft), 'terminal.scrollback')).toBe(false);

    draft = settingsDraftReducer(draft, setDraftTerminalField({ key: 'scrollback', value: 5000 }));
    expect(isFieldModified(buildState(draft), 'terminal.scrollback')).toBe(true);

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'terminal.scrollback');
    expect(holder.current.general.terminal.scrollback).toBe(1000);
    expect(isFieldModified(buildState(holder.current), 'terminal.scrollback')).toBe(false);
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

  it('treats factory and generated HarborClient user agents as unmodified', () => {
    let draft = initDefaultDraft();
    expect(isFieldModified(buildState(draft), 'general.userAgent')).toBe(false);

    draft = settingsDraftReducer(
      draft,
      setDraftGeneralField({
        key: 'userAgent',
        value: 'HarborClient/1.2.3 (X11; Linux x86_64) Electron/39.0.0 Chrome/140.0.0.0'
      })
    );
    expect(isFieldModified(buildState(draft), 'general.userAgent')).toBe(false);
  });

  it('marks browser preset user agents as modified and resets to DEFAULT_USER_AGENT', () => {
    let draft = initDefaultDraft();
    const chromePreset = BUILTIN_USER_AGENT_PRESETS[0];

    draft = settingsDraftReducer(
      draft,
      setDraftGeneralField({ key: 'userAgent', value: chromePreset })
    );
    expect(isFieldModified(buildState(draft), 'general.userAgent')).toBe(true);

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'general.userAgent');
    expect(holder.current.general.userAgent).toBe(DEFAULT_USER_AGENT);
    expect(isFieldModified(buildState(holder.current), 'general.userAgent')).toBe(false);
  });

  it('detects and resets git.autoTrack via the group binding', () => {
    let draft = initDefaultDraft();
    expect(isFieldModified(buildState(draft), 'git.autoTrack')).toBe(false);

    draft = settingsDraftReducer(draft, setDraftGeneralField({ key: 'gitAutoAdd', value: false }));
    expect(isFieldModified(buildState(draft), 'git.autoTrack')).toBe(true);

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'git.autoTrack');
    expect(holder.current.general.gitAutoAdd).toBe(true);
    expect(isFieldModified(buildState(holder.current), 'git.autoTrack')).toBe(false);
  });

  it('detects and resets git.commitAuthor as a composite', () => {
    let draft = initDefaultDraft();
    expect(isFieldModified(buildState(draft), 'git.commitAuthor')).toBe(false);

    draft = settingsDraftReducer(
      draft,
      setDraftGeneralField({ key: 'gitCommitAuthorName', value: 'Ada' })
    );
    expect(isFieldModified(buildState(draft), 'git.commitAuthor')).toBe(true);

    draft = settingsDraftReducer(
      draft,
      setDraftGeneralField({ key: 'gitCommitAuthorEmail', value: 'ada@example.com' })
    );
    expect(isFieldModified(buildState(draft), 'git.commitAuthor')).toBe(true);

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'git.commitAuthor');
    expect(holder.current.general.gitCommitAuthorName).toBe('');
    expect(holder.current.general.gitCommitAuthorEmail).toBe('');
    expect(isFieldModified(buildState(holder.current), 'git.commitAuthor')).toBe(false);
  });

  it('detects modified backup confirmations from the live store and resets via patch', () => {
    const draft = initDefaultDraft();
    const modifiedGeneral = {
      ...DEFAULT_GENERAL_SETTINGS,
      warnWhenSwitchingThemes: false
    };
    expect(
      isFieldModified(buildState(draft, modifiedGeneral), 'backup-restore.confirmations')
    ).toBe(true);
    expect(
      isFieldModified(buildState(draft, DEFAULT_GENERAL_SETTINGS), 'backup-restore.confirmations')
    ).toBe(false);

    const dispatched: unknown[] = [];
    const dispatch = ((action: unknown) => {
      dispatched.push(action);
      return action;
    }) as never;

    resetFieldToDefault(dispatch, 'backup-restore.confirmations');
    // Live confirmations reset dispatches the patchGeneralSettings async thunk.
    expect(dispatched).toHaveLength(1);
    expect(typeof dispatched[0]).toBe('function');
  });

  it('detects and resets appearance.showSidebar from navigation state', () => {
    const draft = initDefaultDraft();
    const defaultNav = navigationReducer(undefined, { type: '@@init' });
    expect(
      isFieldModified(
        buildState(draft, DEFAULT_GENERAL_SETTINGS, defaultNav),
        'appearance.showSidebar'
      )
    ).toBe(false);

    const modifiedNav = navigationReducer(defaultNav, setShowSidebar(false));
    expect(
      isFieldModified(
        buildState(draft, DEFAULT_GENERAL_SETTINGS, modifiedNav),
        'appearance.showSidebar'
      )
    ).toBe(true);
    expect(APPEARANCE_PANEL_DEFAULTS.showSidebar).toBe(true);

    let nav = modifiedNav;
    const dispatch = ((action: UnknownAction) => {
      nav = navigationReducer(nav, action);
      return action;
    }) as never;

    resetFieldToDefault(dispatch, 'appearance.showSidebar');
    expect(nav.showSidebar).toBe(true);
    expect(
      isFieldModified(buildState(draft, DEFAULT_GENERAL_SETTINGS, nav), 'appearance.showSidebar')
    ).toBe(false);
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

  it('marks modified but not dirty when baseline differs from factory default', () => {
    let draft = settingsDraftReducer(
      undefined,
      initSettingsDraft({
        general: { ...DEFAULT_GENERAL_SETTINGS, verifySsl: false },
        ai: DEFAULT_AI_SETTINGS,
        mcpServerEnabled: false
      })
    );

    expect(isFieldModified(buildState(draft), 'general.verifySsl')).toBe(true);
    expect(selectSettingsDraftDirty(buildState(draft))).toBe(false);

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'general.verifySsl');
    draft = holder.current;

    expect(draft.general.verifySsl).toBe(true);
    expect(isFieldModified(buildState(draft), 'general.verifySsl')).toBe(false);
    expect(selectSettingsDraftDirty(buildState(draft))).toBe(true);
    expect(draft.baseline?.general.verifySsl).toBe(false);
  });

  it('clones nested defaults so reset does not share factory arrays', () => {
    let draft = settingsDraftReducer(
      undefined,
      initSettingsDraft({
        general: {
          ...DEFAULT_GENERAL_SETTINGS,
          trustedExternalDomains: [{ domain: 'example.com', enabled: true }]
        },
        ai: DEFAULT_AI_SETTINGS,
        mcpServerEnabled: false
      })
    );

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'general.trustedDomains');
    draft = holder.current;

    expect(draft.general.trustedExternalDomains).toEqual([]);
    expect(draft.general.trustedExternalDomains).not.toBe(
      DEFAULT_GENERAL_SETTINGS.trustedExternalDomains
    );

    // Mutating a detached copy must not affect the factory constant either.
    const detached = [...draft.general.trustedExternalDomains];
    detached.push({ domain: 'mutated.test', enabled: true });
    expect(DEFAULT_GENERAL_SETTINGS.trustedExternalDomains).toEqual([]);
    expect(draft.general.trustedExternalDomains).toEqual([]);
  });

  it('resets ai.openaiApiKey to an empty draft string', () => {
    let draft = initDefaultDraft();
    draft = settingsDraftReducer(
      draft,
      setDraftAiField({ key: 'openaiApiKey', value: 'sk-test-key' })
    );
    expect(isFieldModified(buildState(draft), 'ai.openaiApiKey')).toBe(true);

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'ai.openaiApiKey');
    expect(holder.current.ai.openaiApiKey).toBe('');
    expect(isFieldModified(buildState(holder.current), 'ai.openaiApiKey')).toBe(false);
  });

  it('compares numeric requestTimeoutMs against the factory default', () => {
    let draft = initDefaultDraft();
    expect(isFieldModified(buildState(draft), 'general.requestTimeoutMs')).toBe(false);

    draft = settingsDraftReducer(
      draft,
      setDraftGeneralField({ key: 'requestTimeoutMs', value: 60_000 })
    );
    expect(isFieldModified(buildState(draft), 'general.requestTimeoutMs')).toBe(true);

    const holder = { current: draft };
    resetFieldToDefault(createDraftDispatch(holder) as never, 'general.requestTimeoutMs');
    expect(holder.current.general.requestTimeoutMs).toBe(DEFAULT_GENERAL_SETTINGS.requestTimeoutMs);
    expect(isFieldModified(buildState(holder.current), 'general.requestTimeoutMs')).toBe(false);
  });

  it('formats a setting as a JSON property snippet', () => {
    expect(formatSettingAsJson('general.verifySsl', false)).toBe('"general.verifySsl": false');
  });
});
