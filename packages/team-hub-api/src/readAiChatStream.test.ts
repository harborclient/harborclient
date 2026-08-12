import { describe, expect, it, vi } from 'vitest';
import { readAiChatStreamBody } from './readAiChatStream.js';

/**
 * Creates a byte stream whose chunks exercise SSE framing across network reads.
 *
 * @param chunks - UTF-8 response fragments emitted in order.
 * @returns Readable byte stream suitable for the SSE reader.
 */
function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    /**
     * Enqueues all fixture chunks before closing the response body.
     *
     * @param controller - Stream controller receiving encoded fixtures.
     */
    start(controller): void {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });
}

describe('readAiChatStreamBody', () => {
  it('validates split SSE frames, forwards events, and returns step.end', async () => {
    const onEvent = vi.fn();
    const body = streamFromChunks([
      ': connected\n\n',
      `data: ${JSON.stringify({
        v: 1,
        type: 'step.start',
        turnId: 'turn-1',
        stepIndex: 2
      })}\n\nda`,
      `ta: ${JSON.stringify({
        v: 1,
        type: 'delta.text',
        turnId: 'turn-1',
        stepIndex: 2,
        chunk: 'Hello'
      })}\n\n`,
      'data: {"v":999,"type":"step.end"}\n\n',
      `data: ${JSON.stringify({
        v: 1,
        type: 'step.end',
        turnId: 'turn-1',
        stepIndex: 2,
        content: 'Hello',
        toolCalls: [{ id: 'call-1', name: 'search', arguments: '{}' }]
      })}\n\n`
    ]);

    await expect(readAiChatStreamBody(body, { onEvent })).resolves.toEqual({
      content: 'Hello',
      toolCalls: [{ id: 'call-1', name: 'search', arguments: '{}' }]
    });
    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(onEvent).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'step.end' }));
  });

  it('throws the validated turn.error message when no step ends', async () => {
    const body = streamFromChunks([
      `data: ${JSON.stringify({
        v: 1,
        type: 'turn.error',
        turnId: 'turn-1',
        message: 'Hub failed'
      })}\n\n`
    ]);

    await expect(readAiChatStreamBody(body, { onEvent: vi.fn() })).rejects.toThrow('Hub failed');
  });

  it('rejects a stream that closes without step.end', async () => {
    const body = streamFromChunks([': heartbeat\n\n']);

    await expect(readAiChatStreamBody(body, { onEvent: vi.fn() })).rejects.toThrow(
      'closed without a step.end'
    );
  });
});
