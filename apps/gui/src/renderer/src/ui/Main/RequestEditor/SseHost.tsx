import { useEffect, type JSX } from 'react';
import type { SseSessionState } from '#/renderer/src/store/tabs';
import { isRequestTab } from '#/renderer/src/store/tabs';
import { useAppDispatch, useAppStore } from '#/renderer/src/store/hooks';
import {
  appendSseEvents,
  setSseSessionState,
  updateTab
} from '#/renderer/src/store/slices/tabsSlice';

/**
 * Subscribes to main-process SSE push events and maps them onto request tabs
 * via {@link RequestTab.sendingRequestId}.
 *
 * Mounted once under the collections sidebar next to {@link LiveServersHost};
 * renders nothing.
 */
export function SseHost(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const store = useAppStore();

  /**
   * Registers SSE event/state listeners for the lifetime of the host.
   */
  useEffect(() => {
    /**
     * Finds the request tab that owns an in-flight SSE `requestId`.
     *
     * @param requestId - Client id passed to {@link window.api.openSseSession}.
     * @returns Matching request tab, or undefined when none is active.
     */
    const findTabForRequestId = (
      requestId: string
    ): ReturnType<typeof store.getState>['tabs']['tabs'][number] | undefined => {
      return store
        .getState()
        .tabs.tabs.find((tab) => isRequestTab(tab) && tab.sendingRequestId === requestId);
    };

    const unsubscribeEvents = window.api.onSseEvent((payload) => {
      const tab = findTabForRequestId(payload.requestId);
      if (!tab || !isRequestTab(tab)) {
        return;
      }
      dispatch(appendSseEvents({ tabId: tab.tabId, events: payload.events }));
    });

    const unsubscribeState = window.api.onSseState((payload) => {
      const tab = findTabForRequestId(payload.requestId);
      if (!tab || !isRequestTab(tab)) {
        return;
      }

      const previous = tab.sseSession;
      const terminal = payload.status === 'closed' || payload.status === 'error';
      const next: SseSessionState = {
        status: payload.status,
        events: previous?.events ?? [],
        droppedCount: previous?.droppedCount ?? 0,
        openedAt: previous?.openedAt ?? Date.now(),
        openInfo: payload.openInfo ?? previous?.openInfo,
        ...(payload.error
          ? { error: payload.error }
          : previous?.error
            ? { error: previous.error }
            : {}),
        ...(payload.reconnect ? { reconnect: payload.reconnect } : {}),
        ...(terminal ? { closedAt: Date.now() } : {})
      };

      dispatch(setSseSessionState({ tabId: tab.tabId, sseSession: next }));

      if (terminal) {
        dispatch(
          updateTab({
            tabId: tab.tabId,
            updates: { sending: false, sendingRequestId: null }
          })
        );
      }
    });

    return () => {
      unsubscribeEvents();
      unsubscribeState();
    };
  }, [dispatch, store]);

  return null;
}
