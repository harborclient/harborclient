import { describe, expect, it } from 'vitest';
import { DEFAULT_GENERAL_SETTINGS } from '../generalSettings.js';
import {
  hasGeneralSettingsAiPatch,
  listChangedGeneralSettingsKeys,
  mergeGeneralSettingsAiPatch,
  REDACTED_PROXY_PASSWORD,
  sanitizeGeneralSettingsForAi
} from './generalSettingsForAi.js';

describe('hasGeneralSettingsAiPatch', () => {
  it('returns false for an empty object', () => {
    expect(hasGeneralSettingsAiPatch({})).toBe(false);
  });

  it('returns true when any field is present', () => {
    expect(hasGeneralSettingsAiPatch({ verifySsl: false })).toBe(true);
  });
});

describe('sanitizeGeneralSettingsForAi', () => {
  it('leaves an empty proxy password unchanged', () => {
    const sanitized = sanitizeGeneralSettingsForAi(DEFAULT_GENERAL_SETTINGS);
    expect(sanitized.proxy.password).toBe('');
    expect(sanitized.verifySsl).toBe(true);
  });

  it('redacts a non-empty proxy password', () => {
    const sanitized = sanitizeGeneralSettingsForAi({
      ...DEFAULT_GENERAL_SETTINGS,
      proxy: { ...DEFAULT_GENERAL_SETTINGS.proxy, password: 'secret' }
    });
    expect(sanitized.proxy.password).toBe(REDACTED_PROXY_PASSWORD);
    expect(sanitized.proxy.host).toBe(DEFAULT_GENERAL_SETTINGS.proxy.host);
  });
});

describe('mergeGeneralSettingsAiPatch', () => {
  it('updates verifySsl without touching unrelated fields', () => {
    const merged = mergeGeneralSettingsAiPatch(DEFAULT_GENERAL_SETTINGS, { verifySsl: false });
    expect(merged.verifySsl).toBe(false);
    expect(merged.followRedirects).toBe(DEFAULT_GENERAL_SETTINGS.followRedirects);
    expect(merged.requestTimeoutMs).toBe(DEFAULT_GENERAL_SETTINGS.requestTimeoutMs);
  });

  it('deep-merges proxy so partial updates keep sibling fields', () => {
    const current = {
      ...DEFAULT_GENERAL_SETTINGS,
      proxy: {
        enabled: false,
        protocol: 'http' as const,
        host: 'proxy.example',
        port: 8080,
        authEnabled: true,
        username: 'user',
        password: 'secret'
      }
    };
    const merged = mergeGeneralSettingsAiPatch(current, { proxy: { enabled: true } });
    expect(merged.proxy).toEqual({
      enabled: true,
      protocol: 'http',
      host: 'proxy.example',
      port: 8080,
      authEnabled: true,
      username: 'user',
      password: 'secret'
    });
  });

  it('deep-merges codeEditorSetup', () => {
    const merged = mergeGeneralSettingsAiPatch(DEFAULT_GENERAL_SETTINGS, {
      codeEditorSetup: { lineNumbers: false }
    });
    expect(merged.codeEditorSetup.lineNumbers).toBe(false);
    expect(merged.codeEditorSetup.foldGutter).toBe(
      DEFAULT_GENERAL_SETTINGS.codeEditorSetup.foldGutter
    );
  });
});

describe('listChangedGeneralSettingsKeys', () => {
  it('returns only keys that differ after a merge', () => {
    const after = mergeGeneralSettingsAiPatch(DEFAULT_GENERAL_SETTINGS, {
      verifySsl: false,
      proxy: { enabled: true }
    });
    expect(listChangedGeneralSettingsKeys(DEFAULT_GENERAL_SETTINGS, after)).toEqual([
      'proxy',
      'verifySsl'
    ]);
  });
});
