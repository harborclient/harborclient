import { NOTICE_STREAM_EVENT_VERSION, type NoticeStreamEvent } from './noticeStreamTypes.js';

/**
 * Parses one SSE `data:` payload into a notice stream event.
 *
 * @param data - Raw SSE data line without the `data:` prefix.
 * @returns Parsed notice event or null when the payload is not a notice event.
 */
export function parseNoticeStreamEvent(data: string): NoticeStreamEvent | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (!isNoticeStreamEvent(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Type guard for notice SSE payloads.
 *
 * @param value - Parsed JSON value.
 * @returns True when the value matches {@link NoticeStreamEvent}.
 */
export function isNoticeStreamEvent(value: unknown): value is NoticeStreamEvent {
  if (value == null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.v === NOTICE_STREAM_EVENT_VERSION &&
    record.type === 'notice.created' &&
    typeof record.noticeId === 'string' &&
    typeof record.unreadCount === 'number'
  );
}

/**
 * Reads an SSE response body and invokes handlers for notice events.
 *
 * @param body - Fetch response body stream.
 * @param handlers - Stream lifecycle callbacks.
 * @param signal - Optional abort signal used to stop reading.
 */
export async function readNoticeStreamBody(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onEvent: (event: NoticeStreamEvent) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines: string[] = [];

  /**
   * Dispatches one SSE event block when a blank line terminates it.
   */
  const dispatchEventBlock = (): void => {
    if (dataLines.length === 0) {
      return;
    }

    const payload = dataLines.join('\n');
    dataLines = [];
    const event = parseNoticeStreamEvent(payload);
    if (event) {
      handlers.onEvent(event);
    }
  };

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

  dispatchEventBlock();
}
