import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONSOLE_SECTIONS_STORAGE_KEY,
  defaultConsoleSectionExpansion,
  isConsoleSectionKey,
  loadPersistedConsoleSectionExpansion,
  parsePersistedConsoleSectionExpansion,
  persistConsoleSectionExpansion
} from '#/renderer/src/ui/shared/ConsoleDetails/usePersistedConsoleSectionExpansion';

/**
 * Minimal localStorage mock backed by an in-memory map for console section tests.
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

describe('defaultConsoleSectionExpansion', () => {
  it('returns all sections expanded', () => {
    expect(defaultConsoleSectionExpansion()).toEqual({
      general: true,
      request: true,
      response: true,
      output: true,
      trace: true
    });
  });
});

describe('isConsoleSectionKey', () => {
  it('accepts known section keys', () => {
    expect(isConsoleSectionKey('general')).toBe(true);
    expect(isConsoleSectionKey('trace')).toBe(true);
  });

  it('rejects unknown keys', () => {
    expect(isConsoleSectionKey('headers')).toBe(false);
    expect(isConsoleSectionKey('')).toBe(false);
  });
});

describe('parsePersistedConsoleSectionExpansion', () => {
  it('parses a complete persisted map', () => {
    expect(
      parsePersistedConsoleSectionExpansion(
        JSON.stringify({
          general: true,
          request: false,
          response: true,
          output: false,
          trace: true
        })
      )
    ).toEqual({
      general: true,
      request: false,
      response: true,
      output: false,
      trace: true
    });
  });

  it('fills missing known keys with expanded defaults', () => {
    expect(parsePersistedConsoleSectionExpansion(JSON.stringify({ request: false }))).toEqual({
      general: true,
      request: false,
      response: true,
      output: true,
      trace: true
    });
  });

  it('ignores unknown keys', () => {
    expect(
      parsePersistedConsoleSectionExpansion(
        JSON.stringify({
          request: false,
          unknown: false
        })
      )
    ).toEqual({
      general: true,
      request: false,
      response: true,
      output: true,
      trace: true
    });
  });

  it('returns null for invalid JSON', () => {
    expect(parsePersistedConsoleSectionExpansion('not-json')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parsePersistedConsoleSectionExpansion('[]')).toBeNull();
    expect(parsePersistedConsoleSectionExpansion('null')).toBeNull();
  });
});

describe('loadPersistedConsoleSectionExpansion', () => {
  it('returns defaults when storage is empty', () => {
    expect(loadPersistedConsoleSectionExpansion()).toEqual(defaultConsoleSectionExpansion());
  });

  it('loads persisted state from localStorage', () => {
    localStorage.setItem(
      CONSOLE_SECTIONS_STORAGE_KEY,
      JSON.stringify({
        general: false,
        request: true,
        response: false,
        output: true,
        trace: false
      })
    );

    expect(loadPersistedConsoleSectionExpansion()).toEqual({
      general: false,
      request: true,
      response: false,
      output: true,
      trace: false
    });
  });

  it('falls back to defaults when stored JSON is invalid', () => {
    localStorage.setItem(CONSOLE_SECTIONS_STORAGE_KEY, '{bad json');

    expect(loadPersistedConsoleSectionExpansion()).toEqual(defaultConsoleSectionExpansion());
  });
});

describe('persistConsoleSectionExpansion', () => {
  it('round-trips section expansion through localStorage', () => {
    const state = {
      general: false,
      request: true,
      response: false,
      output: false,
      trace: true
    };

    persistConsoleSectionExpansion(state);

    expect(localStorage.getItem(CONSOLE_SECTIONS_STORAGE_KEY)).toBe(JSON.stringify(state));
    expect(loadPersistedConsoleSectionExpansion()).toEqual(state);
  });
});
