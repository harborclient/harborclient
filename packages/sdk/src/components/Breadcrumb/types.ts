import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

/**
 * One non-editable breadcrumb segment rendered before the trailing editable item.
 */
export interface BreadcrumbSegment {
  /**
   * Visible label for the segment.
   */
  label: string;

  /**
   * Optional decorative icon rendered before the label.
   */
  icon?: IconDefinition;

  /**
   * Optional stable key; falls back to the segment index when omitted.
   */
  id?: string;

  /**
   * When set, the segment renders as a navigable button.
   */
  onClick?: () => void;
}
