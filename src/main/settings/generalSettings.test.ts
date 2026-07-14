import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_PROXY_SETTINGS,
  getGeneralSettings,
  isPluginNetworkAllowed,
  setGeneralSettings
} from '#/main/settings/generalSettings';

describe('generalSettings', () => {
  let settingsStore: Record<string, string>;

  beforeEach(() => {
    settingsStore = {};
    const database = {
      getSetting: (key: string) => settingsStore[key],
      setSetting: (key: string, value: string) => {
        settingsStore[key] = value;
      }
    } as LocalDatabase;
    setLocalDatabaseForTesting(database);
  });

  afterEach(() => {
    clearLocalDatabaseForTesting();
  });

  it('returns defaults when unset', () => {
    expect(getGeneralSettings()).toEqual(DEFAULT_GENERAL_SETTINGS);
  });

  it('normalizes invalid proxy protocol and port', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      proxy: {
        enabled: true,
        protocol: 'socks5' as 'http',
        host: ' proxy.local ',
        port: 0,
        authEnabled: true,
        username: 'user',
        password: 'secret'
      }
    });

    expect(getGeneralSettings().proxy).toEqual({
      enabled: true,
      protocol: 'http',
      host: 'proxy.local',
      port: DEFAULT_PROXY_SETTINGS.port,
      authEnabled: true,
      username: 'user',
      password: 'secret'
    });
  });

  it('preserves valid https proxy settings', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      proxy: {
        enabled: true,
        protocol: 'https',
        host: 'secure-proxy.example.com',
        port: 8443,
        authEnabled: false,
        username: '',
        password: ''
      }
    });

    expect(getGeneralSettings().proxy).toEqual({
      enabled: true,
      protocol: 'https',
      host: 'secure-proxy.example.com',
      port: 8443,
      authEnabled: false,
      username: '',
      password: ''
    });
  });

  it('normalizes stored global variables', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      globalVariables: [
        { key: 'baseUrl', value: 'https://api.example.com', defaultValue: '', share: false }
      ]
    });

    expect(getGeneralSettings().globalVariables).toEqual([
      { key: 'baseUrl', value: 'https://api.example.com', defaultValue: '', share: false }
    ]);
  });

  it('returns empty globalVariables when stored value is invalid', () => {
    settingsStore.general = JSON.stringify({
      ...DEFAULT_GENERAL_SETTINGS,
      globalVariables: 'not-an-array'
    });

    expect(getGeneralSettings().globalVariables).toEqual([]);
  });

  it('defaults allowScriptNetworkRequests to false when unset', () => {
    expect(getGeneralSettings().allowScriptNetworkRequests).toBe(false);
  });

  it('persists allowScriptNetworkRequests true', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      allowScriptNetworkRequests: true
    });

    expect(getGeneralSettings().allowScriptNetworkRequests).toBe(true);
  });

  it('defaults allowedNetworkPlugins to [] when unset', () => {
    expect(getGeneralSettings().allowedNetworkPlugins).toEqual([]);
  });

  it('normalizes allowedNetworkPlugins to unique trimmed ids', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      allowedNetworkPlugins: [' com.example.a ', 'com.example.a', '', 'com.example.b']
    });

    expect(getGeneralSettings().allowedNetworkPlugins).toEqual(['com.example.a', 'com.example.b']);
  });

  it('isPluginNetworkAllowed honors global and per-plugin allowlists', () => {
    expect(isPluginNetworkAllowed('com.example.plugin')).toBe(false);

    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      allowedNetworkPlugins: ['com.example.plugin']
    });
    expect(isPluginNetworkAllowed('com.example.plugin')).toBe(true);
    expect(isPluginNetworkAllowed('com.example.other')).toBe(false);

    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      allowScriptNetworkRequests: true
    });
    expect(isPluginNetworkAllowed('com.example.other')).toBe(true);
  });

  it('defaults followRedirects to true when unset', () => {
    expect(getGeneralSettings().followRedirects).toBe(true);
  });

  it('defaults scriptTimeoutMs to 5000 when unset', () => {
    expect(getGeneralSettings().scriptTimeoutMs).toBe(5000);
  });

  it('normalizes invalid scriptTimeoutMs to the default', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      scriptTimeoutMs: -100
    });

    expect(getGeneralSettings().scriptTimeoutMs).toBe(DEFAULT_GENERAL_SETTINGS.scriptTimeoutMs);
  });

  it('persists followRedirects false', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      followRedirects: false
    });

    expect(getGeneralSettings().followRedirects).toBe(false);
  });

  it('defaults gitAutoAdd to true when unset', () => {
    expect(getGeneralSettings().gitAutoAdd).toBe(true);
  });

  it('persists gitAutoAdd false', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      gitAutoAdd: false
    });

    expect(getGeneralSettings().gitAutoAdd).toBe(false);
  });

  it('defaults gitCommitAuthorName and gitCommitAuthorEmail to empty when unset', () => {
    expect(getGeneralSettings().gitCommitAuthorName).toBe('');
    expect(getGeneralSettings().gitCommitAuthorEmail).toBe('');
  });

  it('trims stored git commit author fields', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      gitCommitAuthorName: '  Jane Doe  ',
      gitCommitAuthorEmail: '  jane@example.com  '
    });

    expect(getGeneralSettings().gitCommitAuthorName).toBe('Jane Doe');
    expect(getGeneralSettings().gitCommitAuthorEmail).toBe('jane@example.com');
  });

  it('defaults gitCommitAuthorPrompted to false when unset', () => {
    expect(getGeneralSettings().gitCommitAuthorPrompted).toBe(false);
  });

  it('persists gitCommitAuthorPrompted true', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      gitCommitAuthorPrompted: true
    });

    expect(getGeneralSettings().gitCommitAuthorPrompted).toBe(true);
  });

  it('defaults logFilePath to empty when unset', () => {
    expect(getGeneralSettings().logFilePath).toBe('');
  });

  it('trims stored logFilePath', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      logFilePath: ' /tmp/harborclient.log '
    });

    expect(getGeneralSettings().logFilePath).toBe('/tmp/harborclient.log');
  });

  it('defaults scrollbarAutoHide to false when unset', () => {
    expect(getGeneralSettings().scrollbarAutoHide).toBe(false);
  });

  it('persists scrollbarAutoHide true', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      scrollbarAutoHide: true
    });

    expect(getGeneralSettings().scrollbarAutoHide).toBe(true);
  });

  it('defaults wrapTabs to true when unset', () => {
    expect(getGeneralSettings().wrapTabs).toBe(true);
  });

  it('persists wrapTabs false', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      wrapTabs: false
    });

    expect(getGeneralSettings().wrapTabs).toBe(false);
  });

  it('defaults spellCheckEnabled to true when unset', () => {
    expect(getGeneralSettings().spellCheckEnabled).toBe(true);
  });

  it('persists spellCheckEnabled false', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      spellCheckEnabled: false
    });

    expect(getGeneralSettings().spellCheckEnabled).toBe(false);
  });

  it('defaults warnWhenSwitchingThemes to true when unset', () => {
    expect(getGeneralSettings().warnWhenSwitchingThemes).toBe(true);
  });

  it('persists warnWhenSwitchingThemes false', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      warnWhenSwitchingThemes: false
    });

    expect(getGeneralSettings().warnWhenSwitchingThemes).toBe(false);
  });

  it('defaults warnWhenExitingWithUnsavedChanges to true when unset', () => {
    expect(getGeneralSettings().warnWhenExitingWithUnsavedChanges).toBe(true);
  });

  it('persists warnWhenExitingWithUnsavedChanges false', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      warnWhenExitingWithUnsavedChanges: false
    });

    expect(getGeneralSettings().warnWhenExitingWithUnsavedChanges).toBe(false);
  });

  it('defaults warnWhenClosingUnsavedRequests to true when unset', () => {
    expect(getGeneralSettings().warnWhenClosingUnsavedRequests).toBe(true);
  });

  it('persists warnWhenClosingUnsavedRequests false', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      warnWhenClosingUnsavedRequests: false
    });

    expect(getGeneralSettings().warnWhenClosingUnsavedRequests).toBe(false);
  });

  it('defaults warnWhenCreatingTabGroup to true when unset', () => {
    expect(getGeneralSettings().warnWhenCreatingTabGroup).toBe(true);
  });

  it('persists warnWhenCreatingTabGroup false', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      warnWhenCreatingTabGroup: false
    });

    expect(getGeneralSettings().warnWhenCreatingTabGroup).toBe(false);
  });

  it('defaults warnWhenOpeningTabGroup to true when unset', () => {
    expect(getGeneralSettings().warnWhenOpeningTabGroup).toBe(true);
  });

  it('persists warnWhenOpeningTabGroup false', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      warnWhenOpeningTabGroup: false
    });

    expect(getGeneralSettings().warnWhenOpeningTabGroup).toBe(false);
  });

  it('defaults warnWhenClickingReadonlySnippet to true when unset', () => {
    expect(getGeneralSettings().warnWhenClickingReadonlySnippet).toBe(true);
  });

  it('persists warnWhenClickingReadonlySnippet false', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      warnWhenClickingReadonlySnippet: false
    });

    expect(getGeneralSettings().warnWhenClickingReadonlySnippet).toBe(false);
  });

  it('defaults warnWhenAgentUsesTerminal to true when unset', () => {
    expect(getGeneralSettings().warnWhenAgentUsesTerminal).toBe(true);
  });

  it('persists warnWhenAgentUsesTerminal false', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      warnWhenAgentUsesTerminal: false
    });

    expect(getGeneralSettings().warnWhenAgentUsesTerminal).toBe(false);
  });

  it('defaults codeEditorFontSize to 16px when unset', () => {
    expect(getGeneralSettings().codeEditorFontSize).toBe('16px');
  });

  it('normalizes invalid codeEditorFontSize to the default', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      codeEditorFontSize: '12rem'
    });

    expect(getGeneralSettings().codeEditorFontSize).toBe('16px');
  });

  it('clamps codeEditorFontSize below the minimum', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      codeEditorFontSize: '10px'
    });

    expect(getGeneralSettings().codeEditorFontSize).toBe('14px');
  });
});
