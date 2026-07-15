import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginFsWatcher } from './pluginFsWatcher';
import { PluginFsAllowlist } from './pluginFsAllowlist';

const watchMock = vi.fn();
const closeMock = vi.fn();

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    watch: (...args: unknown[]) => watchMock(...args)
  };
});

describe('PluginFsWatcher', () => {
  let allowlist: PluginFsAllowlist;
  let watcher: PluginFsWatcher;
  let onChange: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    allowlist = new PluginFsAllowlist();
    allowlist.grantPath('com.example.test', '/tmp/example.env');
    watcher = new PluginFsWatcher(allowlist);
    watchMock.mockReset();
    closeMock.mockReset();
    onChange = undefined;
    watchMock.mockImplementation((_path, listener: () => void) => {
      onChange = listener;
      return { close: closeMock, on: vi.fn() };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('increments refCount for duplicate watch requests', () => {
    watcher.watchFile('com.example.test', '/tmp/example.env');
    watcher.watchFile('com.example.test', '/tmp/example.env');
    expect(watchMock).toHaveBeenCalledTimes(1);

    watcher.unwatchFile('com.example.test', '/tmp/example.env');
    expect(closeMock).not.toHaveBeenCalled();

    watcher.unwatchFile('com.example.test', '/tmp/example.env');
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('debounces change notifications', () => {
    const send = vi.fn();
    const notifyWebview = vi.fn();
    watcher.setWindowProvider(() => ({ webContents: { send } }) as never);
    watcher.setPluginWebviewNotifier(notifyWebview);

    watcher.watchFile('com.example.test', '/tmp/example.env');
    onChange?.();
    onChange?.();
    expect(send).not.toHaveBeenCalled();
    expect(notifyWebview).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(send).toHaveBeenCalledWith('plugins:fsChanged', {
      pluginId: 'com.example.test',
      path: '/tmp/example.env'
    });
    expect(notifyWebview).toHaveBeenCalledWith('com.example.test', '/tmp/example.env');
  });
});
