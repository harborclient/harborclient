import { describe, expect, it } from 'vitest';
import { HARD_MAX_RESPONSE_SIZE_MB } from '#/main/http';
import { ResponseReader } from '#/main/http/ResponseReader';

/**
 * Builds a fetch Response backed by a ReadableStream of byte chunks.
 *
 * @param chunks - Ordered body chunks to enqueue before closing the stream.
 */
function createStreamResponse(chunks: Uint8Array[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    }
  });

  return new Response(stream, { status: 200, statusText: 'OK' });
}

describe('ResponseReader', () => {
  const responseReader = new ResponseReader();

  describe('resolveMaxResponseSizeMb', () => {
    it('returns the user limit when positive', () => {
      expect(responseReader.resolveMaxResponseSizeMb(50)).toBe(50);
      expect(responseReader.resolveMaxResponseSizeMb(1)).toBe(1);
    });

    it('returns the hard cap when the user limit is 0', () => {
      expect(responseReader.resolveMaxResponseSizeMb(0)).toBe(HARD_MAX_RESPONSE_SIZE_MB);
    });
  });

  describe('read', () => {
    it('returns body from a streaming response under the configured max size', async () => {
      const payload = 'hello stream';
      const response = createStreamResponse([new TextEncoder().encode(payload)]);

      const result = await responseReader.read(response, 1);

      expect(result).toEqual({
        body: payload,
        sizeBytes: new TextEncoder().encode(payload).length
      });
    });

    it('returns an error when a streaming response exceeds the configured max size', async () => {
      const oneMb = 1024 * 1024;
      const response = createStreamResponse([
        new Uint8Array(oneMb).fill(0x61),
        new Uint8Array(oneMb).fill(0x62)
      ]);

      const result = await responseReader.read(response, 1);

      expect(result).toEqual({ error: 'Response exceeded max size of 1 MB' });
    });

    it('reads streaming responses when maxResponseSizeMb is 0', async () => {
      const payload = 'unlimited-ish';
      const response = createStreamResponse([new TextEncoder().encode(payload)]);

      const result = await responseReader.read(response, 0);

      expect(result).toEqual({
        body: payload,
        sizeBytes: new TextEncoder().encode(payload).length
      });
    });

    it('returns an empty body for responses with no readable stream', async () => {
      const response = new Response(null, { status: 204, statusText: 'No Content' });

      const result = await responseReader.read(response, 1);

      expect(result).toEqual({ body: '', sizeBytes: 0 });
    });
  });
});
