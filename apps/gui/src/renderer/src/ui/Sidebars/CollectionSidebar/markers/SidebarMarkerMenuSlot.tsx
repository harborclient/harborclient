import type { MenuItem } from '@harborclient/sdk/components';
import type { JSX, ReactNode } from 'react';
import type { SidebarMarkerTarget } from './sidebarMarkerTypes';
import { useSidebarMarkerMenuItems } from './useSidebarMarkerMenuItems';

interface Props {
  /**
   * Sidebar entity receiving the marker assignment.
   */
  target: SidebarMarkerTarget;

  /**
   * Row actions menu id used to locate the trigger for picker anchoring.
   */
  menuId: string;

  /**
   * Renders row menu groups with marker menu entries appended.
   */
  children: (markerMenuGroups: MenuItem[][]) => ReactNode;
}

/**
 * Render-prop bridge that injects Set color marker / Clear color marker groups into row menus.
 */
export function SidebarMarkerMenuSlot({ target, menuId, children }: Props): JSX.Element {
  const markerMenuGroups = useSidebarMarkerMenuItems({ target, menuId });

  return <>{children(markerMenuGroups)}</>;
}
