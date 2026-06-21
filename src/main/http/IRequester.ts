import type { GeneralSettings, SendRequestInput, SendResult } from '#/shared/types';

/**
 * Executes outbound HTTP requests and returns timing and response metadata.
 */
export interface IRequester {
  /**
   * Executes an HTTP request via fetch and returns timing and response metadata.
   *
   * @param input - Method, URL, headers, params, body, and body type.
   * @param settings - General request settings for timeout, size limits, and SSL verification.
   * @param signal - Optional abort signal to cancel the in-flight request.
   * @param cookieHeader - Optional Cookie header value from the cookie jar.
   */
  executeRequest(
    input: SendRequestInput,
    settings?: GeneralSettings,
    signal?: AbortSignal,
    cookieHeader?: string
  ): Promise<SendResult>;
}
