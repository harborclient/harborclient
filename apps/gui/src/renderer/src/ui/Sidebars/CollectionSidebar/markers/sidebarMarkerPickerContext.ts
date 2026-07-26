import { createContext } from 'react';
import type { SidebarMarkerTarget } from './sidebarMarkerTypes';

/**
 * Shared marker picker API exposed to sidebar row menus.
 */
export interface SidebarMarkerPickerContextValue {
  /**
   * Opens the shared marker picker popover beside a menu trigger.
   */
  openMarkerPicker: (target: SidebarMarkerTarget, anchorRect: DOMRect) => void;
}

/**
 * React context for the collection sidebar marker picker popover.
 */
export const SidebarMarkerPickerContext = createContext<SidebarMarkerPickerContextValue | null>(
  null
);
