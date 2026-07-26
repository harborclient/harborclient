import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX, MouseEvent, ReactNode } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { SidebarItem, type SidebarItemSortableConfig } from './SidebarItem.js';
import { SidebarMarkerDot } from './SidebarMarkerDot.js';
import { SIDEBAR_ITEM_BUTTON_CLASS } from './sidebarItemClasses.js';

interface Props {
  /**
   * Workspace display name.
   */
  name: string;

  /**
   * Summary text for tab count (e.g. "3 tabs").
   */
  summary: string;

  /**
   * Icon shown before the workspace name.
   */
  icon: IconDefinition;

  /**
   * Optional marker dot beside the workspace name.
   */
  markerDot?: {
    marker: string | null | undefined;
    visible?: boolean;
    label?: string;
  };

  /**
   * Whether this row is part of a multi-selection.
   */
  selected?: boolean;

  /**
   * dnd-kit sortable configuration for workspace reordering.
   */
  sortable?: SidebarItemSortableConfig;

  /**
   * Called when the user right-clicks the row container.
   */
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Called when the primary row area is activated.
   */
  onClick?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Trailing actions slot, typically a row actions menu.
   */
  actions?: ReactNode;

  /**
   * HTML element for the row container. Use `li` inside {@link SidebarListbox}.
   */
  as?: 'div' | 'li';
}

/**
 * Renders a workspace row in the Collections sidebar Workspaces section.
 */
export function SidebarWorkspaceItem({
  name,
  summary,
  icon,
  markerDot,
  selected = false,
  sortable,
  onContextMenu,
  onClick,
  actions,
  as = 'li'
}: Props): JSX.Element {
  const useListboxOption = as === 'li';

  return (
    <SidebarItem
      selected={selected}
      sortable={sortable}
      onContextMenu={onContextMenu}
      actions={actions}
      as={as}
      listboxOption={
        useListboxOption
          ? {
              onClick
            }
          : undefined
      }
    >
      <span className={`${SIDEBAR_ITEM_BUTTON_CLASS} gap-2 rounded-md px-2 py-1`}>
        <FaIcon icon={icon} className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
          <span className="min-w-0 truncate">{name}</span>
          {markerDot != null ? (
            <SidebarMarkerDot
              marker={markerDot.marker}
              visible={markerDot.visible}
              label={markerDot.label}
            />
          ) : null}
        </span>
        <span className="shrink-0 text-muted">{summary}</span>
      </span>
    </SidebarItem>
  );
}
