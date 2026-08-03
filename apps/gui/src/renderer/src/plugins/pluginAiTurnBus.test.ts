import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPluginAiTurnSubscribers,
  emitPluginAiAfterTurn,
  runPluginAiBeforeTurn,
  subscribePluginAiAfterTurn,
  subscribePluginAiBeforeTurn
} from './pluginAiTurnBus';

const runPluginAiBeforeTurnMock = vi.fn();
const pushPluginAiAfterTurnMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

beforeEach(() => {
  clearPluginAiTurnSubscribers();
  runPluginAiBeforeTurnMock.mockReset();
  pushPluginAiAfterTurnMock.mockClear();
  runPluginAiBeforeTurnMock.mockResolvedValue({
    cancelled: false,
    extraInstructions: [],
    userContent: 'hello'
  });

  vi.stubGlobal('window', {
    api: {
      runPluginAiBeforeTurn: runPluginAiBeforeTurnMock,
      pushPluginAiAfterTurn: pushPluginAiAfterTurnMock
    }
  });
});

afterEach(() => {
  clearPluginAiTurnSubscribers();
  vi.unstubAllGlobals();
});

describe('pluginAiTurnBus', () => {
  it('runs local before-turn handlers then merges remote patches', async () => {
    subscribePluginAiBeforeTurn((ctx) => {
      ctx.instructions.push('local-hint');
      ctx.userMessage.content = 'rewritten';
    });
    runPluginAiBeforeTurnMock.mockResolvedValueOnce({
      cancelled: false,
      extraInstructions: ['remote-hint'],
      userContent: 'remote-user'
    });

    const result = await runPluginAiBeforeTurn({
      chatId: 1,
      model: 'gpt-test',
      userMessage: { content: 'hello' },
      messages: [{ role: 'user', content: 'hello' }]
    });

    expect(result).toEqual({
      cancelled: false,
      extraInstructions: ['local-hint', 'remote-hint'],
      userContent: 'remote-user'
    });
    expect(runPluginAiBeforeTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: expect.objectContaining({ content: 'rewritten' })
      })
    );
  });

  it('short-circuits remote invoke when a local handler cancels', async () => {
    subscribePluginAiBeforeTurn((ctx) => {
      ctx.cancel('blocked');
    });

    const result = await runPluginAiBeforeTurn({
      chatId: 1,
      model: 'gpt-test',
      userMessage: { content: 'hello' },
      messages: [{ role: 'user', content: 'hello' }]
    });

    expect(result).toEqual({
      cancelled: true,
      cancelReason: 'blocked',
      userContent: 'hello',
      extraInstructions: []
    });
    expect(runPluginAiBeforeTurnMock).not.toHaveBeenCalled();
  });

  it('emits after-turn to local subscribers and IPC', async () => {
    const handler = vi.fn();
    subscribePluginAiAfterTurn(handler);
    const payload = {
      chatId: 1,
      model: 'gpt-test',
      userMessage: { content: 'hi' },
      assistantMessage: { content: 'yo' },
      status: 'completed' as const,
      stats: { stepCount: 1, toolCallCount: 0, durationMs: 12 }
    };

    emitPluginAiAfterTurn(payload);

    expect(handler).toHaveBeenCalledWith(payload);
    expect(pushPluginAiAfterTurnMock).toHaveBeenCalledWith(payload);
  });
});
