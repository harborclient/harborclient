import type { KeyboardEvent } from 'react';
import {
  isSidebarRowActionsMenuKey,
  openSidebarRowActionsMenu
} from './sidebarCompositeNavigation.js';

/**
 * Activates a listbox option on Enter or Space, matching native button behavior.
 * Opens the row actions menu on Shift+F10 / ContextMenu when a trigger is present.
 *
 * @param event - Keydown from the option or treeitem.
 * @param onActivate - Called for Enter / Space activation.
 */
export function handleSidebarOptionKeyDown(
  event: KeyboardEvent<HTMLElement>,
  onActivate?: (event: KeyboardEvent<HTMLElement>) => void
): void {
  if (isSidebarRowActionsMenuKey(event)) {
    if (openSidebarRowActionsMenu(event.currentTarget)) {
      event.preventDefault();
    }
    return;
  }

  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  onActivate?.(event);
}
