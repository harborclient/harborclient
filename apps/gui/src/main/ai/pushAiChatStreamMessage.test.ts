import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_CHAT_STREAM_EVENT_VERSION } from '@harborclient/core/types';
import { pushAiChatStreamMessage } from '#/main/ai/pushAiChatStreamMessage';

const AI_CHAT_STREAM_CHANNEL = 'aiChat:stream';

const getRegisteredMainWindow = vi.hoisted(() => vi.fn());

vi.mock('#/main/window/mainWindowReveal', () => ({
  getRegisteredMainWindow
}));

describe('pushAiChatStreamMessage', () => {
  beforeEach(() => {
    getRegisteredMainWindow.mockReset();
  });

  it('sends validated events to the renderer window', () => {
    const send = vi.fn();
    getRegisteredMainWindow.mockReturnValue({
      isDestroyed: () => false,
      webContents: { send }
    });

    const event = {
      v: AI_CHAT_STREAM_EVENT_VERSION,
      type: 'turn.start' as const,
      turnId: 'turn-1',
      model: 'gpt-4o'
    };

    pushAiChatStreamMessage(4, event);

    expect(send).toHaveBeenCalledWith(AI_CHAT_STREAM_CHANNEL, {
      chatId: 4,
      event
    });
  });

  it('skips delivery when the window is missing or destroyed', () => {
    const send = vi.fn();
    getRegisteredMainWindow.mockReturnValue({
      isDestroyed: () => true,
      webContents: { send }
    });

    pushAiChatStreamMessage(4, {
      v: AI_CHAT_STREAM_EVENT_VERSION,
      type: 'turn.end',
      turnId: 'turn-1'
    });

    expect(send).not.toHaveBeenCalled();

    getRegisteredMainWindow.mockReturnValue(null);
    pushAiChatStreamMessage(4, {
      v: AI_CHAT_STREAM_EVENT_VERSION,
      type: 'turn.end',
      turnId: 'turn-1'
    });

    expect(send).not.toHaveBeenCalled();
  });

  it('rejects invalid chat ids and malformed events', () => {
    const send = vi.fn();
    getRegisteredMainWindow.mockReturnValue({
      isDestroyed: () => false,
      webContents: { send }
    });

    pushAiChatStreamMessage(0, {
      v: AI_CHAT_STREAM_EVENT_VERSION,
      type: 'turn.end',
      turnId: 'turn-1'
    });
    pushAiChatStreamMessage(4, {
      v: 2,
      type: 'turn.end',
      turnId: 'turn-1'
    } as never);

    expect(send).not.toHaveBeenCalled();
  });
});
