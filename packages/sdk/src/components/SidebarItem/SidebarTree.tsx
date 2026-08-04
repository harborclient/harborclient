import { useLayoutEffect, useRef } from '@harborclient/sdk/react';
import type { FocusEvent, JSX, KeyboardEvent, ReactNode } from 'react';
import { cn } from '../utils.js';
import {
  SIDEBAR_TREE_ITEM_ROLE,
  handleSidebarCompositeContainerKeyDown,
  handleSidebarCompositeFocusIn,
  querySidebarCompositeItems,
  setSidebarCompositeRovingTabIndex
} from './sidebarCompositeNavigation.js';

interface TreeProps {
  /**
   * Tree rows. Each child should be a {@link SidebarFolderItem} with `as="li"`.
   */
  children: ReactNode;

  /**
   * Accessible name for the tree when the section title is not sufficient.
   */
  'aria-label'?: string;

  /**
   * Additional classes merged onto the tree element.
   */
  className?: string;
}

/**
 * Ensures the tree has exactly one Tab stop among its visible treeitems.
 *
 * @param root - Tree element.
 */
function ensureTreeTabStop(root: HTMLElement): void {
  const items = querySidebarCompositeItems(root, SIDEBAR_TREE_ITEM_ROLE);
  if (items.length === 0) {
    return;
  }

  const currentStop = items.findIndex((item) => item.tabIndex === 0);
  if (currentStop >= 0) {
    setSidebarCompositeRovingTabIndex(items, currentStop);
    return;
  }

  const selectedIndex = items.findIndex((item) => item.getAttribute('aria-selected') === 'true');
  setSidebarCompositeRovingTabIndex(items, selectedIndex >= 0 ? selectedIndex : 0);
}

/**
 * Accessible tree container for nested sidebar folder hierarchies.
 *
 * Wrap folder rows rendered with {@link SidebarFolderItem} `as="li"` and
 * `treeItem` so each row exposes `role="treeitem"` with expand/collapse state.
 * ArrowUp/Down/Home/End move the roving Tab stop; ArrowLeft/Right expand,
 * collapse, or move to a parent/child; Shift+F10 / ContextMenu open row actions.
 *
 * @example
 * ```tsx
 * <SidebarTree aria-label="Collections">
 *   <SidebarFolderItem as="li" name="Auth" expanded childrenId="auth-children" />
 *   <SidebarTreeGroup id="auth-children">
 *     <SidebarRequestItem as="li" name="Login" method="POST" />
 *   </SidebarTreeGroup>
 * </SidebarTree>
 * ```
 */
export function SidebarTree({
  children,
  'aria-label': ariaLabel,
  className
}: TreeProps): JSX.Element {
  const treeRef = useRef<HTMLUListElement>(null);

  /**
   * Keeps a single Tab stop when treeitems mount or selection changes without focus.
   */
  useLayoutEffect(() => {
    if (treeRef.current != null) {
      ensureTreeTabStop(treeRef.current);
    }
  });

  /**
   * Moves focus among treeitems and handles expand/collapse keys.
   *
   * @param event - Keydown bubbled from a treeitem or fired on the tree.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    handleSidebarCompositeContainerKeyDown(event, SIDEBAR_TREE_ITEM_ROLE);
  };

  /**
   * Syncs roving tabindex when focus enters a treeitem via pointer or script.
   *
   * @param event - Focusin from inside the tree.
   */
  const handleFocusIn = (event: FocusEvent<HTMLUListElement>): void => {
    handleSidebarCompositeFocusIn(event, SIDEBAR_TREE_ITEM_ROLE);
  };

  return (
    <ul
      ref={treeRef}
      role="tree"
      aria-label={ariaLabel}
      className={cn('m-0 list-none p-0', className)}
      onKeyDown={handleKeyDown}
      onFocusCapture={handleFocusIn}
    >
      {children}
    </ul>
  );
}
