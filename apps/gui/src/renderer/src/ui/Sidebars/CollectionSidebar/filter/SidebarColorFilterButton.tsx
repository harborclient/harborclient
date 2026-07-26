import { FilterButton } from '@harborclient/sdk/components';
import { useCallback, useRef, useState, type JSX } from 'react';
import { useSidebarExpansion } from '../expansion/useSidebarExpansion';
import { SidebarColorFilterMenu } from './SidebarColorFilterMenu';

interface Props {
  /**
   * Distinct CSS colors present in the section items.
   */
  colors: readonly string[];

  /**
   * Currently applied color filter, or null when showing all colors.
   */
  filter: string | null;

  /**
   * Updates the applied color filter.
   */
  onFilterChange: (color: string | null) => void;

  /**
   * Accessible name for the icon-only filter trigger.
   */
  ariaLabel: string;

  /**
   * Native tooltip for the filter trigger.
   */
  title: string;
}

/**
 * Toolbar color-filter control for flat sidebar sections (Tab Groups,
 * Environments). Visible only when color dots are enabled and the section has
 * at least one colored item. Opens an immediate-apply swatch menu.
 *
 * @param colors - Distinct colors from the section items.
 * @param filter - Applied color filter, or null for all.
 * @param onFilterChange - Called when the user picks or clears a color.
 * @param ariaLabel - Accessible name for the trigger.
 * @param title - Tooltip for the trigger.
 */
export function SidebarColorFilterButton({
  colors,
  filter,
  onFilterChange,
  ariaLabel,
  title
}: Props): JSX.Element | null {
  const { showColorDots } = useSidebarExpansion();
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /**
   * Applies a color selection from the menu and closes the popover.
   *
   * @param color - Selected color, or null for all colors.
   */
  const handleSelect = useCallback(
    (color: string | null): void => {
      onFilterChange(color);
      setMenuOpen(false);
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    },
    [onFilterChange]
  );

  /**
   * Closes the filter popover without changing the applied filter.
   */
  const handleClose = useCallback((): void => {
    setMenuOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  if (!showColorDots || colors.length === 0) {
    return null;
  }

  return (
    <>
      <FilterButton
        active={filter != null}
        innerRef={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        title={title}
        onClick={() => setMenuOpen((open) => !open)}
      />
      {menuOpen ? (
        <SidebarColorFilterMenu
          anchorRef={triggerRef}
          colors={colors}
          filter={filter}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      ) : null}
    </>
  );
}
