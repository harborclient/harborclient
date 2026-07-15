import { useContext } from 'react';
import { SidebarExpansionContext } from './sidebarExpansionContext';
import type { SidebarExpansionContextValue } from './sidebarExpansionContext';

/**
 * Returns persisted sidebar expansion state and reveal helpers.
 */
export function useSidebarExpansion(): SidebarExpansionContextValue {
  const context = useContext(SidebarExpansionContext);
  if (!context) {
    throw new Error('useSidebarExpansion must be used within SidebarExpansionProvider');
  }
  return context;
}
