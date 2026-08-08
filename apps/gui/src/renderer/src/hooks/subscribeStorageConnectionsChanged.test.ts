import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeStorageConnectionsChanged } from './subscribeStorageConnectionsChanged';

describe('subscribeStorageConnectionsChanged', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
    vi.unstubAllGlobals();
  });

  /**
   * Registers a subscriber and tracks its cleanup for `afterEach`.
   *
   * @param onChanged - Local change handler.
   * @returns Unsubscribe function.
   */
  function subscribe(onChanged: () => void): () => void {
    const cleanup = subscribeStorageConnectionsChanged(onChanged);
    cleanups.push(cleanup);
    return cleanup;
  }

  it('registers one IPC listener and fans out to multiple local subscribers', () => {
    let ipcCallback: (() => void) | undefined;
    const unsubscribeIpc = vi.fn();
    const onStorageConnectionsChanged = vi.fn((callback: () => void) => {
      ipcCallback = callback;
      return unsubscribeIpc;
    });
    const first = vi.fn();
    const second = vi.fn();

    vi.stubGlobal('window', {
      api: {
        onStorageConnectionsChanged
      }
    });

    const cleanupFirst = subscribe(first);
    subscribe(second);

    expect(onStorageConnectionsChanged).toHaveBeenCalledTimes(1);
    expect(onStorageConnectionsChanged).toHaveBeenCalledWith(expect.any(Function));

    ipcCallback?.();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    cleanupFirst();
    expect(unsubscribeIpc).not.toHaveBeenCalled();
  });

  it('reattaches the IPC listener after the last subscriber unsubscribes', () => {
    const unsubscribeIpc = vi.fn();
    const onStorageConnectionsChanged = vi.fn(() => unsubscribeIpc);
    const onChanged = vi.fn();

    vi.stubGlobal('window', {
      api: {
        onStorageConnectionsChanged
      }
    });

    const cleanup = subscribe(onChanged);
    cleanup();
    subscribe(onChanged);

    expect(onStorageConnectionsChanged).toHaveBeenCalledTimes(2);
    expect(unsubscribeIpc).toHaveBeenCalledTimes(1);
  });
});
