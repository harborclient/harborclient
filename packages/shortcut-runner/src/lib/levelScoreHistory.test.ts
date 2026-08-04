import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  appendLevelScore,
  getLevelScores,
  LEVEL_SCORE_STORAGE_KEY,
  loadLevelScoreHistory,
  MAX_LEVEL_SCORE_HISTORY,
  type LevelScoreEntry
} from './levelScoreHistory.ts';

/**
 * Builds a minimal score entry for tests.
 *
 * @param overrides - Fields to merge onto defaults.
 * @returns Complete level score entry.
 */
function makeEntry(overrides: Partial<LevelScoreEntry> = {}): LevelScoreEntry {
  return {
    score: 100,
    accuracy: 80,
    longestStreak: 3,
    at: 1_700_000_000_000,
    ...overrides
  };
}

/**
 * In-memory Storage stand-in for localStorage in Node tests.
 */
class MemoryStorage implements Storage {
  #map = new Map<string, string>();

  /**
   * Returns the number of stored keys.
   */
  get length(): number {
    return this.#map.size;
  }

  /**
   * Clears all keys.
   */
  clear(): void {
    this.#map.clear();
  }

  /**
   * Returns the value for a key, or null when missing.
   *
   * @param key - Storage key.
   */
  getItem(key: string): string | null {
    return this.#map.has(key) ? (this.#map.get(key) ?? null) : null;
  }

  /**
   * Returns the key at an index, or null when out of range.
   *
   * @param index - Zero-based index.
   */
  key(index: number): string | null {
    return [...this.#map.keys()][index] ?? null;
  }

  /**
   * Removes a key.
   *
   * @param key - Storage key.
   */
  removeItem(key: string): void {
    this.#map.delete(key);
  }

  /**
   * Writes a string value for a key.
   *
   * @param key - Storage key.
   * @param value - String value.
   */
  setItem(key: string, value: string): void {
    this.#map.set(key, String(value));
  }
}

const memory = new MemoryStorage();

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get: () => memory
});

afterEach(() => {
  memory.clear();
});

describe('levelScoreHistory', () => {
  it('returns empty history when storage is empty', () => {
    assert.deepEqual(loadLevelScoreHistory(), {});
    assert.deepEqual(getLevelScores('Level 1 · Essentials'), []);
  });

  it('appends scores per level and isolates levels', () => {
    appendLevelScore('Level 1', makeEntry({ score: 100 }));
    appendLevelScore('Level 1', makeEntry({ score: 200, at: 2 }));
    appendLevelScore('Level 2', makeEntry({ score: 50, at: 3 }));

    assert.deepEqual(
      getLevelScores('Level 1').map((entry) => entry.score),
      [100, 200]
    );
    assert.deepEqual(
      getLevelScores('Level 2').map((entry) => entry.score),
      [50]
    );
  });

  it('caps history at MAX_LEVEL_SCORE_HISTORY', () => {
    for (let index = 0; index < MAX_LEVEL_SCORE_HISTORY + 5; index += 1) {
      appendLevelScore('Level 1', makeEntry({ score: index, at: index }));
    }

    const scores = getLevelScores('Level 1');
    assert.equal(scores.length, MAX_LEVEL_SCORE_HISTORY);
    assert.equal(scores[0]?.score, 5);
    assert.equal(scores[scores.length - 1]?.score, MAX_LEVEL_SCORE_HISTORY + 4);
  });

  it('persists JSON under the storage key', () => {
    appendLevelScore('Level 1', makeEntry({ score: 810 }));
    const raw = memory.getItem(LEVEL_SCORE_STORAGE_KEY);
    assert.ok(raw != null);
    const parsed = JSON.parse(raw) as Record<string, LevelScoreEntry[]>;
    assert.equal(parsed['Level 1']?.[0]?.score, 810);
  });

  it('ignores empty level names', () => {
    assert.deepEqual(appendLevelScore('   ', makeEntry()), []);
    assert.deepEqual(loadLevelScoreHistory(), {});
  });

  it('survives missing localStorage', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      }
    });

    try {
      assert.deepEqual(loadLevelScoreHistory(), {});
      const result = appendLevelScore('Level 1', makeEntry({ score: 42 }));
      assert.deepEqual(
        result.map((entry) => entry.score),
        [42]
      );
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      }
    }
  });
});
