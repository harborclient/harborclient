import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatPluginThemeValue } from '#/shared/plugin/types';
import type { RegisteredPluginTheme } from '#/shared/plugin/types';
import {
  isActivePluginTheme,
  markThemePrompted,
  readPromptedThemeKeys,
  selectThemePromptCandidates,
  themePromptKey
} from '#/renderer/src/plugins/pluginThemePromptLogic';

const THEME_PLUGIN_ID = 'com.example.theme';
const OTHER_PLUGIN_ID = 'com.example.other';

/**
 * Minimal localStorage mock backed by an in-memory map for theme prompt tests.
 */
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  };
}

/**
 * Sample registered plugin theme used in prompt selection tests.
 */
function sampleTheme(overrides: Partial<RegisteredPluginTheme> = {}): RegisteredPluginTheme {
  return {
    pluginId: THEME_PLUGIN_ID,
    id: 'dark',
    title: 'Dark',
    type: 'dark',
    ...overrides
  };
}

describe('themePromptKey', () => {
  it('combines plugin and theme ids', () => {
    expect(themePromptKey(THEME_PLUGIN_ID, 'dark')).toBe(`${THEME_PLUGIN_ID}:dark`);
  });
});

describe('readPromptedThemeKeys', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty set when localStorage is unset', () => {
    expect(readPromptedThemeKeys()).toEqual(new Set());
  });

  it('persists prompted keys only after markThemePrompted is called', () => {
    markThemePrompted(themePromptKey(THEME_PLUGIN_ID, 'dark'));
    expect(readPromptedThemeKeys()).toEqual(new Set([`${THEME_PLUGIN_ID}:dark`]));
  });
});

describe('isActivePluginTheme', () => {
  it('matches persisted plugin theme values', () => {
    expect(
      isActivePluginTheme(formatPluginThemeValue(THEME_PLUGIN_ID, 'dark'), THEME_PLUGIN_ID, 'dark')
    ).toBe(true);
    expect(isActivePluginTheme('system', THEME_PLUGIN_ID, 'dark')).toBe(false);
  });
});

describe('selectThemePromptCandidates', () => {
  const inFlightKeys = new Set<string>();

  it('returns themes for pending plugins that have not been prompted', () => {
    const pending = new Set([THEME_PLUGIN_ID]);
    const themes = [sampleTheme()];

    expect(
      selectThemePromptCandidates(themes, (pluginId) => pending.has(pluginId), inFlightKeys)
    ).toEqual(themes);
  });

  it('returns no themes when the plugin was not user-marked for prompt', () => {
    const themes = [sampleTheme()];

    expect(selectThemePromptCandidates(themes, () => false, inFlightKeys)).toEqual([]);
  });

  it('skips themes that are already being offered in another effect run', () => {
    const pending = new Set([THEME_PLUGIN_ID]);
    const theme = sampleTheme();
    const key = themePromptKey(theme.pluginId, theme.id);

    expect(
      selectThemePromptCandidates([theme], (pluginId) => pending.has(pluginId), new Set([key]))
    ).toEqual([]);
  });

  it('filters by pending plugin id only', () => {
    const pending = new Set([THEME_PLUGIN_ID]);
    const themes = [
      sampleTheme(),
      sampleTheme({ pluginId: OTHER_PLUGIN_ID, id: 'light', title: 'Light', type: 'light' })
    ];

    expect(
      selectThemePromptCandidates(themes, (pluginId) => pending.has(pluginId), inFlightKeys)
    ).toEqual([themes[0]]);
  });
});
