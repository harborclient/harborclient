import { useCallback, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeShortcutsReferenceModal,
  selectShortcutsReferenceModal
} from '#/renderer/src/store/slices/modalsSlice';
import { ShortcutsReferenceModalBody } from '#/renderer/src/ui/Modals/ShortcutsReferenceModal/ShortcutsReferenceModalBody';

export { SHORTCUTS_REFERENCE_MODAL_ID } from '#/renderer/src/ui/Modals/ShortcutsReferenceModal/ShortcutsReferenceModalBody';

/**
 * Read-only keyboard shortcuts reference with search and a link to shortcut settings.
 */
export function ShortcutsReferenceModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const shortcutsReference = useAppSelector(selectShortcutsReferenceModal);

  /**
   * Closes the shortcuts reference modal.
   */
  const handleClose = useCallback((): void => {
    dispatch(closeShortcutsReferenceModal());
  }, [dispatch]);

  if (shortcutsReference?.open !== true) {
    return null;
  }

  return <ShortcutsReferenceModalBody key="shortcuts-reference" onClose={handleClose} />;
}
