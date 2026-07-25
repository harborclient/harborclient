import type { PluginHttpResponse } from '../plugin/types';
import type { GeneralSettings, SendRequestInput, SendResult } from '../types';
import type { ICookieJar, PluginHooks, SettingsProvider } from '../interfaces';
import { applyUserAgentHeader, DEFAULT_USER_AGENT } from '../userAgent';
import { QueryString, Requester } from '@harborclient/http';

/**
 * Dependencies supplied by an application host for an HTTP send.
 */
export interface ExecuteHttpSendDependencies {
  /**
   * Provides the current request-engine settings without a storage singleton.
   */
  settings: SettingsProvider | GeneralSettings;

  /**
   * Persists and supplies cookies associated with request hosts.
   */
  cookieJar: ICookieJar;

  /**
   * Optional plugin lifecycle hooks implemented by the application host.
   */
  pluginHooks?: PluginHooks;
}

/**
 * Returns the current general settings regardless of provider form.
 *
 * @param settings - Settings provider or already-resolved general settings.
 * @returns Normalized general settings for the requester.
 */
function resolveGeneralSettings(settings: SettingsProvider | GeneralSettings): GeneralSettings {
  return 'getGeneralSettings' in settings ? settings.getGeneralSettings() : settings;
}

/**
 * Executes an HTTP request through the portable HarborClient HTTP stack.
 *
 * The caller injects persistence and plugin behavior so the engine has no
 * dependency on Electron or application-level singletons.
 *
 * @param req - Outbound request payload.
 * @param dependencies - Host-provided settings, cookie jar, and plugin hooks.
 * @param signal - Optional abort signal for cancellation.
 * @returns HTTP response metadata and body.
 */
export async function executeHttpSend(
  req: SendRequestInput,
  dependencies: ExecuteHttpSendDependencies,
  signal?: AbortSignal
): Promise<SendResult> {
  const general = resolveGeneralSettings(dependencies.settings);
  const withUserAgent: SendRequestInput = {
    ...req,
    headers: applyUserAgentHeader(req.headers, {
      general: general.userAgent || DEFAULT_USER_AGENT
    })
  };
  const hookedRequest = dependencies.pluginHooks?.beforeSend
    ? await dependencies.pluginHooks.beforeSend(withUserAgent)
    : withUserAgent;
  const url = new QueryString().buildUrl(hookedRequest.url, hookedRequest.params);
  const cookieHeader = dependencies.cookieJar.buildCookieHeader(url) ?? undefined;
  const result = await new Requester().executeRequest(hookedRequest, general, signal, cookieHeader);
  if (result.request?.url) {
    dependencies.cookieJar.captureSetCookies(result.request.url, result.setCookieHeaders);
  }
  if (!result.error && dependencies.pluginHooks?.afterSend) {
    const pluginResponse: PluginHttpResponse = {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
      body: result.body
    };
    await dependencies.pluginHooks.afterSend(hookedRequest, pluginResponse);
  }
  return result;
}

/**
 * Returns whether scripts may initiate outbound HTTP under supplied settings.
 *
 * @param settings - Settings provider or already-resolved general settings.
 * @returns True when hc.sendRequest is allowed.
 */
export function isScriptNetworkAllowed(settings: SettingsProvider | GeneralSettings): boolean {
  return resolveGeneralSettings(settings).allowScriptNetworkRequests === true;
}
