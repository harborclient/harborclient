import type { KeyboardEvent } from 'react';

/**
 * Activates a listbox option on Enter or Space, matching native button behavior.
 */
export function handleSidebarOptionKeyDown(
  event: KeyboardEvent<HTMLElement>,
  onActivate?: (event: KeyboardEvent<HTMLElement>) => void
): void {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  onActivate?.(event);
}
