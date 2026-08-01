import { useCallback, useMemo } from 'react';
import { useStore } from 'react-redux';
import {
  BUILTIN_ACTIONS,
  pluginActionId,
  type ActionCommandDefinition
} from '@harborclient/core/search/actions';
import {
  DEFAULT_ZOOM_FACTOR,
  MAX_ZOOM_FACTOR,
  MIN_ZOOM_FACTOR,
  roundZoomFactor,
  ZOOM_STEP
} from '@harborclient/core/zoomPresets';
import { usePluginActions } from '#/renderer/src/plugins/pluginHooks';
import { selectThemeFromMenu } from '#/renderer/src/plugins/selectThemeFromMenu';
import { openImageView } from '#/renderer/src/plugins/hostImageCommands';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import type { RootState } from '#/renderer/src/store/redux';
import {
  openAboutModal,
  openAcceptTeamHubInviteModal,
  openCollectionModal,
  openSyncModal,
  openUpdateModal,
  closeActionMenuModal
} from '#/renderer/src/store/slices/modalsSlice';
import {
  toggleAiSidebar,
  toggleConsole,
  toggleGitSidebar,
  toggleRail,
  toggleShortcutsSidebar,
  toggleMcp,
  toggleRequestEditor,
  toggleResponseEditor,
  toggleSidebar,
  toggleTerminal,
  toggleVariables
} from '#/renderer/src/store/slices/navigationSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  dispatchNewRequest,
  hideSidebarsAndFooterPanels,
  importFromMenu,
  runSync,
  saveFromMenu,
  showSidebarsAndFooterPanels
} from '#/renderer/src/store/thunks';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { useSidebarGit } from '#/renderer/src/ui/Sidebars/CollectionSidebar/git/sidebarGitContext';
import { runBrowserNavMenuAction } from '#/renderer/src/ui/Main/RequestEditor/BrowserTab/runBrowserNavMenuAction';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';

interface UseActionCommandsResult {
  /** Built-in and plugin actions available in Action menu quick-open mode. */
  actions: ActionCommandDefinition[];
  /** Closes the palette and runs the action matching the given id. */
  runAction: (id: string) => void;
}

/**
 * Action ids that require an active git-backed collection.
 */
const GIT_COLLECTION_ACTION_IDS = new Set([
  'builtin:git-create-branch',
  'builtin:git-delete-branch',
  'builtin:git-commit',
  'builtin:git-merge',
  'builtin:git-fetch',
  'builtin:git-pull',
  'builtin:git-push'
]);

/**
 * Steps the main-window zoom factor up or down by one View-menu step and persists it.
 *
 * @param direction - `1` zooms in, `-1` zooms out.
 */
async function stepZoom(direction: 1 | -1): Promise<void> {
  const current = await window.api.getZoomFactor();
  const next = roundZoomFactor(current + direction * ZOOM_STEP);
  const clamped = Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, next));
  await window.api.setZoomFactor(clamped);
}

/**
 * Merges built-in menu actions with plugin-registered Action menu contributions and
 * dispatches the matching handler when the user selects a row.
 */
