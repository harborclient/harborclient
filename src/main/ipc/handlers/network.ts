import { buildCookieHeader, captureSetCookies } from '#/main/cookieJar';
import { buildUrl, executeRequest } from '#/main/http';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { runScript } from '#/main/scripts';
import { getGeneralSettings } from '#/main/settings/generalSettings';

/**
 * In-flight HTTP requests keyed by client request id for cancellation.
 * Entries exist only while a tracked `http:send` is running; late `http:cancel`
 * calls are intentional no-ops. Untrack uses reference equality so a slow
 * cleanup cannot remove a newer request that reused the same id.
 */
const activeRequests = new Map<string, AbortController>();

/**
 * Registers an AbortController so `http:cancel` can abort the matching request.
 *
 * @param requestId - Client-generated id passed to `http:send`.
 * @param controller - Controller whose signal is wired into the fetch.
 */
function trackActiveRequest(requestId: string, controller: AbortController): void {
  activeRequests.set(requestId, controller);
}

/**
 * Removes a tracked request when `http:send` finishes, but only if this
 * handler still owns the map entry.
 *
 * @param requestId - Client-generated id passed to `http:send`.
 * @param controller - Controller created for that send invocation.
 */
function untrackActiveRequest(requestId: string, controller: AbortController): void {
  if (activeRequests.get(requestId) === controller) {
    activeRequests.delete(requestId);
  }
}

/**
 * Aborts an in-flight HTTP request and removes it from the active map.
 * No-op when the id is unknown or the request already finished — including
 * cancel arriving after completion but before `http:send`'s cleanup runs.
 *
 * @param requestId - Client-generated id passed to `http:send`.
 */
function cancelActiveRequest(requestId: string): void {
  const controller = activeRequests.get(requestId);
  if (!controller) {
    return;
  }
  activeRequests.delete(requestId);
  controller.abort();
}

/**
 * Registers IPC handlers for HTTP execution, cancellation, and script sandboxing.
 */
export function registerNetworkHandlers(): void {
  // Sends an HTTP request and captures response cookies in the jar.
  handle('http:send', ipcArgSchemas.sendRequest, async (_event, req, requestId) => {
    const controller = new AbortController();
    if (requestId) {
      trackActiveRequest(requestId, controller);
    }

    try {
      const settings = getGeneralSettings();
      const url = buildUrl(req.url, req.params);
      const cookieHeader = buildCookieHeader(url) ?? undefined;
      const result = await executeRequest(req, settings, controller.signal, cookieHeader);
      if (result.request?.url) {
        captureSetCookies(result.request.url, result.setCookieHeaders);
      }
      return result;
    } finally {
      if (requestId) {
        untrackActiveRequest(requestId, controller);
      }
    }
  });

  // Aborts an in-flight HTTP request by its client-side request id.
  handle('http:cancel', ipcArgSchemas.cancelRequest, (_event, requestId) => {
    cancelActiveRequest(requestId);
  });

  // Runs a pre- or post-request script in the main-process sandbox.
  handle('scripts:run', ipcArgSchemas.scriptRun, (_event, input) => runScript(input));
}
