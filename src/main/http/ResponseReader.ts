import { HARD_MAX_RESPONSE_SIZE_MB } from '#/main/settings/generalSettings';
import type { IResponseReader, ReadResponseBodyResult } from '#/main/http/IResponseReader';

/**
 * Reads fetch response bodies with user and hard size limits.
 */
export class ResponseReader implements IResponseReader {
  /**
   * Resolves the effective response size limit in megabytes.
   *
   * @param maxResponseSizeMb - User setting; 0 means no configurable limit.
   * @returns The user limit when positive, otherwise {@link HARD_MAX_RESPONSE_SIZE_MB}.
   */
  resolveMaxResponseSizeMb(maxResponseSizeMb: number): number {
    return maxResponseSizeMb > 0 ? maxResponseSizeMb : HARD_MAX_RESPONSE_SIZE_MB;
  }

  /**
   * Reads a response body, enforcing a max size in megabytes.
   *
   * When {@link maxResponseSizeMb} is 0, the user-configurable limit is disabled but
   * {@link HARD_MAX_RESPONSE_SIZE_MB} still applies as a safety ceiling.
   *
   * @param response - Fetch response to read.
   * @param maxResponseSizeMb - Maximum body size in MB; 0 uses the hard cap only.
   */
  async read(response: Response, maxResponseSizeMb: number): Promise<ReadResponseBodyResult> {
    const effectiveMaxMb = this.resolveMaxResponseSizeMb(maxResponseSizeMb);
    const maxBytes = effectiveMaxMb * 1024 * 1024;

    const bodyStream =
      response.body ??
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        }
      });

    const reader = bodyStream.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          const error =
            maxResponseSizeMb > 0
              ? `Response exceeded max size of ${maxResponseSizeMb} MB`
              : `Response exceeded the maximum allowed size of ${HARD_MAX_RESPONSE_SIZE_MB} MB`;
          return { error };
        }
        chunks.push(value);
      }
    }

    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const body = new TextDecoder().decode(combined);
    return { body, sizeBytes: totalBytes };
  }
}
