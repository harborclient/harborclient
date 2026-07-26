import { FilterButton } from '@harborclient/sdk/components';
import { useCallback, useRef, useState, type JSX } from 'react';
import { useSidebarExpansion } from '../expansion/useSidebarExpansion';
import { SidebarMarkerFilterMenu } from './SidebarMarkerFilterMenu';

interface Props {
  /**
   * Distinct CSS markers present in the section items.
   */
  markers: readonly string[];

  /**
   * Currently applied marker filter, or null when showing all markers.
   */
  filter: string | null;

  /**
   * Updates the applied marker filter.
   */
  onFilterChange: (marker: string | null) => void;

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
 * Toolbar marker-filter control for flat sidebar sections (Workspaces,
 * Environments). Visible only when filters and marker dots are enabled and the
 * section has at least one colored item. Opens an immediate-apply swatch menu.
 *
 * @param markers - Distinct markers from the section items.
 * @param filter - Applied marker filter, or null for all.
 * @param onFilterChange - Called when the user picks or clears a marker.
 * @param ariaLabel - Accessible name for the trigger.
 * @param title - Tooltip for the trigger.
 */
export function SidebarMarkerFilterButton({
  markers,
  filter,
  onFilterChange,
  ariaLabel,
  title
}: Props): JSX.Element | null {
  const { showMarkers, showFilters } = useSidebarExpansion();
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /**
   * Applies a marker selection from the menu and closes the popover.
   *
   * @param marker - Selected marker, or null for all markers.
   */
  const handleSelect = useCallback(
    (marker: string | null): void => {
      onFilterChange(marker);
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

  if (!showFilters || !showMarkers || markers.length === 0) {
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
        <SidebarMarkerFilterMenu
          anchorRef={triggerRef}
          markers={markers}
          filter={filter}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      ) : null}
    </>
  );
}
