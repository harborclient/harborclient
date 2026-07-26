import { useContext } from 'react';
import {
  SidebarMarkerPickerContext,
  type SidebarMarkerPickerContextValue
} from './sidebarMarkerPickerContext';

/**
 * Returns the shared sidebar marker picker context.
 */
export function useSidebarMarkerPicker(): SidebarMarkerPickerContextValue {
  const context = useContext(SidebarMarkerPickerContext);
  if (context == null) {
    throw new Error('useSidebarMarkerPicker must be used within SidebarMarkerPickerProvider');
  }
  return context;
}
