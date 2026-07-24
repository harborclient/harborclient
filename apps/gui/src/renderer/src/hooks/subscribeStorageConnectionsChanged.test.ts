import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeStorageConnectionsChanged } from './subscribeStorageConnectionsChanged';

describe('subscribeStorageConnectionsChanged', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers and unregisters the storage connection change listener', () => {
    const unsubscribe = vi.fn();
    const onStorageConnectionsChanged = vi.fn(() => unsubscribe);
    const onChanged = vi.fn();

    vi.stubGlobal('window', {
      api: {
        onStorageConnectionsChanged
      }
    });

    const cleanup = subscribeStorageConnectionsChanged(onChanged);

    expect(onStorageConnectionsChanged).toHaveBeenCalledWith(onChanged);
    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
