import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectConfirmModal } from '#/renderer/src/store/slices/modalsSlice';
import { ConfirmModalContent } from './ConfirmModalContent';
import type { JSX } from 'react';

/**
 * Confirmation dialog with cancel and confirm actions for destructive or irreversible operations.
 */
export function ConfirmModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const confirmModal = useAppSelector(selectConfirmModal);

  if (!confirmModal) return null;

  const contentKey = `${confirmModal.title}\0${confirmModal.message}\0${confirmModal.confirmLabel}\0${confirmModal.checkboxLabel ?? ''}\0${confirmModal.reconfirm ? '1' : '0'}`;

  return <ConfirmModalContent key={contentKey} confirmModal={confirmModal} dispatch={dispatch} />;
}
