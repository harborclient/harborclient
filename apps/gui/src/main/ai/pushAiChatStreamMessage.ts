import {
  isAiChatStreamEvent,
  AI_CHAT_STREAM_IPC_CHANNEL,
  type AiChatStreamEvent,
  type AiChatStreamRendererMessage
} from '@harborclient/core/types';
import { getRegisteredMainWindow } from '#/main/window/mainWindowReveal';

export { AI_CHAT_STREAM_IPC_CHANNEL };

/**
 * Sends a validated AI chat stream event to the renderer when a window is available.
 *
 * @param chatId - Local SQLite chat id for Redux correlation.
 * @param event - Normalized stream event without desktop routing fields.
 */
export function pushAiChatStreamMessage(chatId: number, event: AiChatStreamEvent): void {
  if (!Number.isInteger(chatId) || chatId <= 0) {
    return;
  }

  if (!isAiChatStreamEvent(event)) {
    return;
  }

  const window = getRegisteredMainWindow();
  if (!window || window.isDestroyed()) {
    return;
  }

  const message: AiChatStreamRendererMessage = { chatId, event };
  window.webContents.send(AI_CHAT_STREAM_IPC_CHANNEL, message);
}
