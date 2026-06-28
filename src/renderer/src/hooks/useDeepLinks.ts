import { useEffect } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { openSettings, setPendingPluginInstall } from '#/renderer/src/store/slices/navigationSlice';

/**
 * Subscribes to harborclient:// deep links from the main process and routes
 * supported actions into navigation state.
 */
export function useDeepLinks(): void {
  const dispatch = useAppDispatch();

  /**
   * Wires deep-link events into settings navigation and queued plugin installs.
   */
  useEffect(() => {
    const unsubscribe = window.api.onDeepLink((payload) => {
      if (payload.action === 'install-plugin') {
        dispatch(openSettings('plugins'));
        dispatch(setPendingPluginInstall(payload.pluginId));
      }
    });

    return unsubscribe;
  }, [dispatch]);
}