export function useActionCommands(): UseActionCommandsResult {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const pluginActions = usePluginActions();
  const {
    isActiveCollectionGit,
    commitActiveCollection,
    mergeActiveCollection,
    createBranchActiveCollection,
    deleteBranchActiveCollection,
    fetchActiveCollection,
    pullActiveCollection,
    pushActiveCollection
  } = useSidebarGit();
  const {
    setActiveSidebarMode,
    toggleStorageLocationBadges,
    toggleMarkers,
    toggleMethodColors,
    toggleIndicators,
    toggleFilters,
    toggleSorting
  } = useSidebarExpansion();

  /**
   * Built-in menu actions keyed by stable action id.
   */
  const builtinRunners = useMemo(
    (): Record<string, () => void | Promise<void>> => ({
      'builtin:new-request': () => {
        dispatchNewRequest(dispatch);
      },
      'builtin:new-collection': () => {
        dispatch(openCollectionModal({ mode: 'create' }));
      },
      'builtin:new-collection-git': () => {
        dispatch(openCollectionModal({ mode: 'create', tab: 'git' }));
      },
      'builtin:import': () => {
        void dispatch(importFromMenu()).catch((err: unknown) => {
          showAlert(dispatch, formatErrorMessage(err, 'Failed to import'));
        });
      },
      'builtin:save': () => {
        void dispatch(saveFromMenu()).catch((err: unknown) => {
          showAlert(dispatch, formatErrorMessage(err, 'Failed to save'));
        });
      },
      'builtin:settings': () => {
        dispatch(openPageTab({ type: 'settings', section: 'general' }));
      },
      'builtin:git-settings': () => {
        dispatch(openPageTab({ type: 'settings', section: 'git' }));
      },
      'builtin:plugins': () => {
        dispatch(openPageTab({ type: 'plugins' }));
      },
      'builtin:themes': () => {
        dispatch(openPageTab({ type: 'themes' }));
      },
      'builtin:snippets': () => {
        dispatch(openPageTab({ type: 'snippets' }));
      },
      'builtin:cookies': () => {
        dispatch(openPageTab({ type: 'cookies' }));
      },
      'builtin:team-hubs': () => {
        dispatch(openPageTab({ type: 'team-hubs' }));
      },
      'builtin:accept-team-hub-invite': () => {
        dispatch(openAcceptTeamHubInviteModal());
      },
      'builtin:sharing-keys': () => {
        dispatch(openPageTab({ type: 'sharing-keys' }));
      },
      'builtin:getting-started': () => {
        dispatch(openPageTab({ type: 'getting-started' }));
      },
      'builtin:image-logo': () => {
        openImageView({ url: 'https://harborclient.com/images/logo.png' });
      },
      'builtin:join-shared-collection': () => {
        dispatch(openCollectionModal({ mode: 'create', tab: 'join' }));
      },
      'builtin:git-create-branch': () => {
        createBranchActiveCollection();
      },
      'builtin:git-delete-branch': () => {
        deleteBranchActiveCollection();
      },
      'builtin:git-commit': () => {
        commitActiveCollection();
      },
      'builtin:git-merge': () => {
        mergeActiveCollection();
      },
      'builtin:git-fetch': () => {
        void fetchActiveCollection();
      },
      'builtin:git-pull': () => {
        void pullActiveCollection();
      },
      'builtin:git-push': () => {
        void pushActiveCollection();
      },
      'builtin:sync': () => {
        dispatch(openSyncModal());
        void dispatch(runSync()).catch((err: unknown) => {
          showAlert(dispatch, formatErrorMessage(err, 'Failed to sync'));
        });
      },
      'builtin:toggle-sidebar': () => {
        dispatch(toggleSidebar());
      },
      'builtin:toggle-rail': () => {
        dispatch(toggleRail());
      },
      'builtin:hide-sidebars': () => {
        void dispatch(hideSidebarsAndFooterPanels());
      },
      'builtin:show-sidebars': () => {
        void dispatch(showSidebarsAndFooterPanels());
      },
      'builtin:toggle-ai-sidebar': () => {
        dispatch(toggleAiSidebar());
      },
      'builtin:toggle-git-sidebar': () => {
        dispatch(toggleGitSidebar());
      },
      'builtin:toggle-request-editor': () => {
        dispatch(toggleRequestEditor());
      },
      'builtin:toggle-response-editor': () => {
        dispatch(toggleResponseEditor());
      },
      'builtin:toggle-console': () => {
        dispatch(toggleConsole());
      },
      'builtin:toggle-variables': () => {
        dispatch(toggleVariables());
      },
      'builtin:toggle-mcp': () => {
        dispatch(toggleMcp());
      },
      'builtin:toggle-terminal': () => {
        dispatch(toggleTerminal());
      },
      'builtin:toggle-storage-locations': () => {
        toggleStorageLocationBadges();
      },
      'builtin:toggle-color-markers': () => {
        toggleMarkers();
      },
      'builtin:toggle-highlights': () => {
        toggleMethodColors();
      },
      'builtin:toggle-indicators': () => {
        toggleIndicators();
      },
      'builtin:toggle-filters': () => {
        toggleFilters();
      },
      'builtin:toggle-sorting': () => {
        toggleSorting();
      },
      'builtin:toggle-fullscreen': () => {
        void window.api.toggleFullscreenWindow();
      },
      'builtin:zoom-in': () => {
        void stepZoom(1);
      },
      'builtin:zoom-out': () => {
        void stepZoom(-1);
      },
      'builtin:reset-zoom': () => {
        void window.api.setZoomFactor(DEFAULT_ZOOM_FACTOR);
      },
      'builtin:theme-light': () => {
        void selectThemeFromMenu(dispatch, store.getState, 'light', 'Light');
      },
      'builtin:theme-dark': () => {
        void selectThemeFromMenu(dispatch, store.getState, 'dark', 'Dark');
      },
      'builtin:theme-high-contrast': () => {
        void selectThemeFromMenu(dispatch, store.getState, 'high-contrast', 'High contrast');
      },
      'builtin:theme-system': () => {
        void selectThemeFromMenu(dispatch, store.getState, 'system', 'System');
      },
      'builtin:toggle-collections-section': () => {
        setActiveSidebarMode('collections');
      },
      'builtin:toggle-environments-section': () => {
        setActiveSidebarMode('environments');
      },
      'builtin:toggle-run-results-section': () => {
        setActiveSidebarMode('collections');
      },
      'builtin:check-for-updates': () => {
        dispatch(openUpdateModal());
      },
      'builtin:toggle-shortcuts-sidebar': () => {
        dispatch(toggleShortcutsSidebar());
      },
      'builtin:browser-reload': () => {
        runBrowserNavMenuAction('browser-reload', store.getState);
      },
      'builtin:browser-go-back': () => {
        runBrowserNavMenuAction('browser-go-back', store.getState);
      },
      'builtin:browser-go-forward': () => {
        runBrowserNavMenuAction('browser-go-forward', store.getState);
      },
      'builtin:focus-browser-address': () => {
        runBrowserNavMenuAction('focus-browser-address', store.getState);
      },
      'builtin:about': () => {
        dispatch(openAboutModal());
      }
    }),
    [
      commitActiveCollection,
      createBranchActiveCollection,
      deleteBranchActiveCollection,
      dispatch,
      fetchActiveCollection,
      mergeActiveCollection,
      pullActiveCollection,
      pushActiveCollection,
      store,
      setActiveSidebarMode,
      toggleFilters,
      toggleIndicators,
      toggleMarkers,
      toggleMethodColors,
      toggleSorting,
      toggleStorageLocationBadges
    ]
  );

  /**
   * Plugin actions keyed by stable action id.
   */
  const pluginRunners = useMemo((): Record<string, () => void | Promise<void>> => {
    const runners: Record<string, () => void | Promise<void>> = {};
    for (const action of pluginActions) {
      const id = pluginActionId(action.pluginId, action.commandId);
      runners[id] = () => {
        void window.api
          .executePluginAgentCommand(action.pluginId, action.commandId)
          .catch((err: unknown) => {
            showAlert(
              dispatch,
              formatErrorMessage(err, `Plugin action failed: ${action.namespace}: ${action.label}`)
            );
          });
      };
    }
    return runners;
  }, [dispatch, pluginActions]);

  /**
   * Combined built-in and plugin action metadata for suggestion rendering.
   */
  const actions = useMemo((): ActionCommandDefinition[] => {
    const pluginDefinitions = pluginActions.map((action) => ({
      id: pluginActionId(action.pluginId, action.commandId),
      group: action.namespace,
      label: action.label
    }));

    const visibleBuiltinActions = BUILTIN_ACTIONS.filter((action) => {
      if (!GIT_COLLECTION_ACTION_IDS.has(action.id)) {
        return true;
      }
      return isActiveCollectionGit;
    });

    return [...visibleBuiltinActions, ...pluginDefinitions];
  }, [isActiveCollectionGit, pluginActions]);

  /**
   * Closes the Action menu and runs the handler for the selected action id.
   */
  const runAction = useCallback(
    (id: string): void => {
      const runner = builtinRunners[id] ?? pluginRunners[id];
      if (runner == null) {
        return;
      }

      dispatch(closeActionMenuModal());
      void runner();
    },
    [builtinRunners, dispatch, pluginRunners]
  );

  return { actions, runAction };
}
