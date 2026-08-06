import type { Dispatcher } from 'undici';
import type { IHeaders } from './IHeaders.js';
import type { IQueryString } from './IQueryString.js';
import type { IRequestTiming } from './IRequestTiming.js';
import { Headers } from './Headers.js';
import { QueryString } from './QueryString.js';
import { RequestTiming } from './RequestTiming.js';
import { mapFetchError } from './mapFetchError.js';
import {
  DEFAULT_SSE_RETRY_MS,
  isEventStreamContentType,
  SseParser,
  sseReconnectDelay
} from './SseParser.js';
import type { RequestSettings } from './settings.js';
import { DEFAULT_REQUEST_SETTINGS } from './settings.js';
import type {
  NetworkSession,
  SessionHandlers,
  SessionOpenInfo,
  SessionOpenInput
} from './types.js';

/**
 * Collaborators injected into {@link SseClient}.
 */
export interface SseClientDeps {
  /**
   * Query-string URL builder.
   */
  queryString?: IQueryString;

  /**
   * Request header builder and cookie merger.
   */
  headers?: IHeaders;

  /**
   * Handshake timing collector.
   */
  timing?: IRequestTiming;

  /**
   * Undici dispatcher for proxy or insecure TLS (from {@link Requester}).
   */
  dispatcher?: Dispatcher;

  /**
   * Factory for session ids; defaults to `crypto.randomUUID`.
   */
  createSessionId?: () => string;

  /**
   * Injectable sleep used by reconnect backoff (tests).
   */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/**
 * Opens and maintains Server-Sent Events sessions over undici fetch.
 *
 * Reuses HarborClient header, query-string, proxy, and TLS settings so SSE
 * connections behave like buffered HTTP sends. The response body is read
 * incrementally — never through {@link ResponseReader}.
 */
export class SseClient {
  readonly #queryString: IQueryString;
  readonly #headers: IHeaders;
  readonly #timing: IRequestTiming;
  readonly #dispatcher: Dispatcher | undefined;
  readonly #createSessionId: () => string;
  readonly #sleep: (ms: number, signal?: AbortSignal) => Promise<void>;

  /**
   * Creates an SSE client with optional collaborators.
   *
   * @param deps - Query string, headers, timing, dispatcher, and test hooks.
   */
  constructor(deps: SseClientDeps = {}) {
    this.#queryString = deps.queryString ?? new QueryString();
    this.#headers = deps.headers ?? new Headers();
    this.#timing = deps.timing ?? new RequestTiming();
    this.#dispatcher = deps.dispatcher;
    this.#createSessionId = deps.createSessionId ?? (() => crypto.randomUUID());
    this.#sleep = deps.sleep ?? defaultSleep;
  }

  /**
   * Opens an SSE session and begins delivering events through {@link handlers}.
   *
   * Resolves once the session handle is ready (before or as the first connect
   * runs). Handshake failures still produce `onOpen`/`onClose` when headers
   * were received.
   *
   * @param input - URL, headers, params, and reconnect options.
   * @param handlers - Open / event / reconnect / close callbacks.
   * @param settings - Proxy, SSL, and handshake timeout settings.
   * @param signal - Optional abort signal from the host (Disconnect).
   * @param cookieHeader - Optional Cookie header from the cookie jar.
   * @returns Closeable session handle.
   */
  async open(
    input: SessionOpenInput,
    handlers: SessionHandlers,
    settings: RequestSettings = DEFAULT_REQUEST_SETTINGS,
    signal?: AbortSignal,
    cookieHeader?: string
  ): Promise<NetworkSession> {
    const sessionId = this.#createSessionId();
    const controller = new AbortController();
    const unlinkAbort = linkAbort(signal, controller);

    const session: NetworkSession = {
      id: sessionId,
      protocol: 'sse',
      close: async () => {
        controller.abort();
      }
    };

    void this.#runLoop(input, handlers, settings, cookieHeader, controller.signal).finally(() => {
      unlinkAbort();
    });

