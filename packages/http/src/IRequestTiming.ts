import type { HttpMethod, RequestTimingPhases } from './types.js';

/**
 * Captures best-effort timing diagnostics for one outbound HTTP request hop.
 */
export interface IRequestTiming {
  /**
   * Starts collecting diagnostics for one request attempt.
   *
   * @param requestStart - High-resolution timestamp taken before fetch starts.
   * @param targetUrl - Fully resolved URL for the request attempt.
   * @param method - HTTP method used for the request attempt.
   * @returns Session that can stop listeners and derive phase durations.
   */
  start(requestStart: number, targetUrl: string, method: HttpMethod): IRequestTimingSession;
}

/**
 * Per-request diagnostics collection session.
 */
export interface IRequestTimingSession {
  /**
   * Unsubscribes request-scoped diagnostics listeners.
   */
  stop(): void;

  /**
   * Derives request timing phases from captured diagnostics.
   *
   * @param totalTimeMs - Total rounded request duration.
   * @returns Best-effort phase timings, or undefined when no useful events fired.
   */
  toPhases(totalTimeMs: number): RequestTimingPhases | undefined;
}
