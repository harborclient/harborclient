import type { ICookieJar } from '#/main/cookieJar/ICookieJar';
import { applyPluginBeforeSendHooks } from '#/main/ipc/handlers/plugins';
import { getGeneralSettings } from '#/main/settings/generalSettings';
import type { NetworkSession, SessionHandlers, SessionOpenInput } from '@harborclient/core/types';
import { openSseSession as openCoreSseSession } from '@harborclient/core/network/openSseSession';

/**
 * Opens an SSE session through the shared HarborClient stack.
 *
 * Applies plugin before-send hooks and attaches cookies from the jar. Set-Cookie
 * capture happens in the core helper when handshake headers arrive.
 *
 * @param input - SSE session open payload.
 * @param handlers - Session callbacks (events are pushed to the renderer by the IPC layer).
 * @param cookieJar - Cookie jar used for Cookie header attachment and capture.
 * @param signal - Optional abort signal for disconnection.
 * @returns Closeable network session handle.
 */
export async function openSseSession(
  input: SessionOpenInput,
  handlers: SessionHandlers,
  cookieJar: ICookieJar,
  signal?: AbortSignal
): Promise<NetworkSession> {
  return openCoreSseSession(
    input,
    handlers,
    {
      settings: getGeneralSettings(),
      cookieJar,
      pluginHooks: {
        beforeSend: applyPluginBeforeSendHooks
      }
    },
    signal
  );
}
