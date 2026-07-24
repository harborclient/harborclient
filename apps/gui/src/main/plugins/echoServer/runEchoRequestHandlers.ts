import { hasEchoScriptReturnValue } from './resolveEchoResponseBody';
import type { EchoServerIncomingRequest } from './types';

/**
 * Runs registered plugin echo request handlers in registration order.
 *
 * Each handler may return a custom JSON body or `undefined`/`null` to keep the
 * result from the previous handler. Resolution against the default echo payload
 * happens once in the HTTP route (`createEchoApp`).
 *
 * @param handlers - Handlers registered via `hc.server.onRequest`.
 * @param request - Serializable incoming HTTP snapshot.
 * @returns Raw response body from the last handler that returned a value, or `undefined`.
 */
export async function runEchoRequestHandlers(
  handlers: Array<(request: EchoServerIncomingRequest) => unknown | Promise<unknown>>,
  request: EchoServerIncomingRequest
): Promise<unknown> {
  let body: unknown = undefined;
  for (const handler of handlers) {
    const result = await handler(request);
    if (hasEchoScriptReturnValue(result)) {
      body = result;
    }
  }
  return body;
}
