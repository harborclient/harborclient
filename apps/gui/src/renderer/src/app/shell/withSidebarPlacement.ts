import type { ShellLayoutConfig, SidebarPlacement } from './types';

/**
 * Returns a shell layout with primary and secondary sidebar zones swapped when
 * placement is `right`, so collections (and whatever else sits in primary) move
 * to the right edge of the middle band.
 *
 * @param layout - Base zone → panel id placement.
 * @param placement - `left` keeps the layout; `right` swaps sidebar zones.
 * @returns A new layout config (original arrays are not mutated).
 */
export function withSidebarPlacement(
  layout: ShellLayoutConfig,
  placement: SidebarPlacement
): ShellLayoutConfig {
  if (placement === 'left') {
    return layout;
  }

  return {
    ...layout,
    primarySidebar: layout.secondarySidebar,
    secondarySidebar: layout.primarySidebar
  };
}
