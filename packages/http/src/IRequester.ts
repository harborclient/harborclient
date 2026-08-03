import type {
  NetworkSession,
  SendRequestInput,
  SendResult,
  SessionHandlers,
  SessionOpenInput
} from './types.js';
import type { RequestSettings } from './settings.js';

/**
 * Executes outbound HTTP requests and opens long-lived network sessions (SSE).
 */
export interface IRequester {
  /**
   * Executes an HTTP request via fetch and returns timing and response metadata.
   *
   * @param input - Method, URL, headers, params, body, and body type.
   * @param settings - General request settings for timeout, size limits, SSL verification, and redirect following.
   * @param signal - Optional abort signal to cancel the in-flight request.
   * @param cookieHeader - Optional Cookie header value from the cookie jar.
   */
  executeRequest(
    input: SendRequestInput,
    settings?: RequestSettings,
    signal?: AbortSignal,
    cookieHeader?: string
  ): Promise<SendResult>;

  /**
   * Opens a long-lived network session (SSE today) and returns a closeable handle.
   *
   * Events are delivered through {@link SessionHandlers} until the session closes
   * or the abort signal fires. Handshake timeout uses
   * {@link RequestSettings.requestTimeoutMs}; the open stream has no idle timeout.
   *
   * @param input - Protocol, URL, headers, params, and reconnect options.
   * @param handlers - Callbacks for open, events, reconnect, and close.
   * @param settings - General request settings for proxy, SSL, and handshake timeout.
   * @param signal - Optional abort signal to cancel the session from outside.
   * @param cookieHeader - Optional Cookie header value from the cookie jar.
   * @returns Session handle the caller can close.
   */
  openSession(
    input: SessionOpenInput,
    handlers: SessionHandlers,
    settings?: RequestSettings,
    signal?: AbortSignal,
    cookieHeader?: string
  ): Promise<NetworkSession>;
}
