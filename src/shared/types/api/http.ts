import type { KeyValue } from '#/shared/types/common';
import type { ScriptRunInput, ScriptRunResult } from '#/shared/types/script';
import type { SendRequestInput, SendResult } from '#/shared/types/request';

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
}
