import type { SendRequestInput } from '../types';
import type { PluginHttpRequest, PluginHttpResponse } from '@harborclient/sdk';

/**
 * Optional hooks applied around outbound HTTP sends (plugins in the GUI).
 *
 * CLI typically supplies identity / no-op implementations.
 */
export interface PluginHooks {
  /**
   * Mutates or replaces a request before it is sent.
   *
   * @param request - Outbound request payload.
   * @returns Request to send (may be the same object).
   */
  beforeSend?(request: SendRequestInput): Promise<SendRequestInput> | SendRequestInput;

  /**
   * Observes a successful HTTP response after send.
   *
   * @param request - Request that was sent (after beforeSend).
   * @param response - HTTP response metadata for plugins.
   */
  afterSend?(
    request: SendRequestInput | PluginHttpRequest,
    response: PluginHttpResponse
  ): Promise<void> | void;
}
