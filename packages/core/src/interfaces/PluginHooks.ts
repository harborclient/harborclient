import type {
  PluginAfterScriptsContext,
  PluginHttpRequest,
  PluginHttpResponse,
  PluginInjectedScript
} from '@harborclient/sdk';
import type { ScriptRequestContext, SendRequestInput } from '../types';

/**
 * Result of {@link PluginHooks.beforeScripts}: injected scripts plus the updated data bag.
 */
export interface PluginBeforeScriptsResult {
  /**
   * Stage-tagged plugin scripts in injection order.
   */
  scripts: PluginInjectedScript[];

  /**
   * Ephemeral bag after plugin writes (script-side `hc.data`).
   */
  data: Record<string, unknown>;
}

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

  /**
   * Collects plugin-injected scripts and data-bag writes before one stage runs.
   *
   * @param input - Stage, request snapshot entering the stage, and current data bag.
   * @returns Injected scripts in stage-tagged injection order plus the updated bag.
   */
  beforeScripts?(input: {
    phase: 'pre' | 'post';
    request: ScriptRequestContext;
    data: Record<string, unknown>;
    sourceRequestId?: number;
    sourceRequestName?: string;
  }): Promise<PluginBeforeScriptsResult> | PluginBeforeScriptsResult;

  /**
   * Observes the summary of one completed request stage.
   *
   * @param context - Stage, data bag, tests, logs, and errors from the stage.
   */
  afterScripts?(context: PluginAfterScriptsContext): Promise<void> | void;
}
