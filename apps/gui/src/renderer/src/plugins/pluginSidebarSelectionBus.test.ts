import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPluginSidebarSelectionSubscribers,
  emitPluginSidebarSelectionChanged,
  subscribePluginSidebarSelectionChanged
} from './pluginSidebarSelectionBus';

const pushPluginSidebarSelectionChangedMock = vi
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined);

beforeEach(() => {
  pushPluginSidebarSelectionChangedMock.mockClear();
  clearPluginSidebarSelectionSubscribers();
  vi.stubGlobal('window', {
    api: {
      pushPluginSidebarSelectionChanged: pushPluginSidebarSelectionChangedMock
    }
  });
});

afterEach(() => {
  clearPluginSidebarSelectionSubscribers();
  vi.unstubAllGlobals();
});

describe('pluginSidebarSelectionBus', () => {
  it('notifies subscribers and forwards events to plugin webviews through IPC', () => {
    const listener = vi.fn();
    subscribePluginSidebarSelectionChanged(listener);

    emitPluginSidebarSelectionChanged({ kind: 'collection', collectionId: 3 });

    expect(listener).toHaveBeenCalledWith({ kind: 'collection', collectionId: 3 });
    expect(pushPluginSidebarSelectionChangedMock).toHaveBeenCalledWith({
      kind: 'collection',
      collectionId: 3
    });
  });

  it('dedupes consecutive identical selections', () => {
    const listener = vi.fn();
    subscribePluginSidebarSelectionChanged(listener);

    emitPluginSidebarSelectionChanged({ kind: 'collection', collectionId: 3 });
    emitPluginSidebarSelectionChanged({ kind: 'collection', collectionId: 3 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(pushPluginSidebarSelectionChangedMock).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after dispose', () => {
    const listener = vi.fn();
    const disposable = subscribePluginSidebarSelectionChanged(listener);

    disposable.dispose();
    emitPluginSidebarSelectionChanged({ kind: 'collection', collectionId: 1 });

    expect(listener).not.toHaveBeenCalled();
    expect(pushPluginSidebarSelectionChangedMock).toHaveBeenCalledWith({
      kind: 'collection',
      collectionId: 1
    });
  });
});
