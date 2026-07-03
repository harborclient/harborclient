import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadPersistedScriptEditorUiState,
  parsePersistedScriptEditorUiState,
  parseScriptEditorMinHeightPx,
  persistScriptEditorUiState,
  scriptEditorHeightStorageKey,
  scriptEditorUiStorageKey
} from '#/renderer/src/hooks/usePersistedScriptEditorUiState';

const SCRIPT_ID = 'script-abc';
const MIN_PX = 125;

/**
 * Minimal localStorage mock backed by an in-memory map for UI state persistence tests.
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

describe('scriptEditorUiStorageKey', () => {
  it('scopes UI state to the script id', () => {
    expect(scriptEditorUiStorageKey(SCRIPT_ID)).toBe('hc.scriptEditorUi.script-abc');
  });
});

describe('parseScriptEditorMinHeightPx', () => {
  it('parses pixel strings', () => {
    expect(parseScriptEditorMinHeightPx('125px')).toBe(125);
  });

  it('falls back when the value is not px', () => {
    expect(parseScriptEditorMinHeightPx('10rem')).toBe(125);
  });
});

describe('parsePersistedScriptEditorUiState', () => {
  it('parses height, scroll, and selection', () => {
    const raw = JSON.stringify({
      heightPx: 240,
      scrollTop: 80,
      selection: { anchor: 10, head: 20 }
    });
    expect(parsePersistedScriptEditorUiState(raw, MIN_PX)).toEqual({
      heightPx: 240,
      scrollTop: 80,
      selection: { anchor: 10, head: 20 }
    });
  });

  it('clamps height to the minimum and ignores invalid fields', () => {
    const raw = JSON.stringify({
      heightPx: 80,
      scrollTop: -5,
      selection: { anchor: 'bad', head: 4 }
    });
    expect(parsePersistedScriptEditorUiState(raw, MIN_PX)).toEqual({
      heightPx: 125,
      scrollTop: 0
    });
  });

  it('returns null for invalid JSON', () => {
    expect(parsePersistedScriptEditorUiState('not-json', MIN_PX)).toBeNull();
  });
});

describe('loadPersistedScriptEditorUiState', () => {
  it('returns null when nothing is stored', () => {
    expect(loadPersistedScriptEditorUiState(SCRIPT_ID, MIN_PX)).toBeNull();
  });

  it('loads unified UI state JSON', () => {
    localStorage.setItem(
      scriptEditorUiStorageKey(SCRIPT_ID),
      JSON.stringify({ heightPx: 200, scrollTop: 40 })
    );
    expect(loadPersistedScriptEditorUiState(SCRIPT_ID, MIN_PX)).toEqual({
      heightPx: 200,
      scrollTop: 40
    });
  });

  it('migrates legacy height-only keys into unified storage', () => {
    localStorage.setItem(scriptEditorHeightStorageKey(SCRIPT_ID), '220');
    expect(loadPersistedScriptEditorUiState(SCRIPT_ID, MIN_PX)).toEqual({ heightPx: 220 });
    expect(localStorage.getItem(scriptEditorUiStorageKey(SCRIPT_ID))).toBe(
      JSON.stringify({ heightPx: 220 })
    );
    expect(localStorage.getItem(scriptEditorHeightStorageKey(SCRIPT_ID))).toBeNull();
  });
});

describe('persistScriptEditorUiState', () => {
  it('merges patches without dropping existing fields', () => {
    persistScriptEditorUiState(SCRIPT_ID, { heightPx: 200 }, MIN_PX);
    persistScriptEditorUiState(
      SCRIPT_ID,
      { scrollTop: 55, selection: { anchor: 1, head: 3 } },
      MIN_PX
    );

    expect(JSON.parse(localStorage.getItem(scriptEditorUiStorageKey(SCRIPT_ID))!)).toEqual({
      heightPx: 200,
      scrollTop: 55,
      selection: { anchor: 1, head: 3 }
    });
  });
});
