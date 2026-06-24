import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { parseJson } from '#/shared/parseJson';

const SPENT_INVITES_SETTING = 'spentInviteTokens';

/**
 * A spent invite entry persisted to prevent token replay.
 */
interface SpentInviteEntry {
  jti: string;
  exp: number;
}

/**
 * Tracks invite tokens that have already been redeemed.
 */
export interface SpentInviteTokenStore {
  /**
   * Returns whether the given JWT ID has already been spent.
   *
   * @param jti - Unique token id from the invite envelope.
   */
  isSpent(jti: string): boolean;

  /**
   * Records a redeemed invite so the same token cannot be accepted again.
   *
   * @param jti - Unique token id from the invite envelope.
   * @param exp - Invite expiry timestamp in milliseconds.
   */
  markSpent(jti: string, exp: number): void;
}

let defaultStore: SpentInviteTokenStore | null = null;

/**
 * Returns true when a raw parsed entry is a valid, unexpired spent invite record.
 *
 * @param entry - Candidate spent invite entry.
 * @param now - Current timestamp in milliseconds.
 */
function isValidSpentInviteEntry(entry: SpentInviteEntry, now: number): boolean {
  return (
    typeof entry.jti === 'string' &&
    entry.jti.trim().length > 0 &&
    typeof entry.exp === 'number' &&
    Number.isFinite(entry.exp) &&
    entry.exp > now
  );
}

/**
 * Loads spent invite entries from the local registry, pruning expired rows.
 *
 * @param now - Current timestamp in milliseconds used for expiry pruning.
 */
function loadAndPruneSpentInvites(now: number): SpentInviteEntry[] {
  const raw = getLocalDatabase().getSetting(SPENT_INVITES_SETTING);
  const parsed = parseJson<SpentInviteEntry[]>(raw, []);
  const entries = parsed.filter((entry) => isValidSpentInviteEntry(entry, now));
  if (entries.length !== parsed.length) {
    persistSpentInvites(entries);
  }
  return entries;
}

/**
 * Persists pruned spent invite entries to the local registry.
 *
 * @param entries - Spent invite entries to store.
 */
function persistSpentInvites(entries: SpentInviteEntry[]): void {
  getLocalDatabase().setSetting(SPENT_INVITES_SETTING, JSON.stringify(entries));
}

/**
 * Creates a store backed by the local registry settings table.
 */
export function createPersistedSpentInviteTokenStore(): SpentInviteTokenStore {
  return {
    isSpent(jti: string): boolean {
      const entries = loadAndPruneSpentInvites(Date.now());
      return entries.some((entry) => entry.jti === jti);
    },

    markSpent(jti: string, exp: number): void {
      const now = Date.now();
      const entries = loadAndPruneSpentInvites(now).filter((entry) => entry.jti !== jti);
      entries.push({ jti, exp });
      persistSpentInvites(entries);
    }
  };
}

/**
 * Returns the lazily initialized persisted spent-token store.
 */
export function getDefaultSpentInviteTokenStore(): SpentInviteTokenStore {
  if (!defaultStore) {
    defaultStore = createPersistedSpentInviteTokenStore();
  }
  return defaultStore;
}
