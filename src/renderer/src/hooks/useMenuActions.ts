import { useEffect } from 'react';
import { useStore } from 'react-redux';
import type { HttpMethod } from '#/shared/types';
import type { MenuActionId } from '#/shared/types/app';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  openAboutModal,
  openCollectionModal,
  openSearchAnythingModal,
  openShortcutsReferenceModal,
  openSyncModal,
  openUpdateModal
} from '#/renderer/src/store/slices/modalsSlice';
import {
  selectAiSidebarVisible,
  selectShowRequestEditor,
  selectShowResponseEditor,
  selectSidebarVisible,
  toggleAiSidebar,
  toggleRequestEditor,
  toggleResponseEditor,
  toggleSidebar,
  toggleConsole,
  toggleVariables
} from '#/renderer/src/store/slices/navigationSlice';
import {
  activateNextTab,
  activatePreviousTab,
  openPageTab,
  setActiveDraft
} from '#/renderer/src/store/slices/tabsSlice';
import {
  dispatchNewRequest,
  importFromMenu,
  patchGeneralSettings,
  runSync,
  saveFromMenu,
  sendRequest
} from '#/renderer/src/store/thunks';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { selectActiveTab } from '#/renderer/src/store/selectors';
import { isRequestTab } from '#/renderer/src/store/drafts';
import {
  restoreLastFocusWithoutRing,
  useLastFocusedElement
} from '#/renderer/src/hooks/useLastFocusedElement';
import { focusSidebarSearch } from '#/renderer/src/ui/Sidebar/focusSidebarSearch';
import { focusRequestUrl } from '#/renderer/src/ui/Main/RequestEditor/Editor/focusRequestUrl';
import { focusFirstRequestTab } from '#/renderer/src/ui/Main/RequestEditor/TabBar/focusFirstRequestTab';
import { focusResponseEditor } from '#/renderer/src/ui/Main/ResponseEditor/focusResponseEditor';
import { formatErrorMessage, showAlert, showConfirm } from '#/renderer/src/ui/modals/dialogHelpers';
import { applyThemePreference } from '#/renderer/src/plugins/themeRuntime';

/**
 * Maps set-method menu actions to HTTP methods for keyboard shortcuts.
 */
const METHOD_BY_MENU_ACTION: Partial<Record<MenuActionId, HttpMethod>> = {
  'set-method-get': 'GET',
  'set-method-post': 'POST',
  'set-method-put': 'PUT',
  'set-method-patch': 'PATCH',
  'set-method-delete': 'DELETE',
  'set-method-head': 'HEAD',
  'set-method-options': 'OPTIONS'
};

/**
 * Updates the HTTP method on the active request tab when one is focused.
 *
 * @param dispatch - Redux dispatch function.
 * @param getState - Reads current store state for the active tab.
 * @param method - HTTP method to apply.
 */
function applyMethodToActiveRequestTab(
  dispatch: AppDispatch,
  getState: () => RootState,
  method: HttpMethod
): void {
  const tab = selectActiveTab(getState());
  if (tab && isRequestTab(tab)) {
    dispatch(setActiveDraft({ ...tab.draft, method }));
  }
}

/**
 * Subscribes to main-process menu actions and dispatches the matching store updates.
 */
export function useMenuActions(): void {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const sidebarVisible = useAppSelector(selectSidebarVisible);
  const aiSidebarVisible = useAppSelector(selectAiSidebarVisible);
  const requestEditorVisible = useAppSelector(selectShowRequestEditor);
  const responseEditorVisible = useAppSelector(selectShowResponseEditor);
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
   * Keeps the View menu Request checkbox aligned with request editor visibility.
   */
  useEffect(() => {
    void window.api.setMenuRequestEditorVisible(requestEditorVisible);
  }, [requestEditorVisible]);

  /**
   * Keeps the View menu Response checkbox aligned with response editor visibility.
   */
  useEffect(() => {
    void window.api.setMenuResponseEditorVisible(responseEditorVisible);
  }, [responseEditorVisible]);

  /**
   * Wires File menu shortcuts to navigation, modal, and thunk actions.
   */
  useEffect(() => {
    const unsubscribe = window.api.onMenuAction((action) => {
      const method = METHOD_BY_MENU_ACTION[action];
      if (method != null) {
        applyMethodToActiveRequestTab(dispatch, store.getState, method);
        return;
      }

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
        case 'themes':
          dispatch(openPageTab({ type: 'themes' }));
          break;
        case 'cookies':
          dispatch(openPageTab({ type: 'cookies' }));
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
        case 'focus-request-url':
          focusRequestUrl(dispatch);
          break;
        case 'focus-first-request-tab':
          focusFirstRequestTab(dispatch, store.getState);
          break;
        case 'focus-response-editor':
          focusResponseEditor(dispatch);
          break;
        case 'toggle-variables':
          dispatch(toggleVariables());
          break;
        case 'toggle-console':
          dispatch(toggleConsole());
          break;
        case 'toggle-ai-sidebar':
          dispatch(toggleAiSidebar());
          break;
        case 'toggle-request-editor':
          dispatch(toggleRequestEditor());
          break;
        case 'toggle-response-editor':
          dispatch(toggleResponseEditor());
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
        case 'shortcuts-reference':
          dispatch(openShortcutsReferenceModal());
          break;
        case 'search-anything':
          dispatch(openSearchAnythingModal());
          break;
        case 'check-for-updates':
          dispatch(openUpdateModal());
          break;
      }
    });
    return unsubscribe;
  }, [dispatch, lastFocusedRef, store]);

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
