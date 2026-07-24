import { configureStore, type EnhancedStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  persistTerminalLayout,
  TERMINAL_LAYOUT_KEY,
  type PersistedTerminalLayout
} from './persistence';
import terminalsReducer, {
  addTerminal,
  hydrateTerminals
} from '#/renderer/src/store/slices/terminalsSlice';

/**
 * Minimal localStorage mock backed by an in-memory map for persistence tests.
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
 * Builds a test store that mirrors the terminal persistence gate in redux.ts.
 */
function createTerminalPersistenceTestStore(): EnhancedStore<{
  terminals: ReturnType<typeof terminalsReducer>;
}> {
  const store = configureStore({
    reducer: {
      terminals: terminalsReducer
    }
  });

  store.subscribe(() => {
    const state = store.getState();
    if (state.terminals.terminalsHydrated) {
      persistTerminalLayout(state.terminals.terminals, state.terminals.activeTerminalId);
    }
  });

  return store;
}

/**
 * Reads the persisted terminal layout payload from localStorage.
 */
function readPersistedTerminalLayout(): PersistedTerminalLayout | null {
  const raw = localStorage.getItem(TERMINAL_LAYOUT_KEY);
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as PersistedTerminalLayout;
}

describe('redux terminal persistence gate', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not persist terminal layout before hydration completes', () => {
    localStorage.setItem(
      TERMINAL_LAYOUT_KEY,
      JSON.stringify({
        terminals: [
          { id: 't-1', title: 'Saved 1', cwd: '' },
          { id: 't-2', title: 'Saved 2', cwd: '/tmp' }
        ],
        activeTerminalId: 't-2'
      } satisfies PersistedTerminalLayout)
    );

    const store = createTerminalPersistenceTestStore();
    store.dispatch(addTerminal());

    expect(readPersistedTerminalLayout()).toEqual({
      terminals: [
        { id: 't-1', title: 'Saved 1', cwd: '' },
        { id: 't-2', title: 'Saved 2', cwd: '/tmp' }
      ],
      activeTerminalId: 't-2'
    });
  });

  it('persists terminal layout after hydration and subsequent changes', () => {
    const store = createTerminalPersistenceTestStore();

    store.dispatch(
      hydrateTerminals({
        terminals: [{ id: 't-1', title: 'Saved', cwd: '' }],
        activeTerminalId: 't-1',
        selectionSnapshots: {}
      })
    );
    store.dispatch(addTerminal());

    expect(readPersistedTerminalLayout()?.terminals).toHaveLength(2);
    expect(readPersistedTerminalLayout()?.activeTerminalId).toBe(
      store.getState().terminals.activeTerminalId
    );
  });
});
