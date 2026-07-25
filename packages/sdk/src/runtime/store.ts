import type { Disposable } from '../types.js';
import { useSyncExternalStore } from './react.js';

/**
 * Minimal storage surface used by {@link createStorageStore}.
 */
export interface StorageLike {
  /**
   * Returns the stored value for a key.
   *
   * @param key - Storage key within the plugin namespace.
   */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * Persists a JSON-serializable value.
   *
   * @param key - Storage key within the plugin namespace.
   * @param value - Value to persist.
   */
  set<T>(key: string, value: T): Promise<void>;
}

/**
 * Reactive store backed by plugin storage and compatible with React
 * `useSyncExternalStore`.
 */
export interface StorageStore<T> {
  /**
   * Subscribes to snapshot changes for `useSyncExternalStore`.
   *
   * @param listener - Callback invoked when the snapshot changes.
   */
  subscribe(listener: () => void): () => void;

  /**
   * Returns the current in-memory snapshot.
   */
  getSnapshot(): T;

  /**
   * React hook returning the current snapshot.
   */
  useValue(): T;

  /**
   * Reloads from storage and notifies subscribers when the parsed value changed.
   */
  reloadFromStorage(): Promise<void>;

  /**
   * Persists to storage, then updates the in-memory snapshot and notifies subscribers.
   * Rejects when persistence fails; the snapshot is left unchanged.
   *
   * @param next - New snapshot value.
   */
  set(next: T): Promise<void>;
}

/**
 * Options for {@link createStorageStore}.
 */
export interface CreateStorageStoreOptions<T> {
  /** Plugin storage API from `hc.storage`. */
  storage: StorageLike;

  /** Storage key within the plugin namespace. */
  key: string;

  /**
   * Validates and hydrates a raw storage value into a typed snapshot.
   * Called with `undefined` when the key has never been set.
   *
   * @param raw - Raw value from storage, or `undefined` when absent.
   */
  parse: (raw: unknown) => T;

  /**
   * Compares two snapshots to skip no-op reloads and writes.
   * Defaults to `JSON.stringify` equality.
   */
  equals?: (a: T, b: T) => boolean;

  /**
   * When true, {@link StorageStore.reloadFromStorage} leaves the snapshot
   * unchanged if the storage key is absent. Default false (apply `parse(undefined)`).
   */
  keepCurrentWhenMissing?: boolean;
}

/**
 * Options for {@link syncOnWindowFocus}.
 */
export interface SyncOnWindowFocusOptions {
  /** Optional polling interval in milliseconds in addition to focus/visibility reloads. */
  intervalMs?: number;
}

/**
 * Creates a module-level external store compatible with React `useSyncExternalStore`.
 *
 * @param initial - Initial snapshot value.
 */
export function createExternalStore<T>(initial: T): {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  setState: (next: T) => void;
} {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    setState: (next) => {
      state = next;
      for (const listener of listeners) {
        listener();
      }
    }
  };
}

/**
 * Compares two JSON-serializable values using `JSON.stringify`.
 *
 * @param a - First value.
 * @param b - Second value.
 */
function defaultEquals<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Creates a storage-backed external store for sharing state across plugin webviews.
 *
 * Hydrates from storage asynchronously on creation. Synchronous {@link StorageStore.getSnapshot}
 * may return `parse(undefined)` until hydration completes; use {@link StorageStore.useValue}
 * or await {@link StorageStore.reloadFromStorage} when you need the persisted value before reading.
 *
 * Separate plugin webviews do not share memory; use {@link syncOnWindowFocus} to
 * reload when another surface writes storage.
 *
 * @param options - Storage key, parse/equals helpers, and the plugin storage API.
 */
export function createStorageStore<T>(options: CreateStorageStoreOptions<T>): StorageStore<T> {
  const { storage, key, parse, equals = defaultEquals, keepCurrentWhenMissing = false } = options;
  const external = createExternalStore(parse(undefined));

  /**
   * Reloads from storage and updates subscribers when the parsed snapshot changed.
   */
  async function reloadFromStorage(): Promise<void> {
    const raw = await storage.get(key);
    if (raw === undefined && keepCurrentWhenMissing) {
      return;
    }
    const next = parse(raw);
    const current = external.getSnapshot();
    if (!equals(current, next)) {
      external.setState(next);
    }
  }

  /**
   * Persists when the value changed, then updates the snapshot and notifies subscribers.
   * Rejects when persistence fails; the snapshot is left unchanged.
   *
   * @param next - New snapshot value.
   */
  async function set(next: T): Promise<void> {
    const current = external.getSnapshot();
    if (equals(current, next)) {
      return;
    }
    await storage.set(key, next);
    external.setState(next);
  }

  /**
   * React hook returning the current storage-backed snapshot.
   */
  function useValue(): T {
    return useSyncExternalStore(external.subscribe, external.getSnapshot, external.getSnapshot);
  }

  void reloadFromStorage();

  return {
    subscribe: external.subscribe,
    getSnapshot: external.getSnapshot,
    useValue,
    reloadFromStorage,
    set
  };
}

/**
 * Starts an interval and returns a disposable that clears it on deactivation.
 *
 * @param callback - Function invoked on each tick.
 * @param intervalMs - Interval in milliseconds.
 */
export function setIntervalDisposable(callback: () => void, intervalMs: number): Disposable {
  const timer = setInterval(callback, intervalMs);
  return {
    dispose: () => {
      clearInterval(timer);
    }
  };
}

/**
 * Reloads one or more storage-backed stores when the window regains focus or
 * becomes visible, with optional polling for live cross-webview updates.
 *
 * Dispose the returned disposable from `deactivate()` or a React effect cleanup.
 *
 * @param stores - One store or an array of stores to reload together.
 * @param options - Optional polling interval in milliseconds.
 */
export function syncOnWindowFocus(
  stores: StorageStore<unknown> | StorageStore<unknown>[],
  options?: SyncOnWindowFocusOptions
): Disposable {
  const list = Array.isArray(stores) ? stores : [stores];

  /**
   * Reloads every registered store from plugin storage.
   */
  const reload = (): void => {
    for (const store of list) {
      void store.reloadFromStorage();
    }
  };

  window.addEventListener('focus', reload);
  document.addEventListener('visibilitychange', reload);
  reload();

  const intervalDisposable =
    options?.intervalMs !== undefined ? setIntervalDisposable(reload, options.intervalMs) : null;

  return {
    dispose: () => {
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', reload);
      intervalDisposable?.dispose();
    }
  };
}
