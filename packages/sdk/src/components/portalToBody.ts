import { createPortal } from '@harborclient/sdk/react-dom';
import type { ReactNode, ReactPortal } from 'react';

/**
 * Portals modal content to document.body so fixed positioning is not clipped by
 * the sidebar or other overflow-hidden plugin webview containers.
 *
 * @param node - Modal element to render.
 * @returns Portal into document.body.
 * @throws When `document` is unavailable (SSR, tests, or misconfigured host).
 */
export function portalToBody(node: ReactNode): ReactPortal {
  if (typeof document === 'undefined') {
    throw new Error('portalToBody requires a DOM document');
  }
  return createPortal(node, document.body);
}
