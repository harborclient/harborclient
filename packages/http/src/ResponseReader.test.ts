import { describe, expect, it } from 'vitest';
import { HARD_MAX_RESPONSE_SIZE_MB } from './settings.js';
import { ResponseReader } from './ResponseReader.js';

/**
 * Builds a fetch Response backed by a ReadableStream of byte chunks.
 *
 * @param chunks - Ordered body chunks to enqueue before closing the stream.
 * @param init - Optional ResponseInit including headers.
 */
function createStreamResponse(chunks: Uint8Array[], init?: ResponseInit): Response {
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    }
  });

  return new Response(stream, { status: 200, statusText: 'OK', ...init });
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

    it('includes bodyBase64 for image content-type responses', async () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const response = createStreamResponse([bytes], {
        headers: { 'content-type': 'image/png' }
      });

      const result = await responseReader.read(response, 1);

      expect(result).toEqual({
        body: new TextDecoder().decode(bytes),
        sizeBytes: bytes.length,
        bodyBase64: Buffer.from(bytes).toString('base64')
      });
    });

    it('omits bodyBase64 for non-image content-type responses', async () => {
      const payload = 'plain text';
      const response = createStreamResponse([new TextEncoder().encode(payload)], {
        headers: { 'content-type': 'text/plain' }
      });

      const result = await responseReader.read(response, 1);

      expect(result).toEqual({
        body: payload,
        sizeBytes: new TextEncoder().encode(payload).length
      });
      expect(result).not.toHaveProperty('bodyBase64');
    });
  });
});
