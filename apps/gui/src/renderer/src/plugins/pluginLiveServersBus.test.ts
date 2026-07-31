import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPluginLiveServersSubscribers,
  emitPluginLiveServerRequestLog,
  emitPluginLiveServersRunningChanged,
  subscribePluginLiveServerRequestLog,
  subscribePluginLiveServersRunningChanged
} from './pluginLiveServersBus';

const pushRunningMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
const pushLogMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

beforeEach(() => {
  pushRunningMock.mockClear();
  pushLogMock.mockClear();
  clearPluginLiveServersSubscribers();
  vi.stubGlobal('window', {
    api: {
      pushPluginLiveServersRunningChanged: pushRunningMock,
      pushPluginLiveServerRequestLog: pushLogMock
    }
  });
});

afterEach(() => {
  clearPluginLiveServersSubscribers();
  vi.unstubAllGlobals();
});

describe('pluginLiveServersBus', () => {
  it('notifies running-changed subscribers and forwards through IPC', () => {
    const listener = vi.fn();
    subscribePluginLiveServersRunningChanged(listener);

    emitPluginLiveServersRunningChanged([]);

    expect(listener).toHaveBeenCalledWith([]);
    expect(pushRunningMock).toHaveBeenCalledWith([]);
  });

  it('notifies request-log subscribers and forwards through IPC', () => {
    const listener = vi.fn();
    subscribePluginLiveServerRequestLog(listener);
    const entry = {
      id: 'run-1',
      savedId: 1,
      timestamp: 1,
      method: 'GET',
      url: '/',
      statusCode: 200,
      durationMs: 2,
      contentLength: null
    };

    emitPluginLiveServerRequestLog(entry);

    expect(listener).toHaveBeenCalledWith(entry);
    expect(pushLogMock).toHaveBeenCalledWith(entry);
  });

  it('stops notifying after dispose', () => {
    const listener = vi.fn();
    const disposable = subscribePluginLiveServersRunningChanged(listener);

    disposable.dispose();
    emitPluginLiveServersRunningChanged([]);

    expect(listener).not.toHaveBeenCalled();
    expect(pushRunningMock).toHaveBeenCalledWith([]);
  });
});
