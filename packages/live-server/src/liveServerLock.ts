/**
 * Per-runtime-id async lock for live-server start/stop serialization.
 *
 * Concurrent `startLiveServer` / `stopLiveServer` calls for the same runtime id
 * must not interleave (duplicate listeners, last-write-wins map entries, leaked
 * ports). Different ids run concurrently.
 */

/**
 * Tail promise for each runtime id currently holding or waiting on the lock.
 */
const locks = new Map<string, Promise<unknown>>();

/**
 * Runs `task` exclusively for the given runtime id.
 *
 * Queues behind any in-flight work for the same id. Releases even when `task`
 * throws. Deletes the map entry when this call is the last waiter so the map
 * does not grow unbounded across many short-lived ids.
 *
 * @param id - Runtime instance id.
 * @param task - Async work to run while holding the lock.
 * @returns The result of `task`.
 */
export async function withLiveServerLock<T>(id: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const current: Promise<unknown> = previous.catch(() => undefined).then(() => gate);
  locks.set(id, current);

  await previous.catch(() => undefined);

  try {
    return await task();
  } finally {
    release();
    if (locks.get(id) === current) {
      locks.delete(id);
    }
  }
}

/**
 * Returns runtime ids that currently have in-flight or queued lock work.
 *
 * Used by shutdown so a start racing `stopAllLiveServers` is torn down once it
 * finishes registering (or failing).
 *
 * @returns Snapshot of pending lock keys.
 */
export function getPendingLiveServerLockIds(): string[] {
  return [...locks.keys()];
}
