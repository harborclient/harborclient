import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

/**
 * One non-editable breadcrumb segment rendered before the trailing editable item.
 */
export interface BreadcrumbSegment {
  /**
   * Visible label for the segment. May be empty when {@link iconOnly} is true.
   */
  label: string;

  /**
   * Optional decorative icon rendered before the label.
   */
  icon?: IconDefinition;

  /**
   * When true, hides the label text and shows only the icon.
   * Callers should set {@link ariaLabel} so the control stays accessible.
   */
  iconOnly?: boolean;

  /**
   * Accessible name when the visible label is empty or icon-only.
   */
  ariaLabel?: string;

  /**
   * Optional stable key; falls back to the segment index when omitted.
   */
  id?: string;

  /**
   * When set, the segment renders as a navigable button.
   */
  onClick?: () => void;
}
