import type { ICookieJar } from '#/main/cookieJar/ICookieJar';
import { applyPluginAfterSendHooks, applyPluginBeforeSendHooks } from '#/main/ipc/handlers/plugins';
import { getGeneralSettings } from '#/main/settings/generalSettings';
import type { SendRequestInput, SendResult } from '@harborclient/core/types';
import {
  executeHttpSend as executeCoreHttpSend,
  isScriptNetworkAllowed as isCoreScriptNetworkAllowed
} from '@harborclient/core/network/executeHttpSend';

/**
 * Executes an HTTP request through the shared HarborClient stack.
 *
 * Applies plugin before/after-send hooks, attaches cookies from the jar, and
 * captures Set-Cookie response headers back into the jar.
 *
 * @param req - Outbound request payload.
 * @param cookieJar - Cookie jar used for Cookie header attachment and capture.
 * @param signal - Optional abort signal for cancellation.
 * @returns HTTP response metadata and body.
 */
export async function executeHttpSend(
  req: SendRequestInput,
  cookieJar: ICookieJar,
  signal?: AbortSignal
): Promise<SendResult> {
  return executeCoreHttpSend(
    req,
    {
      settings: getGeneralSettings(),
      cookieJar,
      pluginHooks: {
        beforeSend: applyPluginBeforeSendHooks,
        afterSend: applyPluginAfterSendHooks
      }
    },
    signal
  );
}

/**
 * Returns whether script-initiated network requests are allowed by general settings.
 *
 * @returns True when hc.fetch may execute outbound HTTP from scripts.
 */
export function isScriptNetworkAllowed(): boolean {
  return isCoreScriptNetworkAllowed(getGeneralSettings());
}
