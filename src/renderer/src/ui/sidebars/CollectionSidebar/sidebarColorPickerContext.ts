import { createContext } from 'react';
import type { SidebarColorTarget } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarColorTypes';

/**
 * Shared color picker API exposed to sidebar row menus.
 */
export interface SidebarColorPickerContextValue {
  /**
   * Opens the shared color picker popover beside a menu trigger.
   */
  openColorPicker: (target: SidebarColorTarget, anchorRect: DOMRect) => void;
}

/**
 * React context for the collection sidebar color picker popover.
 */
export const SidebarColorPickerContext = createContext<SidebarColorPickerContextValue | null>(null);
