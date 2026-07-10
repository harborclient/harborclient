import { useEffect } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { openRunResultByUuid } from '#/renderer/src/store/thunks/runResults';
import {
  setPendingPluginInstall,
  setPendingSnippetInstall,
  setPendingTeamHubJoin
} from '#/renderer/src/store/slices/navigationSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';

/**
 * Subscribes to harborclient:// deep links from the main process and routes
 * supported actions into navigation state.
 */
export function useDeepLinks(): void {
  const dispatch = useAppDispatch();

  /**
   * Wires deep-link events into page tabs and queued marketplace installs.
   */
  useEffect(() => {
    const unsubscribe = window.api.onDeepLink((payload) => {
      if (payload.action === 'install-plugin') {
        dispatch(openPageTab({ type: 'plugins' }));
        dispatch(setPendingPluginInstall(payload.pluginId));
        return;
      }

      if (payload.action === 'install-theme') {
        dispatch(openPageTab({ type: 'themes' }));
        dispatch(setPendingPluginInstall(payload.pluginId));
        return;
      }

      if (payload.action === 'install-snippet') {
        dispatch(openPageTab({ type: 'snippets' }));
        dispatch(setPendingSnippetInstall(payload.pluginId));
        return;
      }

      if (payload.action === 'open-run-results') {
        void dispatch(openRunResultByUuid(payload.uuid));
        return;
      }

      if (payload.action === 'join-team-hub') {
        dispatch(openPageTab({ type: 'team-hubs' }));
        dispatch(
          setPendingTeamHubJoin({
            baseUrl: payload.baseUrl,
            code: payload.code,
            name: payload.name,
            role: payload.role,
            expiresAt: payload.expiresAt,
            hubName: payload.hubName,
            accessSummary: payload.accessSummary
          })
        );
      }
    });

    return unsubscribe;
  }, [dispatch]);
}
