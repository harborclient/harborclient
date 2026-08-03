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
});
