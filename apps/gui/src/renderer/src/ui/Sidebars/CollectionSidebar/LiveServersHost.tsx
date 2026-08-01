import { useEffect, type JSX } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import {
  emitPluginLiveServerRequestLog,
  emitPluginLiveServersRunningChanged
} from '#/renderer/src/plugins/pluginLiveServersBus';
import {
  setLiveServerLogSessions,
  setRunningLiveServers
} from '#/renderer/src/store/slices/liveServersSlice';
import {
  refreshLiveServerLogSessions,
  refreshLiveServers,
  refreshRunningLiveServers,
  reloadBrowserTabsForLiveServerOrigin
} from '#/renderer/src/store/thunks/liveServers';

/**
 * Host that keeps live-server Redux state in sync with the main process and
 * reloads matching browser tabs when a watched server detects file changes.
 *
 * Mounted once under the collections sidebar; renders nothing.
 */
export function LiveServersHost(): JSX.Element | null {
  const dispatch = useAppDispatch();

  /**
   * Loads saved/running servers and log sessions on mount; subscribes to push events.
   */
  useEffect(() => {
    void dispatch(refreshLiveServers());
    void dispatch(refreshRunningLiveServers());
    void dispatch(refreshLiveServerLogSessions());

    const unsubscribeChanged = window.api.onLiveServersChanged((running) => {
      dispatch(setRunningLiveServers(running));
      emitPluginLiveServersRunningChanged(running);
    });

    const unsubscribeLogSessions = window.api.onLiveServerLogSessionsChanged((sessions) => {
      dispatch(setLiveServerLogSessions(sessions));
    });

    const unsubscribeRequestLog = window.api.onLiveServerRequestLog((entry) => {
      emitPluginLiveServerRequestLog(entry);
    });

    const unsubscribeFileChanged = window.api.onLiveServerFileChanged((event) => {
      dispatch(reloadBrowserTabsForLiveServerOrigin(event.origin));
    });

    return () => {
      unsubscribeChanged();
      unsubscribeLogSessions();
      unsubscribeRequestLog();
      unsubscribeFileChanged();
    };
  }, [dispatch]);

  return null;
}
