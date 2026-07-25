import type { ReactNode } from 'react';

export interface TabItem<T extends string> {
  /**
   * Unique tab identifier.
   */
  value: T;

  /**
   * Tab label or custom content.
   */
  label: ReactNode;

  /**
   * When true, the tab is not rendered.
   */
  hidden?: boolean;

  /**
   * When true, the tab button is disabled.
   */
  disabled?: boolean;

  /**
   * When true, shows an accent dot in the reserved indicator slot to the left
   * of the label. The slot stays visible (transparent) when false so tab width
   * stays stable across the group.
   */
  indicator?: boolean;
}
