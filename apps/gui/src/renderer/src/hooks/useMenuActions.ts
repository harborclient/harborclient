import { useEffect } from 'react';
import { useStore } from 'react-redux';
import type { HttpMethod } from '@harborclient/core/types';
import type { MenuActionId } from '@harborclient/core/types/app';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  openAboutModal,
  openAcceptTeamHubInviteModal,
  openAddLiveServerModal,
  openCollectionModal,
  closeLiveServerModal,
  openActionMenuModal,
  openSyncModal,
  openUpdateModal
} from '#/renderer/src/store/slices/modalsSlice';
import {
  selectAiSidebarVisible,
  selectGitSidebarVisible,
  selectShortcutsSidebarVisible,
  selectShowConsole,
  selectShowMcp,
  selectShowRail,
  selectShowRequestEditor,
  selectShowResponseEditor,
  selectShowTerminal,
  selectShowVariables,
  selectSidebarVisible,
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
import {
  activateNextTab,
  activatePreviousTab,
  newBrowserTab,
  openPageTab,
  setActiveDraft
} from '#/renderer/src/store/slices/tabsSlice';
import {
  dispatchNewRequest,
  hideSidebarsAndFooterPanels,
  importFromMenu,
  requestCreateWorkspaceFromOpenTabs,
  runSync,
  saveFromMenu,
  sendRequest,
  showSidebarsAndFooterPanels
} from '#/renderer/src/store/thunks';
import { openAddLivePageModalWithPrefill } from '#/renderer/src/store/thunks/websites';
import { openWorkflowRecordDialog } from '#/renderer/src/store/slices/workflowsSlice';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { selectActiveTab } from '#/renderer/src/store/selectors';
import { isRequestTab } from '#/renderer/src/store/tabs';
import { clearPlayback, stopPlayback } from '#/renderer/src/workflows/workflowPlayback';
import { restoreLastFocusWithoutRing, useLastFocusedElement } from './useLastFocusedElement';
import { focusSkipNavigation } from '#/renderer/src/ui/Shared/SkipNavigation/skipNavigationInitialFocus';
import { focusSidebarSearch } from '#/renderer/src/ui/Sidebars/CollectionSidebar/search/focusSidebarSearch';
import { tryToggleTerminalFind } from '#/renderer/src/ui/Footer/TerminalPanel/terminalFindShortcut';
import { focusRequestUrl } from '#/renderer/src/ui/Main/RequestEditor/Editor/focusRequestUrl';
import { runBrowserNavMenuAction } from '#/renderer/src/ui/Main/RequestEditor/BrowserTab/runBrowserNavMenuAction';
import { focusFirstRequestTab } from '#/renderer/src/ui/Main/RequestEditor/TabBar/focusFirstRequestTab';
import { focusResponseEditor } from '#/renderer/src/ui/Main/ResponseEditor/focusResponseEditor';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { selectThemeFromMenu } from '#/renderer/src/plugins/selectThemeFromMenu';

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
  const railVisible = useAppSelector(selectShowRail);
  const aiSidebarVisible = useAppSelector(selectAiSidebarVisible);
  const gitSidebarVisible = useAppSelector(selectGitSidebarVisible);
  const shortcutsSidebarVisible = useAppSelector(selectShortcutsSidebarVisible);
  const requestEditorVisible = useAppSelector(selectShowRequestEditor);
  const responseEditorVisible = useAppSelector(selectShowResponseEditor);
  const consoleVisible = useAppSelector(selectShowConsole);
  const variablesVisible = useAppSelector(selectShowVariables);
  const mcpVisible = useAppSelector(selectShowMcp);
  const terminalVisible = useAppSelector(selectShowTerminal);
  const lastFocusedRef = useLastFocusedElement();

  /**
   * Keeps the View > Appearance submenu Sidebar checkbox aligned with effective sidebar visibility.
   */
  useEffect(() => {
    void window.api.setMenuSidebarVisible(sidebarVisible);
  }, [sidebarVisible]);

  /**
   * Keeps the View > Appearance submenu Rail checkbox aligned with activity-rail visibility.
   */
  useEffect(() => {
    void window.api.setMenuRailVisible(railVisible);
  }, [railVisible]);

  /**
   * Keeps the View > Appearance submenu AI checkbox aligned with effective AI sidebar visibility.
   */
  useEffect(() => {
    void window.api.setMenuAiSidebarVisible(aiSidebarVisible);
  }, [aiSidebarVisible]);

  /**
   * Keeps the View > Appearance submenu Git checkbox aligned with effective Git sidebar visibility.
   */
  useEffect(() => {
    void window.api.setMenuGitSidebarVisible(gitSidebarVisible);
  }, [gitSidebarVisible]);

  /**
   * Keeps the View > Appearance submenu Request checkbox aligned with request editor visibility.
   */
  useEffect(() => {
    void window.api.setMenuRequestEditorVisible(requestEditorVisible);
  }, [requestEditorVisible]);

  /**
   * Keeps the View > Appearance submenu Response checkbox aligned with response editor visibility.
   */
  useEffect(() => {
    void window.api.setMenuResponseEditorVisible(responseEditorVisible);
  }, [responseEditorVisible]);

  /**
   * Keeps the View > Appearance submenu Shortcuts checkbox aligned with Shortcuts sidebar visibility.
   */
  useEffect(() => {
    void window.api.setMenuShortcutsSidebarOpen(shortcutsSidebarVisible);
  }, [shortcutsSidebarVisible]);

  /**
   * Keeps the View > Appearance submenu Console checkbox aligned with console panel visibility.
   */
  useEffect(() => {
    void window.api.setMenuConsoleVisible(consoleVisible);
  }, [consoleVisible]);

  /**
   * Keeps the View > Appearance submenu Variables checkbox aligned with variables panel visibility.
   */
  useEffect(() => {
    void window.api.setMenuVariablesVisible(variablesVisible);
  }, [variablesVisible]);

  /**
   * Keeps the View > Appearance submenu MCP checkbox aligned with MCP panel visibility.
   */
  useEffect(() => {
    void window.api.setMenuMcpVisible(mcpVisible);
  }, [mcpVisible]);

  /**
   * Keeps the View > Appearance submenu Terminal checkbox aligned with terminal panel visibility.
   */
  useEffect(() => {
    void window.api.setMenuTerminalVisible(terminalVisible);
  }, [terminalVisible]);

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
        case 'new-browser':
          dispatch(openAddLivePageModalWithPrefill());
          break;
        case 'new-live-server':
          dispatch(openAddLiveServerModal());
          break;
        case 'new-workflow':
          stopPlayback();
          clearPlayback();
          dispatch(openWorkflowRecordDialog());
          break;
        case 'new-collection':
          dispatch(openCollectionModal({ mode: 'create' }));
          break;
        case 'new-collection-git':
          dispatch(openCollectionModal({ mode: 'create', tab: 'git' }));
          break;
        case 'import':
          void dispatch(importFromMenu()).catch((err: unknown) => {
            showAlert(dispatch, formatErrorMessage(err, 'Failed to import'));
          });
          break;
        case 'save':
          void dispatch(saveFromMenu()).catch((err: unknown) => {
            showAlert(dispatch, formatErrorMessage(err, 'Failed to save'));
          });
          break;
        case 'settings':
          dispatch(openPageTab({ type: 'settings', section: 'general' }));
          break;
        case 'git-settings':
          dispatch(openPageTab({ type: 'settings', section: 'git' }));
          break;
        case 'plugins':
          dispatch(openPageTab({ type: 'plugins' }));
          break;
        case 'themes':
          dispatch(openPageTab({ type: 'themes' }));
          break;
        case 'snippets':
          dispatch(openPageTab({ type: 'snippets' }));
          break;
        case 'cookies':
          dispatch(openPageTab({ type: 'cookies' }));
          break;
        case 'team-hubs':
          dispatch(openPageTab({ type: 'team-hubs' }));
          break;
        case 'accept-team-hub-invite':
          dispatch(openAcceptTeamHubInviteModal());
          break;
        case 'sharing-keys':
          dispatch(openPageTab({ type: 'sharing-keys' }));
          break;
        case 'getting-started':
          dispatch(openPageTab({ type: 'getting-started' }));
          break;
        case 'documentation':
          dispatch(
            newBrowserTab({
              url: 'https://harborclient.com/getting-started',
              homeUrl: 'https://harborclient.com/getting-started'
            })
          );
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
        case 'toggle-rail':
          dispatch(toggleRail());
          break;
        case 'hide-sidebars':
          void dispatch(hideSidebarsAndFooterPanels());
          break;
        case 'show-sidebars':
          void dispatch(showSidebarsAndFooterPanels());
          break;
        case 'focus-sidebar-search':
          if (!tryToggleTerminalFind()) {
            focusSidebarSearch(dispatch);
          }
          break;
        case 'focus-request-url':
          focusRequestUrl(dispatch);
          break;
        case 'browser-reload':
        case 'browser-go-back':
        case 'browser-go-forward':
        case 'focus-browser-address':
          runBrowserNavMenuAction(action, store.getState);
          break;
        case 'focus-first-request-tab':
          focusFirstRequestTab(dispatch, store.getState);
          break;
        case 'focus-response-editor':
          focusResponseEditor(dispatch);
          break;
        case 'focus-main-nav':
          focusSkipNavigation();
          break;
        case 'toggle-variables':
          dispatch(closeLiveServerModal());
          dispatch(toggleVariables());
          break;
        case 'toggle-console':
          dispatch(closeLiveServerModal());
          dispatch(toggleConsole());
          break;
        case 'toggle-mcp':
          dispatch(closeLiveServerModal());
          dispatch(toggleMcp());
          break;
        case 'toggle-terminal':
          dispatch(closeLiveServerModal());
          dispatch(toggleTerminal());
          break;
        case 'toggle-ai-sidebar':
          dispatch(toggleAiSidebar());
          break;
        case 'toggle-git-sidebar':
          dispatch(toggleGitSidebar());
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
        case 'toggle-shortcuts-sidebar':
          dispatch(toggleShortcutsSidebar());
          break;
        case 'action-menu':
          dispatch(openActionMenuModal());
          break;
        case 'create-workspace':
          void dispatch(requestCreateWorkspaceFromOpenTabs());
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
      void selectThemeFromMenu(dispatch, store.getState, theme, label);
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
