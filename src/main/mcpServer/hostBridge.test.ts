import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpToolBridge } from './hostBridge';

describe('McpToolBridge', () => {
  let bridge: McpToolBridge;
  let send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    bridge = new McpToolBridge();
    send = vi.fn();
    bridge.setMainWindow(
      () =>
        ({
          isDestroyed: () => false,
          webContents: { send }
        }) as never
    );
  });

  it('round-trips tool invocations through the renderer bridge channel', async () => {
    const resultPromise = bridge.invokeTool('list_collections', {});

    expect(send).toHaveBeenCalledWith('mcp:serverToolInvoke', {
      requestId: 1,
      name: 'list_collections',
      args: {}
    });

    bridge.completeToolInvoke({
      requestId: 1,
      ok: true,
      result: JSON.stringify([{ id: 1, name: 'Demo' }])
    });

    await expect(resultPromise).resolves.toBe(JSON.stringify([{ id: 1, name: 'Demo' }]));
  });

  it('rejects when the renderer reports an error', async () => {
    const resultPromise = bridge.invokeTool('send_active_request', {});

    bridge.completeToolInvoke({
      requestId: 1,
      ok: false,
      error: 'No active request tab.'
    });

    await expect(resultPromise).rejects.toThrow('No active request tab.');
  });
});
