import type { PluginStorage } from '../types.js';

/**
 * Options for {@link mergeById}.
 */
export interface MergeByIdOptions<T> {
  /**
   * Maximum number of entries to retain after merging.
   */
  cap: number;

  /**
   * Returns the stable id used for deduplication.
   */
  idOf: (entry: T) => string;
}

/**
 * Merges pending entries ahead of existing ones, deduping by id and capping length.
 *
 * @param pending - New entries to prepend (newest first).
 * @param existing - Previously stored entries (newest first).
 * @param options - Cap and id selector.
 */
export function mergeById<T>(pending: T[], existing: T[], options: MergeByIdOptions<T>): T[] {
  if (pending.length === 0) {
    return existing.slice(0, options.cap);
  }
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const entry of [...pending, ...existing]) {
    const id = options.idOf(entry);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    merged.push(entry);
    if (merged.length >= options.cap) {
      break;
    }
  }
  return merged;
}

/**
 * Options for {@link createCappedList}.
 */
export interface CreateCappedListOptions<T> {
  /**
   * Plugin storage backing the list.
   */
  storage: PluginStorage;

  /**
   * Storage key within the plugin namespace.
   */
  key: string;

  /**
   * Maximum number of entries to persist.
   */
  cap: number;

  /**
   * Returns the stable id used for deduplication.
   */
  idOf: (entry: T) => string;
}

/**
 * Serialized read-modify-write queue keyed by storage key.
 */
const writeQueues = new Map<string, Promise<void>>();

/**
 * Enqueues one storage mutation so concurrent callers cannot interleave get/set.
 *
 * @param key - Storage key used as the queue id.
 * @param operation - Read-modify-write work to serialize.
 */
async function enqueueStorageWrite<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(key) ?? Promise.resolve();
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  writeQueues.set(
    key,
    previous.then(() => done)
  );
  await previous;
  try {
    return await operation();
  } finally {
    resolveDone();
    if (writeQueues.get(key) === done) {
      writeQueues.delete(key);
    }
  }
}

/**
 * Persistent capped list helper with atomic read-modify-write semantics.
 *
 * @param options - Storage, key, cap, and id selector.
 */
export function createCappedList<T>(options: CreateCappedListOptions<T>): {
  load: () => Promise<T[]>;
  merge: (pending: T[]) => Promise<T[] | null>;
  save: (entries: T[]) => Promise<void>;
  clear: () => Promise<void>;
} {
  const queueKey = options.key;
  return {
    load: async () => {
      const saved = await options.storage.get<T[]>(options.key);
      return Array.isArray(saved) ? saved.slice(0, options.cap) : [];
    },
    merge: async (pending) => {
      if (pending.length === 0) {
        return null;
      }
      return enqueueStorageWrite(queueKey, async () => {
        const existing = await options.storage.get<T[]>(options.key);
        const current = Array.isArray(existing) ? existing : [];
        const merged = mergeById(pending, current, options);
        if (merged.length === current.length) {
          let unchanged = true;
          for (let index = 0; index < merged.length; index += 1) {
            if (options.idOf(merged[index]!) !== options.idOf(current[index]!)) {
              unchanged = false;
              break;
            }
          }
          if (unchanged) {
            return null;
          }
        }
        await options.storage.set(options.key, merged);
        return merged;
      });
    },
    save: async (entries) => {
      await enqueueStorageWrite(queueKey, async () => {
        await options.storage.set(options.key, entries.slice(0, options.cap));
      });
    },
    clear: async () => {
      await enqueueStorageWrite(queueKey, async () => {
        await options.storage.set(options.key, []);
      });
    }
  };
}
