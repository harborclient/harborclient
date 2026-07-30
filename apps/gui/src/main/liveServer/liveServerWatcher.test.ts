import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectWatchDirectories,
  LIVE_SERVER_WATCH_DEBOUNCE_MS,
  startLiveServerWatcher
} from './liveServerWatcher';

const tempRoots: string[] = [];

/**
 * Creates a temporary directory for watcher tests.
 *
 * @returns Absolute path to the new directory.
 */
function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-live-watch-'));
  tempRoots.push(dir);
  return dir;
}

/**
 * Builds a stub FSWatcher that records close calls.
 *
 * @returns Stub watcher.
 */
function createStubWatcher(): fs.FSWatcher {
  return {
    close: vi.fn(),
    on: vi.fn(),
    ref: vi.fn(),
    unref: vi.fn()
  } as unknown as fs.FSWatcher;
}

/**
 * Installs an `fs.watch` mock that captures change listeners for manual firing.
 *
 * @param listeners - Array that receives thunks to fire each registered listener.
 */
function mockWatchWithListeners(listeners: Array<() => void>): void {
  const watchMock = vi.fn(
    (
      _filename: fs.PathLike,
      options?: fs.WatchOptions | BufferEncoding | null | fs.WatchListener<string>,
      listener?: fs.WatchListener<string>
    ): fs.FSWatcher => {
      const resolvedListener =
        typeof options === 'function' ? options : typeof listener === 'function' ? listener : null;
      if (resolvedListener) {
        listeners.push(() => {
          resolvedListener('change', 'file.txt');
        });
      }
      return createStubWatcher();
    }
  );
  vi.spyOn(fs, 'watch').mockImplementation(watchMock as unknown as typeof fs.watch);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  for (const dir of tempRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('collectWatchDirectories', () => {
  it('includes the root and existing alias targets', () => {
    const root = makeTempDir();
    const alias = path.join(root, 'build');
    fs.mkdirSync(alias);
    expect(collectWatchDirectories(root, [{ path: '/assets', target: 'build' }])).toEqual([
      path.resolve(root),
      path.resolve(alias)
    ]);
  });

  it('skips missing alias targets', () => {
    const root = makeTempDir();
    expect(collectWatchDirectories(root, [{ path: '/assets', target: 'missing' }])).toEqual([
      path.resolve(root)
    ]);
  });
});

describe('startLiveServerWatcher', () => {
  it('debounces rapid changes into a single callback', async () => {
    vi.useFakeTimers();
    const root = makeTempDir();
    const listeners: Array<() => void> = [];
    mockWatchWithListeners(listeners);

    const onChange = vi.fn();
    const handle = startLiveServerWatcher(root, [], onChange);

    expect(handle.watching).toBe(true);
    expect(listeners.length).toBeGreaterThan(0);

    listeners[0]?.();
    listeners[0]?.();

    expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(LIVE_SERVER_WATCH_DEBOUNCE_MS + 10);
    expect(onChange).toHaveBeenCalledTimes(1);

    handle.stop();
  });

  it('does not fire after stop', async () => {
    vi.useFakeTimers();
    const root = makeTempDir();
    const listeners: Array<() => void> = [];
    mockWatchWithListeners(listeners);

    const onChange = vi.fn();
    const handle = startLiveServerWatcher(root, [], onChange);
    handle.stop();

    listeners[0]?.();
    await vi.advanceTimersByTimeAsync(LIVE_SERVER_WATCH_DEBOUNCE_MS + 10);
    expect(onChange).not.toHaveBeenCalled();
  });
});
