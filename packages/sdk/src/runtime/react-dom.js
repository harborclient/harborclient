import { requireHostReactDom } from './reactHost.js';

/**
 * Creates a React portal into the host DOM tree.
 *
 * Delegates to the installed host React DOM instance so portals reconcile with
 * the same React copy as {@link @harborclient/sdk/react} hooks.
 *
 * @param {import('react').ReactNode} children - Portal content.
 * @param {Element | DocumentFragment} container - DOM mount target.
 * @param {string | null} [key] - Optional React key for the portal.
 * @returns {import('react').ReactPortal} Portal element.
 */
export function createPortal(children, container, key) {
  return requireHostReactDom().createPortal(children, container, key);
}
