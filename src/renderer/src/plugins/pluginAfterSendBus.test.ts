import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPluginAfterSendSubscribers, emitPluginAfterSend } from './pluginAfterSendBus';

const pushPluginHttpAfterSendMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

beforeEach(() => {
  pushPluginHttpAfterSendMock.mockClear();
  clearPluginAfterSendSubscribers();
  vi.stubGlobal('window', {
    api: {
      pushPluginHttpAfterSend: pushPluginHttpAfterSendMock
    }
  });
});

afterEach(() => {
  clearPluginAfterSendSubscribers();
  vi.unstubAllGlobals();
});

describe('pluginAfterSendBus', () => {
  it('forwards completed sends to plugin webviews through IPC', () => {
    const request = {
      method: 'GET',
      url: 'https://example.com',
      headers: {},
      body: ''
    };
    const response = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: ''
    };

    emitPluginAfterSend(request, response);

    expect(pushPluginHttpAfterSendMock).toHaveBeenCalledWith({ request, response });
  });
});
