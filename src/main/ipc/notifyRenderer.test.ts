import { describe, expect, it, vi } from 'vitest';
import { notifyStorageConnectionsChanged } from './notifyRenderer';

describe('notifyStorageConnectionsChanged', () => {
  it('sends storageConnections:changed when the sender is live', () => {
    const send = vi.fn();
    const sender = {
      isDestroyed: () => false,
      send
    };

    notifyStorageConnectionsChanged(sender as never);

    expect(send).toHaveBeenCalledWith('storageConnections:changed');
  });

  it('does not send when the sender is destroyed', () => {
    const send = vi.fn();
    const sender = {
      isDestroyed: () => true,
      send
    };

    notifyStorageConnectionsChanged(sender as never);

    expect(send).not.toHaveBeenCalled();
  });
});
