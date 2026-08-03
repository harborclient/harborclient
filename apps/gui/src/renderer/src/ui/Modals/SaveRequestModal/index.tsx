import type { JSX } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectSaveRequestModal } from '#/renderer/src/store/slices/modalsSlice';
import { SaveRequestModalBody } from './SaveRequestModalBody';

/**
 * Modal that lets the user pick a collection and optional folder before saving
 * an unsaved request tab. Embeds the Collections sidebar tree in save-target mode.
 */
export function SaveRequestModal(): JSX.Element | null {
  const saveRequestModal = useAppSelector(selectSaveRequestModal);
  if (saveRequestModal == null) {
    return null;
  }

  return <SaveRequestModalBody key={saveRequestModal.tabId} tabId={saveRequestModal.tabId} />;
}