    return session;
  }

  /**
   * Connect / read / reconnect loop until abort or a non-reconnecting close.
   *
   * @param input - Session open input.
   * @param handlers - Session callbacks.
   * @param settings - Request settings.
   * @param cookieHeader - Optional cookie jar header.
   * @param signal - Combined abort signal for this session.
   */
  async #runLoop(
    input: SessionOpenInput,
    handlers: SessionHandlers,
    settings: RequestSettings,
    cookieHeader: string | undefined,
    signal: AbortSignal
  ): Promise<void> {
    const allowReconnect = input.reconnect !== false;
    let lastEventId = input.lastEventId ?? '';
    let retryMs = DEFAULT_SSE_RETRY_MS;
    let attempt = 0;
    let closed = false;
    /**
     * Session-scoped event sequence so reconnects do not restart at 1.
     */
    let eventSeq = 0;

    /**
     * Emits onClose at most once for this session.
     *
     * @param reason - Close classification.
     * @param error - Optional user-facing message.
     */
    const finish = (reason: 'client' | 'server' | 'error', error?: string): void => {
      if (closed) {
        return;
      }
      closed = true;
      handlers.onClose?.({ reason, ...(error ? { error } : {}) });
    };

    while (!signal.aborted && !closed) {
      attempt += 1;
      const result = await this.#connectOnce(
        input,
        handlers,
        settings,
        cookieHeader,
        signal,
        lastEventId,
        eventSeq
      );
      eventSeq = result.eventSeq ?? eventSeq;

      if (result.lastEventId) {
        lastEventId = result.lastEventId;
      }
      if (result.retryMs != null) {
        retryMs = result.retryMs;
      }

      if (signal.aborted) {
        finish('client');
        return;
      }

      if (result.fatal) {
        finish(result.closeReason, result.error);
        return;
      }

      if (!allowReconnect) {
        finish(result.closeReason, result.error);
        return;
      }

      const delay = sseReconnectDelay(retryMs, attempt);
      handlers.onReconnecting?.(delay, attempt);
      try {
        await this.#sleep(delay, signal);
      } catch {
        finish('client');
        return;
      }
    }

    if (!closed) {
      finish(signal.aborted ? 'client' : 'server');
    }
  }

  /**
   * Performs one HTTP GET and streams events until the body ends or aborts.
   *
   * @param input - Session open input.
   * @param handlers - Session callbacks.
   * @param settings - Request settings.
   * @param cookieHeader - Optional cookie jar header.
   * @param signal - Session abort signal.
   * @param lastEventId - Last-Event-ID for this attempt.
   * @param startSeq - Highest sequence already emitted in this session.
   * @returns Connect outcome used by the reconnect loop.
   */
  async #connectOnce(
    input: SessionOpenInput,
    handlers: SessionHandlers,
    settings: RequestSettings,
    cookieHeader: string | undefined,
    signal: AbortSignal,
    lastEventId: string,
    startSeq: number
  ): Promise<ConnectOnceResult> {
    const url = this.#queryString.buildUrl(input.url, input.params);
    if (!url.trim()) {
      return { fatal: true, closeReason: 'error', error: 'URL is required' };
    }
    if (!this.#queryString.isValidRequestUrl(url)) {
      return { fatal: true, closeReason: 'error', error: 'Invalid URL' };
    }

    const builtHeaders = this.#headers.build(input.headers, 'none');
    if (!builtHeaders.ok) {
      return { fatal: true, closeReason: 'error', error: builtHeaders.error };
    }

    const headers = { ...builtHeaders.headers };
    ensureHeader(headers, 'Accept', 'text/event-stream');
    ensureHeader(headers, 'Cache-Control', 'no-cache');
    if (lastEventId) {
      headers['Last-Event-ID'] = lastEventId;
    }

    const cookieResult = this.#headers.applyCookie(headers, cookieHeader);
    if (!cookieResult.ok) {
      return { fatal: true, closeReason: 'error', error: cookieResult.error };
    }

    const start = performance.now();
    // Handshake uses its own abort controller so requestTimeoutMs cannot kill
    // the open stream after headers arrive. Session abort still cancels fetch.
    const handshakeAbort = new AbortController();
    const unlinkHandshake = linkAbort(signal, handshakeAbort);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (settings.requestTimeoutMs > 0) {
      timeoutId = setTimeout(() => {
        handshakeAbort.abort(
          new DOMException(`Request timed out after ${settings.requestTimeoutMs}ms`, 'TimeoutError')
        );
      }, settings.requestTimeoutMs);
    }

    const init: RequestInit & { dispatcher?: Dispatcher } = {
      method: 'GET',
      headers,
      signal: handshakeAbort.signal,
      redirect: 'follow'
    };
    if (this.#dispatcher) {
      init.dispatcher = this.#dispatcher;
    }

    const timingSession = this.#timing.start(start, url, 'GET');
    let response: Response;
    try {
      response = await fetch(url, init);
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
      timingSession.stop();
      unlinkHandshake();
      if (signal.aborted) {
        return { fatal: true, closeReason: 'client' };
      }
      return {
        fatal: true,
        closeReason: 'error',
        error: mapFetchError(err, settings.requestTimeoutMs)
      };
    }
    timingSession.stop();
    unlinkHandshake();

    // After headers: cancel the response if the session aborts, without the
    // handshake timeout. Re-link session abort to cancel the body reader.
    if (signal.aborted) {
      await response.body?.cancel().catch(() => undefined);
      return { fatal: true, closeReason: 'client' };
    }

    const timeMs = Math.round(performance.now() - start);
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    const setCookieHeaders =
      typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    const openInfo: SessionOpenInfo = {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      ...(setCookieHeaders.length > 0 ? { setCookieHeaders } : {}),
      timing: timingSession.toPhases(timeMs)
    };
    handlers.onOpen?.(openInfo);

    if (response.status < 200 || response.status >= 300) {
      await response.body?.cancel().catch(() => undefined);
      return {
        fatal: true,
        closeReason: 'error',
        error: `Unexpected status ${response.status} ${response.statusText}`.trim()
      };
    }

    if (!isEventStreamContentType(response.headers.get('content-type'))) {
      await response.body?.cancel().catch(() => undefined);
      return {
        fatal: true,
        closeReason: 'error',
        error: 'Response Content-Type is not text/event-stream'
      };
    }

    if (!response.body) {
      return {
        fatal: true,
        closeReason: 'error',
        error: 'Response body is empty'
      };
    }

    // After headers, switch to the session signal without the handshake timeout
    // so the open stream is not killed by requestTimeoutMs.
    const streamAbort = new AbortController();
    const unlinkStream = linkAbort(signal, streamAbort);
    try {
      return await this.#readStream(
        response.body,
        handlers,
        lastEventId,
        startSeq,
        streamAbort.signal
      );
    } finally {
      unlinkStream();
    }
  }

  /**
   * Reads and parses the SSE body until EOF or abort.
   *
   * @param body - Fetch response body stream.
   * @param handlers - Session callbacks.
   * @param lastEventId - Seed Last-Event-ID for the parser.
   * @param startSeq - Highest sequence already emitted in this session.
   * @param signal - Abort signal for the open stream.
   * @returns Non-fatal server close, or fatal client abort.
   */
  async #readStream(
    body: ReadableStream<Uint8Array>,
    handlers: SessionHandlers,
    lastEventId: string,
    startSeq: number,
    signal: AbortSignal
  ): Promise<ConnectOnceResult> {
    const parser = new SseParser(lastEventId, startSeq);
    const reader = body.getReader();
    const decoder = new TextDecoder();

    /**
     * Cancels the reader when the session aborts mid-stream.
     */
    const onAbort = (): void => {
      void reader.cancel().catch(() => undefined);
    };
    signal.addEventListener('abort', onAbort, { once: true });

    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) {
          parser.flush();
          break;
        }
        if (!value) {
          continue;
        }
        const text = decoder.decode(value, { stream: true });
        for (const event of parser.push(text)) {
          handlers.onEvent(event);
        }
      }

      if (signal.aborted) {
        return {
          fatal: true,
          closeReason: 'client',
          lastEventId: parser.lastEventId,
          retryMs: parser.retryMs,
          eventSeq: parser.seq
        };
      }

      return {
        fatal: false,
        closeReason: 'server',
        lastEventId: parser.lastEventId,
        retryMs: parser.retryMs,
        eventSeq: parser.seq
      };
    } catch (err) {
      if (signal.aborted) {
        return {
          fatal: true,
          closeReason: 'client',
          lastEventId: parser.lastEventId,
          retryMs: parser.retryMs,
          eventSeq: parser.seq
        };
      }
      return {
        fatal: true,
        closeReason: 'error',
        error: err instanceof Error ? err.message : String(err),
        lastEventId: parser.lastEventId,
        retryMs: parser.retryMs,
        eventSeq: parser.seq
      };
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }
}

