import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultScriptGroupExpansion,
  isScriptEditorGroup,
  loadPersistedScriptGroupExpansion,
  parsePersistedScriptGroupExpansion,
  persistScriptGroupExpansion,
  scriptGroupExpansionScopeKey,
  scriptGroupExpansionStorageKey
} from './usePersistedScriptGroupExpansion';

/**
 * Minimal localStorage mock backed by an in-memory map for expansion persistence tests.
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

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scriptGroupExpansionStorageKey', () => {
  it('scopes expansion to request id and phase', () => {
    expect(scriptGroupExpansionStorageKey('42', 'pre')).toBe('hc.scriptGroupExpand.42.pre');
    expect(scriptGroupExpansionStorageKey('42', 'post')).toBe('hc.scriptGroupExpand.42.post');
  });

  it('scopes expansion to tab fallback keys', () => {
    expect(scriptGroupExpansionStorageKey('tab:abc', 'pre')).toBe(
      'hc.scriptGroupExpand.tab:abc.pre'
    );
  });
});

describe('scriptGroupExpansionScopeKey', () => {
  it('prefers the saved request id', () => {
    expect(scriptGroupExpansionScopeKey(42, 'tab-1')).toBe('42');
  });

  it('falls back to the open tab id', () => {
    expect(scriptGroupExpansionScopeKey(undefined, 'tab-abc')).toBe('tab:tab-abc');
  });

  it('returns null when neither identity is available', () => {
    expect(scriptGroupExpansionScopeKey(undefined, undefined)).toBeNull();
    expect(scriptGroupExpansionScopeKey(undefined, '  ')).toBeNull();
  });
});

describe('isScriptEditorGroup', () => {
  it('accepts known groups and rejects others', () => {
    expect(isScriptEditorGroup('before')).toBe(true);
    expect(isScriptEditorGroup('main')).toBe(true);
    expect(isScriptEditorGroup('after')).toBe(true);
    expect(isScriptEditorGroup('before-all')).toBe(false);
  });
});

describe('parsePersistedScriptGroupExpansion', () => {
  it('parses boolean group flags', () => {
    const raw = JSON.stringify({ before: false, main: true, after: false });
    expect(parsePersistedScriptGroupExpansion(raw)).toEqual({
      before: false,
      main: true,
      after: false
    });
  });

  it('defaults missing keys to expanded and ignores unknown keys', () => {
    const raw = JSON.stringify({ before: false, extra: true });
    expect(parsePersistedScriptGroupExpansion(raw)).toEqual({
      before: false,
      main: true,
      after: true
    });
  });

  it('returns null for invalid JSON or non-objects', () => {
    expect(parsePersistedScriptGroupExpansion('not-json')).toBeNull();
    expect(parsePersistedScriptGroupExpansion('[]')).toBeNull();
    expect(parsePersistedScriptGroupExpansion('null')).toBeNull();
  });
});

describe('loadPersistedScriptGroupExpansion', () => {
  it('returns defaults when scope is null or storage is empty', () => {
    expect(loadPersistedScriptGroupExpansion(null, 'pre')).toEqual(defaultScriptGroupExpansion());
    expect(loadPersistedScriptGroupExpansion('42', 'pre')).toEqual(defaultScriptGroupExpansion());
  });

  it('loads stored expansion for a scope and phase', () => {
    persistScriptGroupExpansion('42', 'pre', {
      before: false,
      main: true,
      after: false
    });
    expect(loadPersistedScriptGroupExpansion('42', 'pre')).toEqual({
      before: false,
      main: true,
      after: false
    });
    expect(loadPersistedScriptGroupExpansion('42', 'post')).toEqual(defaultScriptGroupExpansion());
  });
});

describe('persistScriptGroupExpansion', () => {
  it('no-ops when scope is null', () => {
    persistScriptGroupExpansion(null, 'pre', {
      before: false,
      main: false,
      after: false
    });
    expect(localStorage.length).toBe(0);
  });

  it('writes JSON under the scoped storage key', () => {
    const state = { before: true, main: false, after: true };
    persistScriptGroupExpansion('99', 'post', state);
    expect(localStorage.getItem(scriptGroupExpansionStorageKey('99', 'post'))).toBe(
      JSON.stringify(state)
    );
  });
});
