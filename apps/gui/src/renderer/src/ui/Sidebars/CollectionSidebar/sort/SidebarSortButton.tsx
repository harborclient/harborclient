import { SortButton, SortMenu } from '@harborclient/sdk/components';
import type { SidebarSectionKey, SidebarSortMode } from '@harborclient/core/types';
import { useCallback, useMemo, useRef, useState, type JSX } from 'react';
import { useSidebarExpansion } from '../expansion/useSidebarExpansion';
import { sidebarSortIcon, sidebarSortOptions } from './sidebarSort';

interface Props {
  /**
   * Built-in sidebar section whose sort preference this control owns.
   */
  sectionKey: SidebarSectionKey;

  /**
   * When true, includes the Marker option (section items have markers and dots
   * are visible).
   */
  hasMarkerOption?: boolean;

  /**
   * When true, includes Method ascending/descending options (Collections section
   * where rows are HTTP requests).
   */
  hasMethodOption?: boolean;

  /**
   * Label prefix for date options. Defaults to "Date created"; Trash uses
   * "Date deleted".
   */
  dateLabel?: string;

  /**
   * Accessible name for the icon-only sort trigger.
   */
  ariaLabel: string;

  /**
   * Native tooltip for the sort trigger.
   */
  title: string;
}

/**
 * Toolbar sort control for a collections sidebar section. Opens a single-select
 * listbox of sort modes and persists the choice via sidebar expansion settings.
 * Hidden when the View menu Sorting preference is off.
 *
 * @param sectionKey - Section whose sort mode to read/write.
 * @param hasMarkerOption - Whether to show the Marker option.
 * @param hasMethodOption - Whether to show Method ascending/descending options.
 * @param dateLabel - Prefix for date sort labels.
 * @param ariaLabel - Accessible name for the trigger.
 * @param title - Tooltip for the trigger.
 */
export function SidebarSortButton({
  sectionKey,
  hasMarkerOption = false,
  hasMethodOption = false,
  dateLabel,
  ariaLabel,
  title
}: Props): JSX.Element | null {
  const { sectionSort, setSectionSort, showMarkers, showSorting } = useSidebarExpansion();
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const value = sectionSort[sectionKey];
  const active = value !== 'default';

  /**
   * Options for the listbox; Marker is omitted when markers are hidden or the
   * section has no marker field. Method options appear only when requested.
   */
  const options = useMemo(
    () => sidebarSortOptions(hasMarkerOption && showMarkers, dateLabel, hasMethodOption),
    [dateLabel, hasMarkerOption, hasMethodOption, showMarkers]
  );

  /**
   * Applies a sort selection from the menu and closes the popover.
   *
   * @param id - Selected sort mode id.
   */
  const handleSelect = useCallback(
    (id: string): void => {
      setSectionSort(sectionKey, id as SidebarSortMode);
      setMenuOpen(false);
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    },
    [sectionKey, setSectionSort]
  );

  /**
   * Closes the sort popover without changing the applied mode.
   */
  const handleClose = useCallback((): void => {
    setMenuOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  if (!showSorting) {
    return null;
  }

  return (
    <>
      <SortButton
        active={active}
        icon={sidebarSortIcon(value)}
        innerRef={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        title={title}
        onClick={() => setMenuOpen((open) => !open)}
      />
      {menuOpen ? (
        <SortMenu
          anchorRef={triggerRef}
          options={options}
          value={value}
          ariaLabel={ariaLabel}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      ) : null}
    </>
  );
}
