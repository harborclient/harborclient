import { handleSidebarOptionKeyDown, SidebarHistoryItem } from '@harborclient/sdk/components';
import type { RequestHistoryEntry } from '@harborclient/core/types/requestHistory';
import type { JSX, KeyboardEvent, MouseEvent } from 'react';
import { normalizeRequestHistoryEntry } from '#/renderer/src/store/thunks/requestHistory';
import { formatSidebarAbsoluteDate } from '#/renderer/src/ui/Sidebars/CollectionSidebar/History/utils';

interface Props {
  /**
   * Prior history entry shown as a Diff baseline option.
   */
  entry: RequestHistoryEntry;

  /**
   * Called when the user activates this option.
   *
   * @param entry - Selected prior history entry.
   */
  onSelect: (entry: RequestHistoryEntry) => void;
}

/**
 * Builds the accessible label for one Diff history picker row.
 *
 * @param entry - Prior history entry.
 * @returns Screen-reader label describing status and time.
 */
function pickerEntryAriaLabel(entry: RequestHistoryEntry): string {
  const normalized = normalizeRequestHistoryEntry(entry);
  const date = formatSidebarAbsoluteDate(entry.ts);
  return `Compare with ${normalized.name}, status ${entry.status} ${entry.statusText}, ${date}`;
}

/**
 * Listbox option wrapping {@link SidebarHistoryItem} with a visible absolute date
 * under the method/name row for the Compare with history picker.
 */
export function ResponseHistoryDiffPickerItem({ entry, onSelect }: Props): JSX.Element {
  const normalized = normalizeRequestHistoryEntry(entry);
  const absoluteDate = formatSidebarAbsoluteDate(entry.ts);
  const ariaLabel = pickerEntryAriaLabel(entry);

  /**
   * Activates the Diff baseline when the option is clicked.
   *
   * @param event - Mouse click on the option wrapper.
   */
  function handleClick(event: MouseEvent<HTMLDivElement>): void {
    event.preventDefault();
    onSelect(entry);
  }

  /**
   * Activates the Diff baseline on Enter or Space, matching listbox option behavior.
   *
   * @param event - Keyboard event on the option wrapper.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    handleSidebarOptionKeyDown(event, () => {
      onSelect(entry);
    });
  }

  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected="false"
      aria-label={ariaLabel}
      className="group flex cursor-pointer flex-col rounded-md hover:bg-selection/60 focus-visible:bg-selection/60 focus-visible:outline-none"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <SidebarHistoryItem
        method={entry.method}
        name={normalized.name ?? entry.url}
        as="div"
        className="px-4 hover:!bg-transparent"
        status={entry.status}
        statusText={entry.statusText}
        statusDotVisible
        methodColors
        title={`${entry.url} — ${absoluteDate}`}
        ariaLabel={ariaLabel}
      />
      <span className="px-4 pb-1 text-[14px] text-muted" aria-hidden>
        {absoluteDate}
      </span>
    </div>
  );
}
