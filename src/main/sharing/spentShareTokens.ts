import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { parseJson } from '#/shared/parseJson';

const SPENT_SHARES_SETTING = 'spentShareTokens';

/**
 * A spent share entry persisted to prevent token replay.
 */
interface SpentShareEntry {
  jti: string;
  exp: number;
}

/**
 * Tracks share tokens that have already been redeemed.
 */
export interface SpentShareTokenStore {
  /**
   * Returns whether the given JWT ID has already been spent.
   *
   * @param jti - Unique token id from the share envelope.
   */
  isSpent(jti: string): boolean;

  /**
   * Records a redeemed share token so the same token cannot be accepted again.
   *
   * @param jti - Unique token id from the share envelope.
   * @param exp - Share token expiry timestamp in milliseconds.
   */
  markSpent(jti: string, exp: number): void;
}

let defaultStore: SpentShareTokenStore | null = null;

/**
 * Returns true when a raw parsed entry is a valid, unexpired spent share record.
 *
 * @param entry - Candidate spent share entry.
 * @param now - Current timestamp in milliseconds.
 */
function isValidSpentShareEntry(entry: SpentShareEntry, now: number): boolean {
  return (
    typeof entry.jti === 'string' &&
    entry.jti.trim().length > 0 &&
    typeof entry.exp === 'number' &&
    Number.isFinite(entry.exp) &&
    entry.exp > now
  );
}

/**
 * Loads spent share entries from the local registry, pruning expired rows.
 *
 * @param now - Current timestamp in milliseconds used for expiry pruning.
 */
function loadAndPruneSpentShares(now: number): SpentShareEntry[] {
  const raw = getLocalDatabase().getSetting(SPENT_SHARES_SETTING);
  const parsed = parseJson<SpentShareEntry[]>(raw, []);
  const entries = parsed.filter((entry) => isValidSpentShareEntry(entry, now));
  if (entries.length !== parsed.length) {
    persistSpentShares(entries);
  }
  return entries;
}

/**
 * Persists pruned spent share entries to the local registry.
 *
 * @param entries - Spent share entries to store.
 */
function persistSpentShares(entries: SpentShareEntry[]): void {
  getLocalDatabase().setSetting(SPENT_SHARES_SETTING, JSON.stringify(entries));
}

/**
 * Creates a store backed by the local registry settings table.
 */
export function createPersistedSpentShareTokenStore(): SpentShareTokenStore {
  return {
    isSpent(jti: string): boolean {
      const entries = loadAndPruneSpentShares(Date.now());
      return entries.some((entry) => entry.jti === jti);
    },

    markSpent(jti: string, exp: number): void {
      const now = Date.now();
      const entries = loadAndPruneSpentShares(now).filter((entry) => entry.jti !== jti);
      entries.push({ jti, exp });
      persistSpentShares(entries);
    }
  };
}

/**
 * Returns the lazily initialized persisted spent-token store.
 */
export function getDefaultSpentShareTokenStore(): SpentShareTokenStore {
  if (!defaultStore) {
    defaultStore = createPersistedSpentShareTokenStore();
  }
  return defaultStore;
}
