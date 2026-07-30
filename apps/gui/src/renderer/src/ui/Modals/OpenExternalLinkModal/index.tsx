import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectOpenExternalLinkModal } from '#/renderer/src/store/slices/modalsSlice';
import { OpenExternalLinkModalContent } from './OpenExternalLinkModalContent';
import type { JSX } from 'react';

/**
 * Global confirmation dialog shown before opening an untrusted external URL.
 */
export function OpenExternalLinkModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const modal = useAppSelector(selectOpenExternalLinkModal);

  if (!modal) {
    return null;
  }

  return <OpenExternalLinkModalContent key={modal.url} modal={modal} dispatch={dispatch} />;
}
