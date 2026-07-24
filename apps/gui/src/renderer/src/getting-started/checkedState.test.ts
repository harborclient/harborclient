import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GETTING_STARTED_CHECKED_STORAGE_KEY,
  checkedItemKey,
  readCheckedKeys,
  setChecked
} from './checkedState';

/**
 * Minimal localStorage mock backed by an in-memory map for checkbox state tests.
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

describe('getting-started checkedState', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds stable checked item keys', () => {
    expect(checkedItemKey('index.md', 0)).toBe('index.md#0');
    expect(checkedItemKey('guides/setup.md', 2)).toBe('guides/setup.md#2');
  });

  it('returns an empty set when storage is unset', () => {
    expect(readCheckedKeys()).toEqual(new Set());
  });

  it('parses stored checked keys from localStorage', () => {
    localStorage.setItem(
      GETTING_STARTED_CHECKED_STORAGE_KEY,
      JSON.stringify(['index.md#0', 'index.md#1'])
    );

    expect(readCheckedKeys()).toEqual(new Set(['index.md#0', 'index.md#1']));
  });

  it('returns an empty set for invalid JSON', () => {
    localStorage.setItem(GETTING_STARTED_CHECKED_STORAGE_KEY, '{not-json');

    expect(readCheckedKeys()).toEqual(new Set());
  });

  it('returns an empty set when storage is not an array', () => {
    localStorage.setItem(GETTING_STARTED_CHECKED_STORAGE_KEY, JSON.stringify({ checked: true }));

    expect(readCheckedKeys()).toEqual(new Set());
  });

  it('adds and removes checked keys through setChecked', () => {
    setChecked('index.md#0', true);
    expect(readCheckedKeys()).toEqual(new Set(['index.md#0']));

    setChecked('index.md#1', true);
    expect(readCheckedKeys()).toEqual(new Set(['index.md#0', 'index.md#1']));

    setChecked('index.md#0', false);
    expect(readCheckedKeys()).toEqual(new Set(['index.md#1']));
  });
});
