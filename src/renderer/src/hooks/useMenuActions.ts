import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  openAboutModal,
  openCollectionModal,
  openSyncModal,
  openUpdateModal
} from '#/renderer/src/store/slices/modalsSlice';
import {
  openSharingKeys,
  openTeamHubs,
  openSettings,
  selectAiSidebarVisible,
  selectSidebarVisible,
  toggleAiSidebar,
  toggleSidebar
} from '#/renderer/src/store/slices/navigationSlice';
import {
  dispatchNewRequest,
  importFromMenu,
  runSync,
  saveFromMenu
} from '#/renderer/src/store/thunks';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/modals/dialogHelpers';
import { executePluginCommand } from '#/renderer/src/plugins/createPluginContext';

/**
 * Subscribes to main-process menu actions and dispatches the matching store updates.
 */
export function useMenuActions(): void {
  const dispatch = useAppDispatch();
  const sidebarVisible = useAppSelector(selectSidebarVisible);
  const aiSidebarVisible = useAppSelector(selectAiSidebarVisible);

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
          dispatch(openSettings());
          break;
        case 'team-hubs':
          dispatch(openTeamHubs());
          break;
        case 'sharing-keys':
          dispatch(openSharingKeys());
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
        case 'toggle-ai-sidebar':
          dispatch(toggleAiSidebar());
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
  }, [dispatch]);

  /**
   * Routes plugin menu command clicks to registered plugin command handlers.
   */
  useEffect(() => {
    const unsubscribe = window.api.onPluginMenuCommand(({ pluginId, command }) => {
      void executePluginCommand(pluginId, command).catch((err: unknown) => {
        showAlert(
          dispatch,
          formatErrorMessage(err, `Plugin command failed: ${pluginId}:${command}`)
        );
      });
    });
    return unsubscribe;
  }, [dispatch]);
}
