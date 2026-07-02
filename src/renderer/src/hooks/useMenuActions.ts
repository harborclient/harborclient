import { useEffect } from 'react';
import { useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  openAboutModal,
  openCollectionModal,
  openSyncModal,
  openUpdateModal
} from '#/renderer/src/store/slices/modalsSlice';
import {
  selectAiSidebarVisible,
  selectSidebarVisible,
  toggleAiSidebar,
  toggleSidebar
} from '#/renderer/src/store/slices/navigationSlice';
import {
  activateNextTab,
  activatePreviousTab,
  openPageTab
} from '#/renderer/src/store/slices/tabsSlice';
import {
  dispatchNewRequest,
  importFromMenu,
  patchGeneralSettings,
  runSync,
  saveFromMenu,
  sendRequest
} from '#/renderer/src/store/thunks';
import type { RootState } from '#/renderer/src/store/redux';
import {
  restoreLastFocusWithoutRing,
  useLastFocusedElement
} from '#/renderer/src/hooks/useLastFocusedElement';
import { focusSidebarSearch } from '#/renderer/src/ui/Sidebar/focusSidebarSearch';
import { formatErrorMessage, showAlert, showConfirm } from '#/renderer/src/ui/modals/dialogHelpers';
import { applyThemePreference } from '#/renderer/src/plugins/themeRuntime';

/**
 * Subscribes to main-process menu actions and dispatches the matching store updates.
 */
export function useMenuActions(): void {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const sidebarVisible = useAppSelector(selectSidebarVisible);
  const aiSidebarVisible = useAppSelector(selectAiSidebarVisible);
  const lastFocusedRef = useLastFocusedElement();

  /**
   * Keeps the View menu Sidebar checkbox aligned with effective sidebar visibility.
   */
  useEffect(() => {
    void window.api.setMenuSidebarVisible(sidebarVisible);
  }, [sidebarVisible]);

  /**
   * Keeps the View menu AI checkbox aligned with effective AI sidebar visibility.
   */
  useEffect(() => {
    void window.api.setMenuAiSidebarVisible(aiSidebarVisible);
  }, [aiSidebarVisible]);

  /**
   * Wires File menu shortcuts to navigation, modal, and thunk actions.
   */
  useEffect(() => {
    const unsubscribe = window.api.onMenuAction((action) => {
      switch (action) {
        case 'new-request':
          dispatchNewRequest(dispatch);
          break;
        case 'new-collection':
          dispatch(openCollectionModal({ mode: 'create' }));
          break;
        case 'import':
          void dispatch(importFromMenu()).catch((err: unknown) => {
            showAlert(dispatch, formatErrorMessage(err, 'Failed to import'));
          });
          break;
        case 'save':
          void dispatch(saveFromMenu()).catch((err: unknown) => {
            showAlert(dispatch, formatErrorMessage(err, 'Failed to save request'));
          });
          break;
        case 'settings':
          dispatch(openPageTab({ type: 'settings', section: 'general' }));
          break;
        case 'plugins':
          dispatch(openPageTab({ type: 'plugins' }));
          break;
        case 'team-hubs':
          dispatch(openPageTab({ type: 'team-hubs' }));
          break;
        case 'sharing-keys':
          dispatch(openPageTab({ type: 'sharing-keys' }));
          break;
        case 'join-shared-collection':
          dispatch(openCollectionModal({ mode: 'create', tab: 'join' }));
          break;
        case 'sync':
          dispatch(openSyncModal());
          void dispatch(runSync()).catch((err: unknown) => {
            showAlert(dispatch, formatErrorMessage(err, 'Failed to sync'));
          });
          break;
        case 'toggle-sidebar':
          dispatch(toggleSidebar());
          break;
        case 'focus-sidebar-search':
          focusSidebarSearch(dispatch);
          break;
        case 'toggle-ai-sidebar':
          dispatch(toggleAiSidebar());
          break;
        case 'send-request':
          void dispatch(sendRequest())
            .catch((err: unknown) => {
              showAlert(dispatch, formatErrorMessage(err, 'Failed to send request'));
            })
            .finally(() => {
              restoreLastFocusWithoutRing(lastFocusedRef);
            });
          break;
        case 'previous-request-tab':
          dispatch(activatePreviousTab());
          break;
        case 'next-request-tab':
          dispatch(activateNextTab());
          break;
        case 'about':
          dispatch(openAboutModal());
          break;
        case 'check-for-updates':
          dispatch(openUpdateModal());
          break;
      }
    });
    return unsubscribe;
  }, [dispatch, lastFocusedRef]);

  /**
   * Handles View menu appearance theme selections with confirmation before switching.
   */
  useEffect(() => {
    const unsubscribe = window.api.onMenuSelectTheme(({ theme, label }) => {
      void (async () => {
        const activeTheme = await window.api.getTheme();
        if (theme === activeTheme) {
          return;
        }

        const warnWhenSwitchingThemes = store.getState().settings.general.warnWhenSwitchingThemes;

        if (warnWhenSwitchingThemes) {
          const result = await showConfirm(dispatch, {
            title: 'Switch theme?',
            message: `Switch appearance to ${label}?`,
            confirmLabel: 'Switch theme',
            checkboxLabel: 'Do not ask again'
          });
          if (!result.confirmed) {
            return;
          }
          if (result.checkboxChecked) {
            await dispatch(patchGeneralSettings({ warnWhenSwitchingThemes: false }));
          }
        }

        try {
          await applyThemePreference(theme);
          await window.api.setTheme(theme);
        } catch (err: unknown) {
          showAlert(dispatch, formatErrorMessage(err, 'Failed to switch theme'));
        }
      })();
    });
    return unsubscribe;
  }, [dispatch, store]);

  /**
   * Routes plugin menu command clicks to registered plugin command handlers.
   */
  useEffect(() => {
    const unsubscribe = window.api.onPluginMenuCommand(({ pluginId, command }) => {
      void window.api.executePluginAgentCommand(pluginId, command).catch((err: unknown) => {
        showAlert(
          dispatch,
          formatErrorMessage(err, `Plugin command failed: ${pluginId}:${command}`)
        );
      });
    });
    return unsubscribe;
  }, [dispatch]);
}
