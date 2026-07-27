import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPluginLibraryChangedSubscribers,
  emitPluginLibraryChanged,
  subscribePluginLibraryChanged
} from './pluginLibraryChangedBus';

const pushPluginLibraryChangedMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

beforeEach(() => {
  pushPluginLibraryChangedMock.mockClear();
  clearPluginLibraryChangedSubscribers();
  vi.stubGlobal('window', {
    api: {
      pushPluginLibraryChanged: pushPluginLibraryChangedMock
    }
  });
});

afterEach(() => {
  clearPluginLibraryChangedSubscribers();
  vi.unstubAllGlobals();
});

describe('pluginLibraryChangedBus', () => {
  it('notifies subscribers and forwards events to plugin webviews through IPC', () => {
    const listener = vi.fn();
    subscribePluginLibraryChanged(listener);

    emitPluginLibraryChanged({ reason: 'requests', collectionId: 7 });

    expect(listener).toHaveBeenCalledWith({ reason: 'requests', collectionId: 7 });
    expect(pushPluginLibraryChangedMock).toHaveBeenCalledWith({
      reason: 'requests',
      collectionId: 7
    });
  });

  it('stops notifying after dispose', () => {
    const listener = vi.fn();
    const disposable = subscribePluginLibraryChanged(listener);

    disposable.dispose();
    emitPluginLibraryChanged({ reason: 'collections' });

    expect(listener).not.toHaveBeenCalled();
    expect(pushPluginLibraryChangedMock).toHaveBeenCalledWith({ reason: 'collections' });
  });
});
