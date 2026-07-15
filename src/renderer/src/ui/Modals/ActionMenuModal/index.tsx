import { useCallback, type JSX } from 'react';
import { portalToBody } from '@harborclient/sdk/components';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeActionMenuModal,
  selectActionMenuModal
} from '#/renderer/src/store/slices/modalsSlice';
import { ActionMenuModalBody } from './ActionMenuModalBody';

/**
 * Global command palette for searching collections, settings, and plugins.
 *
 * Portaled to `document.body` so fixed positioning stays centered on the full
 * viewport when sidebars are open.
 */
export function ActionMenuModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const actionMenu = useAppSelector(selectActionMenuModal);

  /**
   * Closes the Action menu modal.
   */
  const handleClose = useCallback((): void => {
    dispatch(closeActionMenuModal());
  }, [dispatch]);

  if (actionMenu?.open !== true) {
    return null;
  }

  return portalToBody(<ActionMenuModalBody key="action-menu" onClose={handleClose} />);
}
