import type { PluginHttpResponse } from '../plugin/types';
import type {
  GeneralSettings,
  NetworkSession,
  SessionHandlers,
  SessionOpenInfo,
  SessionOpenInput,
  SendRequestInput
} from '../types';
import type { ICookieJar, PluginHooks, SettingsProvider } from '../interfaces';
import { applyUserAgentHeader, DEFAULT_USER_AGENT } from '../userAgent';
import { QueryString, Requester } from '@harborclient/http';

/**
 * Dependencies supplied by an application host for an SSE session.
 */
export interface OpenSseSessionDependencies {
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
 * Builds a synthetic {@link SendRequestInput} so plugin `beforeSend` hooks can
 * rewrite URL, headers, and params for an SSE connect.
 *
 * @param input - SSE session open input.
 * @returns HTTP-shaped send payload with GET and no body.
 */
function toSendRequestInput(input: SessionOpenInput): SendRequestInput {
  return {
    method: 'GET',
    url: input.url,
    headers: input.headers,
    params: input.params,
    body: '',
    bodyType: 'none'
  };
}

/**
 * Merges plugin `beforeSend` mutations back into the SSE session input.
 *
 * @param input - Original SSE open input.
 * @param hooked - Possibly mutated HTTP send payload from plugins.
 * @returns Session input with updated URL, headers, and params.
 */
function fromSendRequestInput(input: SessionOpenInput, hooked: SendRequestInput): SessionOpenInput {
  return {
    ...input,
    url: hooked.url,
    headers: hooked.headers,
    params: hooked.params
  };
}

/**
 * Opens an SSE session through the portable HarborClient HTTP stack.
 *
 * Applies the user-agent header and plugin before-send hooks, attaches cookies,
 * and captures Set-Cookie headers from the handshake. Event delivery stays on
 * the supplied {@link SessionHandlers}.
 *
 * @param input - SSE URL, headers, params, and reconnect options.
 * @param handlers - Open / event / reconnect / close callbacks from the host.
 * @param dependencies - Host-provided settings, cookie jar, and plugin hooks.
 * @param signal - Optional abort signal for disconnection.
 * @returns Closeable network session handle.
 */
export async function openSseSession(
  input: SessionOpenInput,
  handlers: SessionHandlers,
  dependencies: OpenSseSessionDependencies,
  signal?: AbortSignal
): Promise<NetworkSession> {
  const general = resolveGeneralSettings(dependencies.settings);
  const asHttp = toSendRequestInput(input);
  const withUserAgent: SendRequestInput = {
    ...asHttp,
    headers: applyUserAgentHeader(asHttp.headers, {
      general: general.userAgent || DEFAULT_USER_AGENT
    })
  };
  const hookedRequest = dependencies.pluginHooks?.beforeSend
    ? await dependencies.pluginHooks.beforeSend(withUserAgent)
    : withUserAgent;
  const sessionInput = fromSendRequestInput(input, hookedRequest);
  const url = new QueryString().buildUrl(sessionInput.url, sessionInput.params);
  const cookieHeader = dependencies.cookieJar.buildCookieHeader(url) ?? undefined;

  /**
   * Captures cookies from the handshake and forwards onOpen to the host.
   *
   * @param info - Handshake status and headers.
   */
  const onOpen = (info: SessionOpenInfo): void => {
    dependencies.cookieJar.captureSetCookies(url, info.setCookieHeaders);
    handlers.onOpen?.(info);
  };

  /**
   * Forwards close and optionally runs afterSend with a summary response.
   *
   * @param info - Close reason and optional error.
   */
  const onClose: NonNullable<SessionHandlers['onClose']> = async (info) => {
    handlers.onClose?.(info);
  };

  return new Requester().openSession(
    sessionInput,
    {
      onOpen,
      onEvent: handlers.onEvent,
      onReconnecting: handlers.onReconnecting,
      onClose
    },
    general,
    signal,
    cookieHeader
  );
}

/**
 * Builds a plugin HTTP response snapshot from SSE handshake info for afterSend.
 *
 * @param info - Handshake open info.
 * @param body - Optional summary body text.
 * @returns Plugin response shape.
 */
export function sseOpenInfoToPluginResponse(info: SessionOpenInfo, body = ''): PluginHttpResponse {
  return {
    status: info.status,
    statusText: info.statusText,
    headers: info.headers,
    body
  };
}
