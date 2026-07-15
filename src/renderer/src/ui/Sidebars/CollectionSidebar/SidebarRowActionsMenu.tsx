import { RowActionsMenu, type MenuItem } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { SidebarColorMenuSlot } from '#/renderer/src/ui/Sidebars/CollectionSidebar/SidebarColorMenuSlot';
import type { SidebarColorTarget } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarColorTypes';

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
   * Base menu groups before color actions are appended.
   */
  groups: MenuItem[][];

  /**
   * Sidebar entity that receives color assignments.
   */
  colorTarget: SidebarColorTarget;
}

/**
 * Row actions menu with Set color / Clear color groups appended for sidebar entities.
 */
export function SidebarRowActionsMenu({
  menuId,
  openMenuId,
  onOpenChange,
  groups,
  colorTarget
}: Props): JSX.Element {
  return (
    <div className="shrink-0" data-sidebar-actions={menuId}>
      <SidebarColorMenuSlot target={colorTarget} menuId={menuId}>
        {(colorMenuGroups) => (
          <RowActionsMenu
            menuId={menuId}
            openMenuId={openMenuId}
            onOpenChange={onOpenChange}
            groups={[...groups, ...colorMenuGroups]}
          />
        )}
      </SidebarColorMenuSlot>
    </div>
  );
}
