import { RowActionsMenu, type MenuItem } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { SidebarMarkerMenuSlot } from '../markers/SidebarMarkerMenuSlot';
import type { SidebarMarkerTarget } from '../markers/sidebarMarkerTypes';

interface Props {
  /**
   * Unique id for this menu instance.
   */
  menuId: string;

  /**
   * Id of the currently open menu, or null when all are closed.
   */
  openMenuId: string | null;

  /**
   * Called when the user opens or closes a menu.
   */
  onOpenChange: (id: string | null) => void;

  /**
   * Base menu groups before marker actions are appended.
   */
  groups: MenuItem[][];

  /**
   * Sidebar entity that receives marker assignments.
   */
  markerTarget: SidebarMarkerTarget;
}

/**
 * Row actions menu with Set color marker / Clear color marker groups appended for sidebar entities.
 */
export function SidebarRowActionsMenu({
  menuId,
  openMenuId,
  onOpenChange,
  groups,
  markerTarget
}: Props): JSX.Element {
  return (
    <div className="shrink-0" data-sidebar-actions={menuId}>
      <SidebarMarkerMenuSlot target={markerTarget} menuId={menuId}>
        {(markerMenuGroups) => (
          <RowActionsMenu
            menuId={menuId}
            openMenuId={openMenuId}
            onOpenChange={onOpenChange}
            groups={[...groups, ...markerMenuGroups]}
          />
        )}
      </SidebarMarkerMenuSlot>
    </div>
  );
}
