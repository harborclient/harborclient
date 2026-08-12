import { describe, expect, it, vi } from 'vitest';
import { AI_CHAT_STREAM_EVENT_VERSION } from '@harborclient/core/types/aiChatStream';
import { subscribeAiChatStream } from '#/preload/aiChatStream';

const AI_CHAT_STREAM_CHANNEL = 'aiChat:stream';

describe('subscribeAiChatStream', () => {
  it('installs one listener and removes it on unsubscribe', () => {
    const on = vi.fn();
    const removeListener = vi.fn();
    const ipc = { on, removeListener };
    const callback = vi.fn();

    const unsubscribe = subscribeAiChatStream(ipc, callback);

    expect(on).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenCalledWith(AI_CHAT_STREAM_CHANNEL, expect.any(Function));

    const installedListener = on.mock.calls[0]?.[1] as (event: unknown, message: unknown) => void;

    installedListener({} as never, {
      chatId: 2,
      event: {
        v: AI_CHAT_STREAM_EVENT_VERSION,
        type: 'delta.text',
        turnId: 'turn-1',
        stepIndex: 0,
        chunk: 'Hi'
      }
    });

    expect(callback).toHaveBeenCalledWith({
      chatId: 2,
      event: {
        v: AI_CHAT_STREAM_EVENT_VERSION,
        type: 'delta.text',
        turnId: 'turn-1',
        stepIndex: 0,
        chunk: 'Hi'
      }
    });

    installedListener({} as never, {
      chatId: 2,
      event: { v: 2, type: 'turn.end', turnId: 'turn-1' }
    });
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();

    expect(removeListener).toHaveBeenCalledWith(AI_CHAT_STREAM_CHANNEL, installedListener);
  });
});
