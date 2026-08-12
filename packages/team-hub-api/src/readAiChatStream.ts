import {
  chatStepResultFromStepEnd,
  parseAiChatStreamEvent,
  type AiChatStreamEvent,
  type AiChatStreamStepEndEvent
} from '@harborclient/core/types/aiChatStream';
import type { ChatStepResult } from './appTypes.js';

/**
 * Receives validated events from a Team Hub AI chat SSE response.
 */
export interface AiChatStreamHandlers {
  /**
   * Called in wire order for every valid canonical stream event.
   */
  onEvent: (event: AiChatStreamEvent) => void;
}

/**
 * Reads a Team Hub AI chat SSE body and returns the backward-compatible final result.
 *
 * Invalid or unrelated SSE payloads are ignored so heartbeat comments and future
 * event versions cannot corrupt the active desktop turn. A successful stream must
 * include a validated `step.end` event.
 *
 * @param body - Fetch response body containing SSE frames.
 * @param handlers - Callback invoked for each validated canonical event.
 * @param signal - Optional request signal used to stop processing after cancellation.
 * @returns Chat step result reconstructed from the terminal `step.end` event.
 * @throws {Error} When the stream fails or closes without `step.end`.
 */
export async function readAiChatStreamBody(
  body: ReadableStream<Uint8Array>,
  handlers: AiChatStreamHandlers,
  signal?: AbortSignal
): Promise<ChatStepResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines: string[] = [];
  let stepEnd: AiChatStreamStepEndEvent | undefined;
  let terminalError: Error | undefined;

  /**
   * Cancels a pending body read as soon as the caller aborts, rather than
   * waiting for an idle peer to produce another SSE frame.
   */
  const cancelReader = (): void => {
    void reader.cancel(signal?.reason);
  };
  signal?.addEventListener('abort', cancelReader, { once: true });

  /**
   * Validates and dispatches one blank-line-terminated SSE event block.
   */
  const dispatchEventBlock = (): void => {
    if (dataLines.length === 0) {
      return;
    }

    const payload = dataLines.join('\n');
    dataLines = [];
    const event = parseAiChatStreamEvent(payload);
    if (!event) {
      return;
    }

    handlers.onEvent(event);
    if (event.type === 'step.end') {
      stepEnd = event;
    } else if (event.type === 'turn.error') {
      terminalError = new Error(event.message);
    } else if (event.type === 'turn.cancelled') {
      terminalError = new DOMException('Team Hub chat stream was cancelled.', 'AbortError');
    }
  };

  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
        buffer = buffer.slice(newlineIndex + 1);

        if (line.length === 0) {
          dispatchEventBlock();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }

        newlineIndex = buffer.indexOf('\n');
      }
    }

    buffer += decoder.decode();
    if (buffer.length > 0) {
      const line = buffer.replace(/\r$/, '');
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    dispatchEventBlock();
  } finally {
    signal?.removeEventListener('abort', cancelReader);
  }

  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException('Team Hub chat stream was aborted.', 'AbortError');
  }
  if (terminalError) {
    throw terminalError;
  }
  if (!stepEnd) {
    throw new Error('Team Hub chat stream closed without a step.end event');
  }

  return chatStepResultFromStepEnd(stepEnd);
}
