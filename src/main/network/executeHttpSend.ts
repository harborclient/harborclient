import type { ICookieJar } from '#/main/cookieJar/ICookieJar';
import { applyPluginAfterSendHooks, applyPluginBeforeSendHooks } from '#/main/ipc/handlers/plugins';
import { getGeneralSettings } from '#/main/settings/generalSettings';
import type { PluginHttpResponse } from '#/shared/plugin/types';
import type { SendRequestInput, SendResult } from '#/shared/types';
import { QueryString, Requester } from '@harborclient/http';

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
  const settings = getGeneralSettings();
  const hookedRequest = await applyPluginBeforeSendHooks(req);
  const url = new QueryString().buildUrl(hookedRequest.url, hookedRequest.params);
  const cookieHeader = cookieJar.buildCookieHeader(url) ?? undefined;
  const result = await new Requester().executeRequest(
    hookedRequest,
    settings,
    signal,
    cookieHeader
  );
  if (result.request?.url) {
    cookieJar.captureSetCookies(result.request.url, result.setCookieHeaders);
  }
  if (!result.error) {
    const pluginResponse: PluginHttpResponse = {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
      body: result.body
    };
    await applyPluginAfterSendHooks(hookedRequest, pluginResponse);
  }
  return result;
}

/**
 * Returns whether script-initiated network requests are allowed by general settings.
 *
 * @returns True when hc.sendRequest may execute outbound HTTP from scripts.
 */
export function isScriptNetworkAllowed(): boolean {
  return getGeneralSettings().allowScriptNetworkRequests === true;
}
