import type { FocusEvent } from 'react';

/** Visible focus ring for focusable shortcuts table cells. */
export const shortcutsTableCellFocusClass =
  'rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]';

/**
 * Scrolls a focused shortcuts table cell into view inside the modal's overflow
 * container so Tab navigation remains usable in long shortcut lists.
 *
 * @param event - Focus event from a shortcuts table data cell.
 */
export function focusShortcutTableCell(event: FocusEvent<HTMLTableCellElement>): void {
  event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