/**
 * Outcome of a single SSE connect attempt.
 */
interface ConnectOnceResult {
  /**
   * When true, the reconnect loop should stop.
   */
  fatal: boolean;

  /**
   * Close reason to report when finishing or after a non-reconnect close.
   */
  closeReason: 'client' | 'server' | 'error';

  /**
   * Optional user-facing error message.
   */
  error?: string;

  /**
   * Last-Event-ID observed during this attempt.
   */
  lastEventId?: string;

  /**
   * Retry interval from the most recent `retry:` field.
   */
  retryMs?: number;

  /**
   * Highest event sequence emitted after this attempt (session-scoped).
   */
  eventSeq?: number;
}

/**
 * Sets a header when no case-insensitive match already exists.
 *
 * @param headers - Mutable header map.
 * @param name - Header name to set.
 * @param value - Header value.
 */
function ensureHeader(headers: Record<string, string>, name: string, value: string): void {
  const lower = name.toLowerCase();
  if (Object.keys(headers).some((key) => key.toLowerCase() === lower)) {
    return;
  }
  headers[name] = value;
}

/**
 * Forwards abort from `source` onto `target` and returns an unlink function.
 *
 * @param source - Optional external abort signal.
 * @param target - Controller to abort when the source fires.
 * @returns Cleanup that removes the listener.
 */
function linkAbort(source: AbortSignal | undefined, target: AbortController): () => void {
  if (!source) {
    return () => undefined;
  }
  if (source.aborted) {
    target.abort();
    return () => undefined;
  }
  /**
   * Aborts the target when the source signal fires.
   */
  const onAbort = (): void => {
    target.abort();
  };
  source.addEventListener('abort', onAbort, { once: true });
  return () => source.removeEventListener('abort', onAbort);
}

/**
 * Sleeps until `ms` elapses or `signal` aborts.
 *
 * @param ms - Delay in milliseconds.
 * @param signal - Optional abort signal.
 * @throws {DOMException} When aborted.
 */
function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);
    /**
     * Rejects the sleep when the abort signal fires.
     */
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
