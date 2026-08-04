import { useLayoutEffect, useRef } from '@harborclient/sdk/react';
import type { FocusEvent, JSX, KeyboardEvent, ReactNode } from 'react';
import { cn } from '../utils.js';
import {
  SIDEBAR_LISTBOX_ITEM_ROLE,
  handleSidebarCompositeContainerKeyDown,
  handleSidebarCompositeFocusIn,
  querySidebarCompositeItems,
  setSidebarCompositeRovingTabIndex
} from './sidebarCompositeNavigation.js';

interface Props {
  /**
   * Listbox option rows. Each child should be a {@link SidebarItem} with `as="li"`.
   */
  children: ReactNode;

  /**
   * When true, multiple options may be selected at once.
   */
  multiselectable?: boolean;

  /**
   * Accessible name for the listbox when the section title is not sufficient.
   */
  'aria-label'?: string;

  /**
   * Additional classes merged onto the listbox element.
   */
  className?: string;
}

/**
 * Ensures the listbox has exactly one Tab stop among its options.
 *
 * @param root - Listbox element.
 */
function ensureListboxTabStop(root: HTMLElement): void {
  const items = querySidebarCompositeItems(root, SIDEBAR_LISTBOX_ITEM_ROLE);
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
 * Accessible listbox container for flat sidebar item lists.
 *
 * Wrap rows rendered with {@link SidebarItem} `as="li"` and `listboxOption` so
 * each row exposes `role="option"` and `aria-selected` correctly. Arrow keys
 * move a single roving Tab stop among options; Shift+F10 / ContextMenu open the
 * focused row's actions menu.
 *
 * @example
 * ```tsx
 * <SidebarListbox aria-label="Collections">
 *   <SidebarRequestItem as="li" name="List users" method="GET" />
 * </SidebarListbox>
 * ```
 */
export function SidebarListbox({
  children,
  multiselectable = false,
  'aria-label': ariaLabel,
  className
}: Props): JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);

  /**
   * Keeps a single Tab stop when options mount or selection changes without focus.
   */
  useLayoutEffect(() => {
    if (listRef.current != null) {
      ensureListboxTabStop(listRef.current);
    }
  });

  /**
   * Moves focus among options and opens row actions from the composite root.
   *
   * @param event - Keydown bubbled from an option or fired on the listbox.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    handleSidebarCompositeContainerKeyDown(event, SIDEBAR_LISTBOX_ITEM_ROLE);
  };

  /**
   * Syncs roving tabindex when focus enters an option via pointer or script.
   *
   * @param event - Focusin from inside the listbox.
   */
  const handleFocusIn = (event: FocusEvent<HTMLUListElement>): void => {
    handleSidebarCompositeFocusIn(event, SIDEBAR_LISTBOX_ITEM_ROLE);
  };

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-multiselectable={multiselectable ? true : undefined}
      aria-label={ariaLabel}
      className={cn('m-0 list-none p-0', className)}
      onKeyDown={handleKeyDown}
      onFocusCapture={handleFocusIn}
    >
      {children}
    </ul>
  );
}
