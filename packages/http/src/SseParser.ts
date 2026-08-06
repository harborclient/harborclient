import type { SseEvent } from './types.js';

/**
 * Default EventSource reconnect delay when the server has not sent `retry:`.
 */
export const DEFAULT_SSE_RETRY_MS = 3000;

/**
 * Upper bound for reconnect delays from the server or backoff.
 */
export const MAX_SSE_RETRY_MS = 60_000;

/**
 * Partial event fields accumulated while parsing an SSE wire block.
 */
interface PendingFields {
  eventType: string;
  dataLines: string[];
  id?: string;
  retryMs?: number;
  rawLines: string[];
}

/**
 * Incremental Server-Sent Events parser for chunked UTF-8 streams.
 *
 * Tolerates events split across chunk boundaries and line terminators `\n`,
 * `\r\n`, and `\r` per the HTML Living Standard EventSource algorithm.
 */
export class SseParser {
  #buffer = '';
  #pending: PendingFields = emptyPending();
  #seq = 0;
  #lastEventId = '';
  #retryMs = DEFAULT_SSE_RETRY_MS;

  /**
   * Creates a parser, optionally seeding Last-Event-ID and sequence from a prior
   * connection so reconnects keep monotonic {@link SseEvent.seq} values.
   *
   * @param lastEventId - Initial Last-Event-ID for reconnect.
   * @param startSeq - Highest sequence already emitted in this session (0 when new).
   */
  constructor(lastEventId = '', startSeq = 0) {
    this.#lastEventId = lastEventId;
    this.#seq = Math.max(0, Math.floor(startSeq));
  }

  /**
   * Last-Event-ID from the most recently dispatched event that carried an `id:`.
   */
  get lastEventId(): string {
    return this.#lastEventId;
  }

  /**
   * Current reconnect delay in milliseconds (server `retry:` or default).
   */
  get retryMs(): number {
    return this.#retryMs;
  }

  /**
   * Highest sequence number assigned so far (0 before the first event).
   */
  get seq(): number {
    return this.#seq;
  }

  /**
   * Next sequence number that will be assigned to a dispatched event.
   */
  get nextSeq(): number {
    return this.#seq + 1;
  }

  /**
   * Feeds a decoded text chunk and returns any complete events.
   *
   * @param chunk - UTF-8 decoded text from the response body stream.
   * @returns Events completed by this chunk (may be empty).
   */
  push(chunk: string): SseEvent[] {
    this.#buffer += chunk;
    const events: SseEvent[] = [];

    while (true) {
      const lineEnd = findLineEnd(this.#buffer);
      if (lineEnd == null) {
        break;
      }

      const line = this.#buffer.slice(0, lineEnd.index);
      this.#buffer = this.#buffer.slice(lineEnd.index + lineEnd.length);

      const dispatched = this.#processLine(line);
      if (dispatched) {
        events.push(dispatched);
      }
    }

    return events;
  }

  /**
   * Flushes a trailing incomplete line when the stream ends without a final
   * blank line. Does not invent an event from leftover field state alone —
   * the EventSource spec discards a partial event when the connection closes.
   *
   * @returns Always an empty array; retained for a symmetric API with {@link push}.
   */
  flush(): SseEvent[] {
    this.#buffer = '';
    this.#pending = emptyPending();
    return [];
  }

  /**
   * Processes one complete line (without its terminator).
   *
   * @param line - Line text without CR/LF.
   * @returns A dispatched event when the line was a blank event terminator.
   */
  #processLine(line: string): SseEvent | null {
    if (line === '') {
      return this.#dispatch();
    }

    if (line.startsWith(':')) {
      this.#pending.rawLines.push(line);
      return null;
    }

    this.#pending.rawLines.push(line);

    const colon = line.indexOf(':');
    let field: string;
    let value: string;
    if (colon === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      if (value.startsWith(' ')) {
        value = value.slice(1);
      }
    }

    switch (field) {
      case 'event':
        this.#pending.eventType = value;
        break;
      case 'data':
        this.#pending.dataLines.push(value);
        break;
      case 'id':
        if (!value.includes('\0')) {
          this.#pending.id = value;
        }
        break;
      case 'retry': {
        if (/^\d+$/.test(value)) {
          const parsed = Number(value);
          if (Number.isFinite(parsed)) {
            this.#pending.retryMs = Math.min(parsed, MAX_SSE_RETRY_MS);
          }
        }
        break;
      }
      default:
        break;
    }

    return null;
  }

  /**
   * Completes the pending field buffer into an {@link SseEvent} when it has data.
   *
   * @returns The event, or null when the blank line had no data fields.
   */
  #dispatch(): SseEvent | null {
    const pending = this.#pending;
    this.#pending = emptyPending();

    if (pending.retryMs != null) {
      this.#retryMs = pending.retryMs;
    }

    if (pending.dataLines.length === 0) {
      return null;
    }

    if (pending.id !== undefined) {
      this.#lastEventId = pending.id;
    }

    this.#seq += 1;
    return {
      seq: this.#seq,
      receivedAt: Date.now(),
      type: pending.eventType || 'message',
      ...(pending.id !== undefined ? { id: pending.id } : {}),
      data: pending.dataLines.join('\n'),
      ...(pending.retryMs != null ? { retryMs: pending.retryMs } : {}),
      raw: pending.rawLines.join('\n')
    };
  }
}

/**
 * Returns a fresh pending-field buffer for the next SSE block.
 *
 * @returns Empty pending fields.
 */
function emptyPending(): PendingFields {
  return {
    eventType: '',
    dataLines: [],
    rawLines: []
  };
}

/**
 * Locates the next line terminator in an SSE buffer.
 *
 * @param buffer - Accumulated undecoded line text.
 * @returns Index and length of the terminator, or null when incomplete.
 */
function findLineEnd(buffer: string): { index: number; length: number } | null {
  for (let i = 0; i < buffer.length; i += 1) {
    const ch = buffer[i];
    if (ch === '\r') {
      if (i + 1 < buffer.length && buffer[i + 1] === '\n') {
        return { index: i, length: 2 };
      }
      return { index: i, length: 1 };
    }
    if (ch === '\n') {
      return { index: i, length: 1 };
    }
  }
  return null;
}

/**
 * Returns whether a Content-Type header value is an SSE stream.
 *
 * @param contentType - Raw Content-Type header, or null when absent.
 * @returns True when the media type is `text/event-stream`.
 */
export function isEventStreamContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return mediaType === 'text/event-stream';
}

/**
 * Computes the next reconnect delay with linear backoff, capped at {@link MAX_SSE_RETRY_MS}.
 *
 * @param baseRetryMs - Server or default retry interval.
 * @param attempt - One-based reconnect attempt number.
 * @returns Delay in milliseconds before the next connect.
 */
export function sseReconnectDelay(baseRetryMs: number, attempt: number): number {
  const scaled = baseRetryMs * Math.max(1, attempt);
  return Math.min(scaled, MAX_SSE_RETRY_MS);
}
