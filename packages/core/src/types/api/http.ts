import type { KeyValue } from '../common';
import type { ScriptRunInput, ScriptRunResult } from '../script';
import type {
  SendRequestInput,
  SendResult,
  SessionOpenInfo,
  SessionOpenInput,
  SseEvent
} from '../request';
import type { ScriptLivePageRequest } from '../../scripting/scriptApi';

/**
 * Renderer-facing SSE session connection status.
 */
export type SseSessionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';

/**
 * Batched SSE events pushed from main to the renderer for one session.
 */
export interface SseEventPush {
  /**
   * Client request id passed to {@link ApiHttp.openSseSession}.
   */
  requestId: string;

  /**
   * Events accumulated since the last flush.
   */
  events: SseEvent[];
}

/**
 * SSE session state change pushed from main to the renderer.
 */
export interface SseStatePush {
  /**
   * Client request id passed to {@link ApiHttp.openSseSession}.
   */
  requestId: string;

  /**
   * Current session lifecycle status.
   */
  status: SseSessionStatus;

  /**
   * Handshake metadata when status becomes `open` (or after error with headers).
   */
  openInfo?: SessionOpenInfo;

  /**
   * User-facing error when status is `error` or close carried a message.
   */
  error?: string;

  /**
   * Reconnect delay info when status is `reconnecting`.
   */
  reconnect?: {
    afterMs: number;
    attempt: number;
  };
}

/**
 * IPC methods for http.
 */
export interface ApiHttp {
  /**
   * Sends an HTTP request via the main process.
   *
   * @param req - Request configuration to execute.
   * @param requestId - Optional ID used to cancel the in-flight request.
   * @returns Response metadata from the main process.
   */
  sendRequest: (req: SendRequestInput, requestId?: string) => Promise<SendResult>;
  /**
   * Cancels an in-flight HTTP request by ID.
   *
   * @param requestId - ID passed to sendRequest when the request was started.
   */
  cancelRequest: (requestId: string) => Promise<void>;

  /**
   * Opens an SSE session in the main process and streams events to the renderer.
   *
   * @param input - SSE URL, headers, params, and reconnect options.
   * @param requestId - Client id used to correlate push events and close the session.
   * @returns Resolves when the session handle is registered (before the first event).
   */
  openSseSession: (input: SessionOpenInput, requestId: string) => Promise<void>;

  /**
   * Closes an open SSE session by client request id.
   *
   * @param requestId - ID passed to {@link openSseSession}.
   */
  closeSseSession: (requestId: string) => Promise<void>;

  /**
   * Subscribes to batched SSE events from main.
   *
   * @param callback - Handler invoked with one or more events for a session.
   * @returns Unsubscribe function.
   */
  onSseEvent: (callback: (payload: SseEventPush) => void) => () => void;

  /**
   * Subscribes to SSE session state changes from main.
   *
   * @param callback - Handler invoked when a session connects, reconnects, or closes.
   * @returns Unsubscribe function.
   */
  onSseState: (callback: (payload: SseStatePush) => void) => () => void;

  /**
   * Returns cookies stored for a hostname.
   *
   * @param domain - Hostname to query.
   */
  getCookies: (domain: string) => Promise<KeyValue[]>;
  /**
   * Returns all hostnames with saved cookies.
   */
  listCookieDomains: () => Promise<string[]>;
  /**
   * Persists cookies for a hostname.
   *
   * @param domain - Hostname to update.
   * @param cookies - Cookie rows to store.
   */
  setCookies: (domain: string, cookies: KeyValue[]) => Promise<void>;
  /**
   * Runs a pre/post script in a sandboxed JavaScript context.
   *
   * @param input - Script source, phase, request/response context, and variables.
   * @returns Mutated request, variable sets, tests, and logs from the sandbox.
   */
  runScript: (input: ScriptRunInput) => Promise<ScriptRunResult>;

  /**
   * Subscribes to script live-page invocations routed from the main-process script host.
   *
   * @param callback - Handler invoked with the request id and live-page operation.
   * @returns Unsubscribe function.
   */
  onScriptLivePageInvoke: (
    callback: (message: { requestId: number; req: ScriptLivePageRequest }) => void
  ) => () => void;

  /**
   * Completes a script live page invocation with a result or error.
   *
   * @param message - Completion payload for a prior {@link onScriptLivePageInvoke} request.
   */
  completeScriptLivePage: (message: {
    requestId: number;
    ok: boolean;
    result?: unknown;
    error?: string;
  }) => void;
}
