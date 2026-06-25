import type { PluginHttpRequest, PluginHttpResponse } from '@harborclient/plugin-api';
import type { Disposable } from '#/shared/plugin/types';

type AfterSendHandler = (
  request: PluginHttpRequest,
  response: PluginHttpResponse
) => void | Promise<void>;

const handlers = new Set<AfterSendHandler>();

/**
 * Notifies renderer-side plugin after-send subscribers for a completed HTTP exchange.
 *
 * @param request - Request snapshot that was sent.
 * @param response - Response payload returned to the renderer.
 */
export function emitPluginAfterSend(
  request: PluginHttpRequest,
  response: PluginHttpResponse
): void {
  for (const handler of handlers) {
    void Promise.resolve(handler(request, response)).catch((error) => {
      console.error('Plugin renderer after-send handler failed:', error);
    });
  }
}

/**
 * Subscribes to completed HTTP sends in the renderer for plugin lifecycle hooks.
 *
 * @param handler - Called with the sent request and response payload.
 * @returns A disposable that removes the listener when disposed.
 */
export function subscribePluginAfterSend(handler: AfterSendHandler): Disposable {
  handlers.add(handler);
  return {
    dispose: () => {
      handlers.delete(handler);
    }
  };
}

/**
 * Clears all after-send subscribers. Used in tests.
 */
export function clearPluginAfterSendSubscribers(): void {
  handlers.clear();
}
