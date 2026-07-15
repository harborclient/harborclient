import type { MenuItem } from '@harborclient/sdk/components';
import type { JSX, ReactNode } from 'react';
import type { SidebarColorTarget } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarColorTypes';
import { useSidebarColorMenuItems } from '#/renderer/src/ui/Sidebars/CollectionSidebar/useSidebarColorMenuItems';

interface Props {
  /**
   * Sidebar entity receiving the color assignment.
   */
  target: SidebarColorTarget;

  /**
   * Row actions menu id used to locate the trigger for picker anchoring.
   */
  menuId: string;

  /**
   * Renders row menu groups with color menu entries appended.
   */
  children: (colorMenuGroups: MenuItem[][]) => ReactNode;
}

/**
 * Render-prop bridge that injects Set color / Clear color groups into row menus.
 */
export function SidebarColorMenuSlot({ target, menuId, children }: Props): JSX.Element {
  const colorMenuGroups = useSidebarColorMenuItems({ target, menuId });

  return <>{children(colorMenuGroups)}</>;
}
