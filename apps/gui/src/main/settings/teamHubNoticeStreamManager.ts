import {
  isTeamHubNoticeStreamUnsupportedError,
  type NoticeStreamEvent
} from '@harborclient/team-hub-api';
import type { TeamHubNoticeStreamMessage } from '@harborclient/core/types';
import { createTeamHubClient } from '#/main/settings/teamHubClient';
import { listTeamHubs } from '#/main/settings/teamHubSettings';
import { getRegisteredMainWindow } from '#/main/window/mainWindowReveal';

/**
 * Default polling fallback interval while SSE reconnects are in progress.
 */
const NOTICE_STREAM_INITIAL_BACKOFF_MS = 1_000;

/**
 * Maximum delay between notice SSE reconnect attempts.
 */
const NOTICE_STREAM_MAX_BACKOFF_MS = 30_000;

/**
 * Active notice SSE session tracked by {@link syncTeamHubNoticeStreams}.
 */
interface NoticeStreamSession {
  /**
   * Abort controller used to stop the reconnect loop.
   */
  controller: AbortController;

  /**
   * Background task running the reconnect loop.
   */
  task: Promise<void>;
}

const activeSessions = new Map<string, NoticeStreamSession>();

/**
 * Computes exponential backoff for notice SSE reconnect attempts.
 *
 * @param attempt - Zero-based reconnect attempt count.
 * @returns Delay in milliseconds before the next reconnect try.
 */
export function computeNoticeStreamBackoffMs(attempt: number): number {
  return Math.min(NOTICE_STREAM_MAX_BACKOFF_MS, NOTICE_STREAM_INITIAL_BACKOFF_MS * 2 ** attempt);
}

/**
 * Sends a notice stream IPC payload to the renderer when a window is available.
 *
 * @param message - Stream event or reconnect reconciliation payload.
 */
function pushNoticeStreamMessage(message: TeamHubNoticeStreamMessage): void {
  const window = getRegisteredMainWindow();
  if (!window || window.isDestroyed()) {
    return;
  }

  window.webContents.send('teamHub:noticeStream', message);
}

/**
 * Sleeps until the delay elapses or the abort signal fires.
 *
 * @param ms - Delay duration in milliseconds.
 * @param signal - Optional abort signal.
 */
async function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    /**
     * Resolves early when the abort signal fires.
     */
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Reconciles unread counts over REST after an SSE reconnect.
 *
 * @param hubId - Team hub connection id.
 */
async function reconcileUnreadCount(hubId: string): Promise<void> {
  const hub = listTeamHubs().find((entry) => entry.id === hubId);
  if (hub == null || hub.connected === false) {
    return;
  }

  try {
    const client = createTeamHubClient(hub);
    const response = await client.getNoticesUnreadCount();
    pushNoticeStreamMessage({
      hubId,
      kind: 'reconnected',
      unreadCount: response.count
    });
  } catch {
    // Transient disconnects stay silent; polling remains the fallback.
  }
}

/**
 * Runs one notice SSE subscription with reconnect backoff until aborted.
 *
 * @param hubId - Team hub connection id.
 * @param signal - Abort signal used to stop the loop.
 */
async function runNoticeStreamLoop(hubId: string, signal: AbortSignal): Promise<void> {
  let attempt = 0;

  while (!signal.aborted) {
    const hub = listTeamHubs().find((entry) => entry.id === hubId);
    if (hub == null || hub.connected === false) {
      return;
    }

    const client = createTeamHubClient(hub);

    try {
      await client.subscribeNoticeStream(
        {
          onOpen: () => {
            attempt = 0;
            void reconcileUnreadCount(hubId);
          },
          onEvent: (event: NoticeStreamEvent) => {
            pushNoticeStreamMessage({
              hubId,
              kind: 'event',
              event
            });
          }
        },
        signal
      );
    } catch (error) {
      if (signal.aborted) {
        return;
      }

      if (isTeamHubNoticeStreamUnsupportedError(error)) {
        return;
      }
    }

    if (signal.aborted) {
      return;
    }

    attempt += 1;
    await sleepMs(computeNoticeStreamBackoffMs(attempt), signal);
  }
}

/**
 * Stops the notice SSE subscription for one hub, if active.
 *
 * @param hubId - Team hub connection id.
 */
function stopNoticeStream(hubId: string): void {
  const session = activeSessions.get(hubId);
  if (!session) {
    return;
  }

  session.controller.abort();
  activeSessions.delete(hubId);
}

/**
 * Starts a notice SSE subscription for one hub when it is not already active.
 *
 * @param hubId - Team hub connection id.
 */
function startNoticeStream(hubId: string): void {
  if (activeSessions.has(hubId)) {
    return;
  }

  const controller = new AbortController();
  const task = runNoticeStreamLoop(hubId, controller.signal);
  activeSessions.set(hubId, { controller, task });
  void task.finally(() => {
    if (activeSessions.get(hubId)?.controller === controller) {
      activeSessions.delete(hubId);
    }
  });
}

/**
 * Synchronizes main-process notice SSE subscriptions with the renderer's connected hubs.
 *
 * @param hubIds - Hub ids that should maintain notice streams.
 */
export function syncTeamHubNoticeStreams(hubIds: string[]): void {
  const desired = new Set(hubIds);

  for (const hubId of activeSessions.keys()) {
    if (!desired.has(hubId)) {
      stopNoticeStream(hubId);
    }
  }

  for (const hubId of desired) {
    startNoticeStream(hubId);
  }
}

/**
 * Stops every active notice SSE subscription during app shutdown.
 */
export function stopAllTeamHubNoticeStreams(): void {
  for (const hubId of [...activeSessions.keys()]) {
    stopNoticeStream(hubId);
  }
}
