/**
 * One completed run persisted for a Shortcut Tutor level.
 */
export interface LevelScoreEntry {
  /** Final score for the run. */
  score: number;
  /** Accuracy percentage (0–100) for the run. */
  accuracy: number;
  /** Longest correct streak during the run. */
  longestStreak: number;
  /** Unix timestamp (ms) when the run was recorded. */
  at: number;
}

/**
 * Full history map keyed by level name.
 */
export type LevelScoreHistory = Record<string, LevelScoreEntry[]>;

/** localStorage key for persisted per-level score history. */
export const LEVEL_SCORE_STORAGE_KEY = 'hcsr-level-scores';

/** Maximum runs retained per level (oldest dropped when exceeded). */
export const MAX_LEVEL_SCORE_HISTORY = 20;

/**
 * Returns a safe localStorage reference, or null when unavailable.
 *
 * @returns `window.localStorage` or null in non-browser / blocked environments.
 */
function getLocalStorage(): Storage | null {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return null;
    }
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/**
 * Validates and normalizes a raw history object from storage.
 *
 * @param raw - Parsed JSON value.
 * @returns Sanitized history map.
 */
function normalizeHistory(raw: unknown): LevelScoreHistory {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }

  const result: LevelScoreHistory = {};

  for (const [levelName, entries] of Object.entries(raw)) {
    if (typeof levelName !== 'string' || levelName.trim().length === 0) {
      continue;
    }
    if (!Array.isArray(entries)) {
      continue;
    }

    const normalized = entries
      .filter(
        (entry): entry is LevelScoreEntry =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as LevelScoreEntry).score === 'number' &&
          typeof (entry as LevelScoreEntry).accuracy === 'number' &&
          typeof (entry as LevelScoreEntry).longestStreak === 'number' &&
          typeof (entry as LevelScoreEntry).at === 'number'
      )
      .map((entry) => ({
        score: Math.max(0, Math.round(entry.score)),
        accuracy: Math.min(100, Math.max(0, Math.round(entry.accuracy))),
        longestStreak: Math.max(0, Math.round(entry.longestStreak)),
        at: entry.at
      }))
      .slice(-MAX_LEVEL_SCORE_HISTORY);

    if (normalized.length > 0) {
      result[levelName] = normalized;
    }
  }

  return result;
}

/**
 * Loads the full per-level score history from localStorage.
 *
 * @returns History map, or an empty object when missing or unreadable.
 */
export function loadLevelScoreHistory(): LevelScoreHistory {
  const storage = getLocalStorage();
  if (storage == null) {
    return {};
  }

  try {
    const raw = storage.getItem(LEVEL_SCORE_STORAGE_KEY);
    if (raw == null || raw.trim().length === 0) {
      return {};
    }
    return normalizeHistory(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

/**
 * Returns the score history for a single level.
 *
 * @param levelName - Level name used as the storage key.
 * @returns Entries for that level (possibly empty), oldest first.
 */
export function getLevelScores(levelName: string): LevelScoreEntry[] {
  const trimmed = levelName.trim();
  if (trimmed.length === 0) {
    return [];
  }
  return loadLevelScoreHistory()[trimmed] ?? [];
}

/**
 * Appends a completed run for a level and persists the updated history.
 *
 * Caps each level at {@link MAX_LEVEL_SCORE_HISTORY} entries (drops oldest).
 *
 * @param levelName - Level name used as the storage key.
 * @param entry - Stats for the completed run.
 * @returns Updated history for that level after append (oldest first).
 */
export function appendLevelScore(levelName: string, entry: LevelScoreEntry): LevelScoreEntry[] {
  const trimmed = levelName.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const history = loadLevelScoreHistory();
  const existing = history[trimmed] ?? [];
  const nextEntries = [
    ...existing,
    {
      score: Math.max(0, Math.round(entry.score)),
      accuracy: Math.min(100, Math.max(0, Math.round(entry.accuracy))),
      longestStreak: Math.max(0, Math.round(entry.longestStreak)),
      at: entry.at
    }
  ].slice(-MAX_LEVEL_SCORE_HISTORY);

  history[trimmed] = nextEntries;

  const storage = getLocalStorage();
  if (storage != null) {
    try {
      storage.setItem(LEVEL_SCORE_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Quota / privacy mode — return in-memory result without persisting.
    }
  }

  return nextEntries;
}
