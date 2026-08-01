import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScriptLivePageBridge } from './scriptLivePageBridge';

describe('ScriptLivePageBridge', () => {
  let bridge: ScriptLivePageBridge;
  let send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    bridge = new ScriptLivePageBridge();
    send = vi.fn();
    bridge.setMainWindow(
      () =>
        ({
          isDestroyed: () => false,
          webContents: { send }
        }) as never
    );
  });

  it('round-trips livePage invocations through the renderer bridge channel', async () => {
    const resultPromise = bridge.invoke({ op: 'open', url: 'https://example.com' });

    expect(send).toHaveBeenCalledWith('scripts:livePageInvoke', {
      requestId: 1,
      req: { op: 'open', url: 'https://example.com' }
    });

    bridge.complete({
      requestId: 1,
      ok: true,
      result: { tabId: 'tab-1', url: 'https://example.com/', title: 'Example' }
    });

    await expect(resultPromise).resolves.toEqual({
      tabId: 'tab-1',
      url: 'https://example.com/',
      title: 'Example'
    });
  });

  it('rejects when the renderer reports an error', async () => {
    const resultPromise = bridge.invoke({ op: 'focus', tabId: 'missing' });

    bridge.complete({
      requestId: 1,
      ok: false,
      error: 'No browser tab found for tabId "missing".'
    });

    await expect(resultPromise).rejects.toThrow('No browser tab found for tabId "missing".');
  });

  it('rejects when HarborClient is not open', async () => {
    bridge.setMainWindow(() => null);
    await expect(bridge.invoke({ op: 'open' })).rejects.toThrow(
      'HarborClient must be open to use hc.livePage.'
    );
  });
});
