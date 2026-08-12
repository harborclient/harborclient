import {
  AnchorMenuPanel,
  RowActionsMenu,
  type MenuItem,
  type MenuPosition
} from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { SidebarMarkerMenuSlot } from '../markers/SidebarMarkerMenuSlot';
import type { SidebarMarkerTarget } from '../markers/sidebarMarkerTypes';

interface Props {
  /**
   * Unique id for this menu instance.
   */
  menuId: string;

  /**
   * Id of the currently open row actions menu, if any.
   * Required when {@link presentation} is `row`.
   */
  openMenuId?: string | null;

  /**
   * Called when this row menu opens or closes.
   * Required when {@link presentation} is `row`.
   */
  onOpenChange?: (menuId: string | null) => void;

  /**
   * Base menu groups before marker actions are appended.
   */
  groups: MenuItem[][];

  /**
   * Menu groups appended after marker actions (for example Inspect Element).
   */
  trailingGroups?: MenuItem[][];

  /**
   * Sidebar entity that receives marker assignments.
   */
  markerTarget: SidebarMarkerTarget;

  /**
   * How the menu is presented: hamburger row trigger (`row`) or cursor-anchored
   * host panel (`anchor`). Defaults to `row`.
   */
  presentation?: 'row' | 'anchor';

  /**
   * Host viewport coordinates for the panel when {@link presentation} is `anchor`.
   */
  anchorPosition?: MenuPosition;

  /**
   * Called when an anchored menu dismisses.
   */
  onDismiss?: () => void;
}

/**
 * Row actions menu with Set color marker / Clear color marker groups appended for sidebar entities,
 * followed by optional trailing groups such as Inspect Element.
 *
 * Supports the built-in hamburger trigger (`presentation="row"`) and host-shown
 * cursor-anchored menus for replacement sidebars (`presentation="anchor"`).
 */
export function SidebarRowActionsMenu({
  menuId,
  openMenuId = null,
  onOpenChange,
  groups,
  trailingGroups = [],
  markerTarget,
  presentation = 'row',
  anchorPosition,
  onDismiss
}: Props): JSX.Element {
  return (
    <div className="shrink-0" data-sidebar-actions={menuId}>
      <SidebarMarkerMenuSlot target={markerTarget} menuId={menuId}>
        {(markerMenuGroups) => {
          const allGroups = [...groups, ...markerMenuGroups, ...trailingGroups];
          if (presentation === 'anchor' && anchorPosition != null) {
            return (
              <AnchorMenuPanel
                menuId={menuId}
                groups={allGroups}
                anchor={anchorPosition}
                onDismiss={() => {
                  onDismiss?.();
                }}
              />
            );
          }
          return (
            <RowActionsMenu
              menuId={menuId}
              openMenuId={openMenuId}
              onOpenChange={onOpenChange ?? (() => undefined)}
              groups={allGroups}
              triggerTabIndex={-1}
            />
          );
        }}
      </SidebarMarkerMenuSlot>
    </div>
  );
}
