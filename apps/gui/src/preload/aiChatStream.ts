import type { IpcRenderer, IpcRendererEvent } from 'electron';
import {
  AI_CHAT_STREAM_IPC_CHANNEL,
  isAiChatStreamRendererMessage,
  type AiChatStreamRendererMessage
} from '@harborclient/core/types/aiChatStream';

/**
 * Subscribes to normalized AI chat stream events from the main process.
 *
 * @param ipc - Electron IPC renderer used for push delivery.
 * @param callback - Handler invoked for validated stream events correlated by chat id.
 * @returns Unsubscribe function that removes the installed listener.
 */
export function subscribeAiChatStream(
  ipc: Pick<IpcRenderer, 'on' | 'removeListener'>,
  callback: (message: AiChatStreamRendererMessage) => void
): () => void {
  const listener = (_event: IpcRendererEvent, message: unknown): void => {
    if (!isAiChatStreamRendererMessage(message)) {
      return;
    }

    callback(message);
  };

  ipc.on(AI_CHAT_STREAM_IPC_CHANNEL, listener);
  return () => {
    ipc.removeListener(AI_CHAT_STREAM_IPC_CHANNEL, listener);
  };
}
