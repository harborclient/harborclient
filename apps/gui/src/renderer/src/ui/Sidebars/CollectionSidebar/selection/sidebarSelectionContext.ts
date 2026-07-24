import { createContext, useContext } from 'react';

/**
 * Coordinates clearing and reporting selection across collections sidebar sections.
 */
export interface SidebarSelectionContextValue {
  /**
   * Registers a section-specific clear handler invoked by Deselect all.
   *
   * @param key - Stable section registration id.
   * @param clearSelection - Clears that section's local multi-selection.
   * @returns Cleanup function that unregisters the handler.
   */
  registerClearHandler: (key: string, clearSelection: () => void) => () => void;

  /**
   * Reports how many rows are multi-selected in a sidebar section.
   *
   * @param key - Stable section registration id.
   * @param count - Current multi-selection count for the section.
   */
  reportSelectionCount: (key: string, count: number) => void;

  /**
   * Clears all sidebar selection state, including Redux highlights.
   */
  clearAllSelections: () => void;

  /**
   * Whether any sidebar selection state is currently active.
   */
  hasAnySelection: boolean;
}

export const SidebarSelectionContext = createContext<SidebarSelectionContextValue | null>(null);

/**
 * Returns the sidebar selection coordinator when mounted inside its provider.
 *
 * @returns Coordinator value, or null outside the provider.
 */
export function useSidebarSelectionCoordinator(): SidebarSelectionContextValue | null {
  return useContext(SidebarSelectionContext);
}
