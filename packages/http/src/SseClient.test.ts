import { afterEach, describe, expect, it, vi } from 'vitest';
import { SseClient } from './SseClient.js';

/**
 * Builds a mock SSE Response whose body emits one event then closes.
 *
 * @param bodyText - Raw SSE wire text to stream.
 * @returns Fetch Response-like object with a readable body.
 */
function mockEventStreamResponse(bodyText: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(bodyText));
      controller.close();
    }
  });
  return new Response(stream, {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'text/event-stream' }
  });
}

describe('SseClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parses streamed events from a mock fetch response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mockEventStreamResponse('event: ping\ndata: hello\n\n'))
    );

    const client = new SseClient({
      createSessionId: () => 'test-session',
      sleep: async () => undefined
    });

    const events: Array<{ type: string; data: string }> = [];
    let openedStatus = 0;
    let closedReason = '';

    const session = await client.open(
      {
        protocol: 'sse',
        url: 'https://example.com/events',
        headers: [],
        params: [],
        reconnect: false
      },
      {
        onOpen(info) {
          openedStatus = info.status;
        },
        onEvent(event) {
          events.push({ type: event.type, data: event.data });
        },
        onClose(info) {
          closedReason = info.reason;
        }
      }
    );

    await vi.waitFor(() => {
      expect(events.length).toBeGreaterThan(0);
    });

    expect(openedStatus).toBe(200);
    expect(events[0]).toEqual({ type: 'ping', data: 'hello' });

    await session.close();
    await vi.waitFor(() => {
      expect(closedReason === 'client' || closedReason === 'server').toBe(true);
    });
  });

  it('keeps monotonic sequence numbers across reconnects', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockEventStreamResponse('id: 1\ndata: first\n\n'))
      .mockResolvedValueOnce(mockEventStreamResponse('id: 1\ndata: second\n\n'));
    vi.stubGlobal('fetch', fetchMock);

    const client = new SseClient({
      createSessionId: () => 'test-session',
      sleep: async () => undefined
    });

    const events: Array<{ seq: number; data: string }> = [];
    let reconnects = 0;

    const session = await client.open(
      {
        protocol: 'sse',
        url: 'https://example.com/events',
        headers: [],
        params: [],
        reconnect: true
      },
      {
        onEvent(event) {
          events.push({ seq: event.seq, data: event.data });
          if (events.length >= 2) {
            void session.close();
          }
        },
        onReconnecting() {
          reconnects += 1;
        }
      }
    );

    await vi.waitFor(() => {
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    expect(reconnects).toBeGreaterThanOrEqual(1);
    expect(events.map((event) => event.seq)).toEqual([1, 2]);
    expect(events.map((event) => event.data)).toEqual(['first', 'second']);
  });
});
