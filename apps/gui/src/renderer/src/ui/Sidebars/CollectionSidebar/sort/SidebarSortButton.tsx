import { SortButton, SortMenu } from '@harborclient/sdk/components';
import type { SidebarSectionKey, SidebarSortMode } from '@harborclient/core/types';
import { useCallback, useMemo, useRef, useState, type JSX } from 'react';
import { useSidebarExpansion } from '../expansion/useSidebarExpansion';
import { sidebarSortOptions } from './sidebarSort';

interface Props {
  /**
   * Built-in sidebar section whose sort preference this control owns.
   */
  sectionKey: SidebarSectionKey;

  /**
   * When true, includes the Color option (section items have colors and dots
   * are visible).
   */
  hasColorOption?: boolean;

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
 *
 * @param sectionKey - Section whose sort mode to read/write.
 * @param hasColorOption - Whether to show the Color option.
 * @param dateLabel - Prefix for date sort labels.
 * @param ariaLabel - Accessible name for the trigger.
 * @param title - Tooltip for the trigger.
 */
export function SidebarSortButton({
  sectionKey,
  hasColorOption = false,
  dateLabel,
  ariaLabel,
  title
}: Props): JSX.Element {
  const { sectionSort, setSectionSort, showColorDots } = useSidebarExpansion();
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const value = sectionSort[sectionKey];
  const active = value !== 'default';

  /**
   * Options for the listbox; Color is omitted when colors are hidden or the
   * section has no color field.
   */
  const options = useMemo(
    () => sidebarSortOptions(hasColorOption && showColorDots, dateLabel),
    [dateLabel, hasColorOption, showColorDots]
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

  return (
    <>
      <SortButton
        active={active}
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
