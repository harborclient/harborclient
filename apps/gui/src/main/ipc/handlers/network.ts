import type { ICookieJar } from '#/main/cookieJar/ICookieJar';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { executeHttpSend } from '#/main/network/executeHttpSend';
import { openSseSession } from '#/main/network/openSseSession';
import { runScript } from '#/main/scripting/scripts';
import { initScriptRunnerHost } from '#/main/scripting/scriptRunnerHost';
import { getScriptLivePageBridge } from '#/main/scripting/scriptLivePageBridge';
import { getRegisteredMainWindow } from '#/main/window/mainWindowReveal';
import type {
  NetworkSession,
  SessionOpenInfo,
  SseEvent,
  SseEventPush,
  SseStatePush
} from '@harborclient/core/types';
import { ipcMain } from 'electron';

/**
 * Interval for flushing batched SSE events to the renderer.
 */
const SSE_EVENT_FLUSH_MS = 50;

/**
 * In-flight HTTP requests keyed by client request id for cancellation.
 * Entries exist only while a tracked `http:send` is running; late `http:cancel`
 * calls are intentional no-ops. Untrack uses reference equality so a slow
 * cleanup cannot remove a newer request that reused the same id.
 */
const activeRequests = new Map<string, AbortController>();

/**
 * Active SSE sessions keyed by client request id.
 */
const activeSseSessions = new Map<
  string,
  {
    controller: AbortController;
    session: NetworkSession | null;
    eventBuffer: SseEvent[];
    flushTimer: ReturnType<typeof setTimeout> | null;
  }
>();

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
 * Sends a payload to the main window renderer when it is available.
 *
 * @param channel - IPC channel name.
 * @param payload - Event payload.
 */
function sendToMainWindow(channel: string, payload: unknown): void {
  const window = getRegisteredMainWindow();
  if (!window || window.isDestroyed()) {
    return;
  }
  window.webContents.send(channel, payload);
}

/**
 * Pushes an SSE state update to the renderer.
 *
 * @param payload - State change for one session.
 */
function pushSseState(payload: SseStatePush): void {
  sendToMainWindow('sse:state', payload);
}

/**
 * Flushes buffered SSE events for a session to the renderer.
 *
 * @param requestId - Client session id.
 */
function flushSseEvents(requestId: string): void {
  const entry = activeSseSessions.get(requestId);
  if (!entry || entry.eventBuffer.length === 0) {
    return;
  }
  const events = entry.eventBuffer.splice(0, entry.eventBuffer.length);
  if (entry.flushTimer != null) {
    clearTimeout(entry.flushTimer);
    entry.flushTimer = null;
  }
  const payload: SseEventPush = { requestId, events };
  sendToMainWindow('sse:event', payload);
}

/**
 * Queues an SSE event and schedules a short batch flush.
 *
 * @param requestId - Client session id.
 * @param event - Parsed SSE event.
 */
function enqueueSseEvent(requestId: string, event: SseEvent): void {
  const entry = activeSseSessions.get(requestId);
  if (!entry) {
    return;
  }
  entry.eventBuffer.push(event);
  if (entry.flushTimer == null) {
    entry.flushTimer = setTimeout(() => {
      flushSseEvents(requestId);
    }, SSE_EVENT_FLUSH_MS);
  }
}

/**
 * Removes an SSE session from the active map and flushes leftover events.
 *
 * @param requestId - Client session id.
 * @param controller - Controller that owned the session (reference check).
 */
function untrackSseSession(requestId: string, controller: AbortController): void {
  const entry = activeSseSessions.get(requestId);
  if (!entry || entry.controller !== controller) {
    return;
  }
  flushSseEvents(requestId);
  if (entry.flushTimer != null) {
    clearTimeout(entry.flushTimer);
  }
  activeSseSessions.delete(requestId);
}

/**
 * Closes every active SSE session (window unload / app quit).
 */
export function closeAllSseSessions(): void {
  for (const [requestId, entry] of activeSseSessions) {
    entry.controller.abort();
    void entry.session?.close();
    untrackSseSession(requestId, entry.controller);
  }
}

/**
 * Registers IPC handlers for HTTP execution, SSE sessions, cancellation, and script sandboxing.
 *
 * @param cookieJar - Cookie jar used to attach and capture cookies on HTTP requests.
 */
export function registerNetworkHandlers(cookieJar: ICookieJar): void {
  initScriptRunnerHost(cookieJar);

  // Sends an HTTP request and captures response cookies in the jar.
  handle('http:send', ipcArgSchemas.sendRequest, async (_event, req, requestId) => {
    const controller = new AbortController();
    if (requestId) {
      trackActiveRequest(requestId, controller);
    }

    try {
      return await executeHttpSend(req, cookieJar, controller.signal);
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

  // Opens an SSE session and streams events/state to the renderer.
  handle('sse:open', ipcArgSchemas.openSseSession, async (_event, input, requestId) => {
    const existing = activeSseSessions.get(requestId);
    if (existing) {
      existing.controller.abort();
      await existing.session?.close();
      untrackSseSession(requestId, existing.controller);
    }

    const controller = new AbortController();
    activeSseSessions.set(requestId, {
      controller,
      session: null,
      eventBuffer: [],
      flushTimer: null
    });

    pushSseState({ requestId, status: 'connecting' });

    let openInfo: SessionOpenInfo | undefined;

    try {
      const session = await openSseSession(
        input,
        {
          onOpen(info) {
            openInfo = info;
            pushSseState({ requestId, status: 'open', openInfo: info });
          },
          onEvent(event) {
            enqueueSseEvent(requestId, event);
          },
          onReconnecting(afterMs, attempt) {
            flushSseEvents(requestId);
            pushSseState({
              requestId,
              status: 'reconnecting',
              ...(openInfo ? { openInfo } : {}),
              reconnect: { afterMs, attempt }
            });
          },
          onClose(info) {
            flushSseEvents(requestId);
            if (info.reason === 'error') {
              pushSseState({
                requestId,
                status: 'error',
                ...(openInfo ? { openInfo } : {}),
                ...(info.error ? { error: info.error } : {})
              });
            } else {
              pushSseState({
                requestId,
                status: 'closed',
                ...(openInfo ? { openInfo } : {}),
                ...(info.error ? { error: info.error } : {})
              });
            }
            untrackSseSession(requestId, controller);
          }
        },
        cookieJar,
        controller.signal
      );

      const entry = activeSseSessions.get(requestId);
      if (entry && entry.controller === controller) {
        entry.session = session;
      } else {
        await session.close();
      }
    } catch (err) {
      pushSseState({
        requestId,
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      });
      untrackSseSession(requestId, controller);
      throw err;
    }
  });

  // Closes an SSE session by client request id.
  handle('sse:close', ipcArgSchemas.closeSseSession, async (_event, requestId) => {
    const entry = activeSseSessions.get(requestId);
    if (!entry) {
      return;
    }
    entry.controller.abort();
    await entry.session?.close();
    // onClose handler performs untrack; ensure cleanup if close is synchronous.
    if (activeSseSessions.get(requestId)?.controller === entry.controller) {
      flushSseEvents(requestId);
      pushSseState({ requestId, status: 'closed' });
      untrackSseSession(requestId, entry.controller);
    }
  });

  // Runs a pre- or post-request script in the SES utilityProcess runner.
  handle('scripts:run', ipcArgSchemas.scriptRun, (_event, input) => runScript(input));

  ipcMain.on(
    'scripts:livePageComplete',
    (_event, message: { requestId: number; ok: boolean; result?: unknown; error?: string }) => {
      getScriptLivePageBridge().complete(message);
    }
  );
}
