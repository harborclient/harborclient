import { useEffect } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import {
  openAboutModal,
  openCollectionModal,
  openSyncModal,
  openUpdateModal
} from '#/renderer/src/store/slices/modalsSlice';
import {
  openCertificates,
  openServiceHubs,
  openSettings
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
        case 'service-hubs':
          dispatch(openServiceHubs());
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
