import { useCallback, useMemo } from 'react';
import {
  BUILTIN_ACTIONS,
  pluginActionId,
  type ActionCommandDefinition
} from '#/shared/search/actions';
import { usePluginActions } from '#/renderer/src/plugins/pluginHooks';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import {
  openAboutModal,
  openAcceptTeamHubInviteModal,
  openCollectionModal,
  openShortcutsReferenceModal,
  openSyncModal,
  openUpdateModal,
  closeActionMenuModal
} from '#/renderer/src/store/slices/modalsSlice';
import {
  toggleAiSidebar,
  toggleRequestEditor,
  toggleResponseEditor,
  toggleSidebar
} from '#/renderer/src/store/slices/navigationSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  dispatchNewRequest,
  importFromMenu,
  runSync,
  saveFromMenu
} from '#/renderer/src/store/thunks';
import { useSidebarExpansion } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarExpansion';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/modals/dialogHelpers';

interface UseActionCommandsResult {
  /** Built-in and plugin actions available in Action menu quick-open mode. */
  actions: ActionCommandDefinition[];
  /** Closes the palette and runs the action matching the given id. */
  runAction: (id: string) => void;
}

/**
 * Merges built-in menu actions with plugin-registered Action menu contributions and
 * dispatches the matching handler when the user selects a row.
 */
export function useActionCommands(): UseActionCommandsResult {
  const dispatch = useAppDispatch();
  const pluginActions = usePluginActions();
  const {
    toggleCollectionsSectionVisible,
    toggleEnvironmentsSectionVisible,
    toggleRunResultsSectionVisible
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
      'builtin:import': () => {
        void dispatch(importFromMenu()).catch((err: unknown) => {
          showAlert(dispatch, formatErrorMessage(err, 'Failed to import'));
        });
      },
      'builtin:save': () => {
        void dispatch(saveFromMenu()).catch((err: unknown) => {
          showAlert(dispatch, formatErrorMessage(err, 'Failed to save request'));
        });
      },
      'builtin:settings': () => {
        dispatch(openPageTab({ type: 'settings', section: 'general' }));
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
      'builtin:join-shared-collection': () => {
        dispatch(openCollectionModal({ mode: 'create', tab: 'join' }));
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
      'builtin:toggle-ai-sidebar': () => {
        dispatch(toggleAiSidebar());
      },
      'builtin:toggle-request-editor': () => {
        dispatch(toggleRequestEditor());
      },
      'builtin:toggle-response-editor': () => {
        dispatch(toggleResponseEditor());
      },
      'builtin:toggle-collections-section': () => {
        toggleCollectionsSectionVisible();
      },
      'builtin:toggle-environments-section': () => {
        toggleEnvironmentsSectionVisible();
      },
      'builtin:toggle-run-results-section': () => {
        toggleRunResultsSectionVisible();
      },
      'builtin:check-for-updates': () => {
        dispatch(openUpdateModal());
      },
      'builtin:shortcuts-reference': () => {
        dispatch(openShortcutsReferenceModal());
      },
      'builtin:about': () => {
        dispatch(openAboutModal());
      }
    }),
    [
      dispatch,
      toggleCollectionsSectionVisible,
      toggleEnvironmentsSectionVisible,
      toggleRunResultsSectionVisible
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
    return [...BUILTIN_ACTIONS, ...pluginDefinitions];
  }, [pluginActions]);

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
