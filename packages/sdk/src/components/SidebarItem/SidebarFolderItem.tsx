import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { SidebarColorDot } from './SidebarColorDot.js';
import { SidebarItem, type SidebarItemSortableConfig } from './SidebarItem.js';
import { stopSortableDragPointerDown } from './stopSortableDragPointerDown.js';

interface Props {
  /**
   * Folder display name.
   */
  name: string;

  /**
   * Whether the folder tree node is expanded.
   */
  expanded: boolean;

  /**
   * Id of the child region controlled by this folder (`SidebarTreeGroup` id).
   */
  childrenId?: string;

  /**
   * 1-based depth in the tree.
   */
  level?: number;

  /**
   * Total siblings at this level.
   */
  setSize?: number;

  /**
   * 1-based position among siblings at this level.
   */
  posInSet?: number;

  /**
   * Accessible label for the treeitem row.
   */
  ariaLabel?: string;

  /**
   * Optional color dot beside the folder name.
   */
  colorDot?: {
    color: string | null | undefined;
    visible?: boolean;
    label?: string;
  };

  /**
   * When true, shows a "Drop here" affordance beside the folder name.
   */
  dropHighlighted?: boolean;

  /**
   * Whether this row should use selected/highlighted row styling.
   */
  selected?: boolean;

  /**
   * dnd-kit sortable configuration for folder reordering.
   */
  sortable: SidebarItemSortableConfig;

  /**
   * Called when the user right-clicks the row container.
   */
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Toggles folder expand/collapse state.
   */
  onToggleExpand: () => void;

  /**
   * Called when the folder name area is activated.
   */
  onNameClick: () => void;

  /**
   * Called when the folder name area is double-clicked.
   */
  onNameDoubleClick?: () => void;

  /**
   * Called when Enter is pressed on the folder name area.
   */
  onNameEnter?: () => void;

  /**
   * Trailing actions slot, typically a row actions menu.
   */
  actions?: ReactNode;

  /**
   * Icons for expand/collapse chevrons.
   */
  expandIcon: IconDefinition;
  collapseIcon: IconDefinition;

  /**
   * HTML element for the row container. Use `li` inside {@link SidebarTree}.
   */
  as?: 'div' | 'li';
}

/**
 * Renders a collection folder row with expand/collapse control, optional color dot,
 * and optional drag-drop highlight affordance.
 *
 * Wrap folder trees in {@link SidebarTree} and pass `as="li"` for valid tree semantics.
 */
export function SidebarFolderItem({
  name,
  expanded,
  childrenId,
  level,
  setSize,
  posInSet,
  ariaLabel,
  colorDot,
  dropHighlighted = false,
  selected = false,
  sortable,
  onContextMenu,
  onToggleExpand,
  onNameClick,
  onNameDoubleClick,
  onNameEnter,
  actions,
  expandIcon,
  collapseIcon,
  as = 'li'
}: Props): JSX.Element {
  const useTreeItem = as === 'li';

  /**
   * Opens folder settings when Enter is pressed on the name area.
   */
  const handleNameKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Enter' || onNameEnter == null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onNameEnter();
  };

  const chevronLabel = expanded ? `Collapse folder "${name}"` : `Expand folder "${name}"`;

  return (
    <SidebarItem
      selected={selected}
      sortable={sortable}
      onContextMenu={onContextMenu}
      actions={actions}
      as={as}
      treeItem={
        useTreeItem
          ? {
              ariaLabel,
              expanded,
              controlsId: childrenId,
              level,
              setSize,
              posInSet,
              onClick: () => onNameClick(),
              onDoubleClick: onNameDoubleClick != null ? () => onNameDoubleClick() : undefined,
              onKeyDown: onNameEnter != null ? handleNameKeyDown : undefined
            }
          : undefined
      }
    >
      <button
        type="button"
        className="app-no-drag inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:text-text"
        onClick={(event) => {
          event.stopPropagation();
          onToggleExpand();
        }}
        onPointerDown={stopSortableDragPointerDown}
        tabIndex={-1}
        aria-label={chevronLabel}
      >
        <FaIcon icon={expanded ? collapseIcon : expandIcon} className="h-2 w-2" />
      </button>
      <span
        className="app-no-drag ml-0.5 min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent py-0 text-left leading-none font-medium text-inherit"
        aria-current={selected ? 'true' : undefined}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {name}
          {colorDot != null ? (
            <SidebarColorDot
              color={colorDot.color}
              visible={colorDot.visible}
              label={colorDot.label}
            />
          ) : null}
        </span>
        {dropHighlighted ? <span className="ml-1.5 font-normal text-info">Drop here</span> : null}
      </span>
    </SidebarItem>
  );
}
