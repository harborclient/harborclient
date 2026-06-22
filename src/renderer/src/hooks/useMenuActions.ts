import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  openAboutModal,
  openCollectionModal,
  openSyncModal,
  openUpdateModal
} from '#/renderer/src/store/slices/modalsSlice';
import {
  openCertificates,
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
        case 'certificates':
          dispatch(openCertificates());
          break;
        case 'accept-invite':
          dispatch(openCollectionModal({ mode: 'create', tab: 'invite' }));
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
}
