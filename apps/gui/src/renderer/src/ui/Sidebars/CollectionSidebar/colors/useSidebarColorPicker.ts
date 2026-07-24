import { useContext } from 'react';
import {
  SidebarColorPickerContext,
  type SidebarColorPickerContextValue
} from './sidebarColorPickerContext';

/**
 * Returns the shared sidebar color picker context.
 */
export function useSidebarColorPicker(): SidebarColorPickerContextValue {
  const context = useContext(SidebarColorPickerContext);
  if (context == null) {
    throw new Error('useSidebarColorPicker must be used within SidebarColorPickerProvider');
  }
  return context;
}
