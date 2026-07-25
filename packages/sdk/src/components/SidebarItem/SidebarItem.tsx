import type { JSX, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { cn } from '../utils.js';
import { SortableSidebarItem } from './SortableSidebarItem.js';
import { sourceRow } from './sidebarItemClasses.js';
import { handleSidebarOptionKeyDown } from './sidebarListOption.js';
import { stopSortableDragPointerDown } from './stopSortableDragPointerDown.js';

/**
 * Sortable drag configuration for a sidebar row.
 */
export interface SidebarItemSortableConfig {
  /**
   * Stable dnd-kit sortable id for this row.
   */
  id: string;

  /**
   * Accessible name for the drag handle.
   */
  dragHandleLabel: string;

  /**
   * When true, renders a static row without drag-and-drop behavior.
   */
  disabled?: boolean;
}

/**
 * Tree item interaction props for a sidebar row rendered inside {@link SidebarTree}.
 */
export interface SidebarItemTreeItem {
  /**
   * Accessible label for the treeitem.
   */
  ariaLabel?: string;

  /**
   * Whether the treeitem is expanded. Omit for leaf nodes.
   */
  expanded?: boolean;

  /**
   * Id of the controlled child region (`SidebarTreeGroup` id).
   */
  controlsId?: string;

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
   * Explicit tab index override. Defaults to `0` when selected, otherwise `-1`.
   */
  tabIndex?: number;

  /**
   * Called when the treeitem is activated via click or keyboard.
   */
  onClick?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Called when the treeitem receives a double-click.
   */
  onDoubleClick?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Additional keyboard handling composed before default Enter/Space activation.
   */
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Listbox option interaction props for a sidebar row rendered inside {@link SidebarListbox}.
 */
export interface SidebarItemListboxOption {
  /**
   * Accessible label for the listbox option. When omitted, the name is derived from visible content.
   */
  ariaLabel?: string;

  /**
   * Overrides the `aria-selected` state. When omitted, falls back to the row's
   * `selected` prop. Use this to decouple selection semantics from highlight
   * styling (e.g. an active row that is not part of a multi-selection).
   */
  ariaSelected?: boolean;

  /**
   * When true, marks the option as the current item with `aria-current="true"`.
   * Use for the single active/current row when it is distinct from selection.
   */
  ariaCurrent?: boolean;

  /**
   * Explicit tab index override. Defaults to `0` when selected, otherwise `-1`.
   */
  tabIndex?: number;

  /**
   * Called when the option is activated via click or keyboard.
   */
  onClick?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Called when the option receives a double-click.
   */
  onDoubleClick?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Additional keyboard handling composed before default Enter/Space activation.
   */
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

interface Props {
  /**
   * Whether this row should use selected/highlighted row styling.
   */
  selected?: boolean;

  /**
   * When true, uses tighter vertical padding for top-level list rows.
   */
  compact?: boolean;

  /**
   * Optional dnd-kit sortable configuration.
   */
  sortable?: SidebarItemSortableConfig;

  /**
   * When set, exposes the row as a listbox option (`role="option"`).
   */
  listboxOption?: SidebarItemListboxOption;

  /**
   * When set, exposes the row as a tree item (`role="treeitem"`).
   */
  treeItem?: SidebarItemTreeItem;

  /**
   * Called when the user right-clicks the row container.
   */
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Trailing actions slot, typically a {@link RowActionsMenu}.
   */
  actions?: ReactNode;

  /**
   * When true, wraps the actions slot with {@link stopSortableDragPointerDown}.
   * Harmless when sortable: drag activation lives on the grip handle, not the row.
   */
  actionsStopDrag?: boolean;

  /**
   * HTML element for the row container when not sortable.
   */
  as?: 'div' | 'li';

  /**
   * Additional class names merged onto the row container.
   */
  className?: string;

  /**
   * Row contents (label button, icons, metadata, etc.).
   */
  children: ReactNode;
}

/**
 * Base shell for sidebar list rows. Applies shared row chrome, optional sortable
 * drag behavior via a leading grip handle, and a trailing actions slot suitable
 * for future Sidebar layout reuse.
 */
export function SidebarItem({
  selected = false,
  compact = true,
  sortable,
  listboxOption,
  treeItem,
  onContextMenu,
  actions,
  actionsStopDrag = true,
  as: Container = 'div',
  className,
  children
}: Props): JSX.Element {
  const rowClassName = cn('hc-sidebar-item', sourceRow(selected, compact), className);

  const rowContent = (
    <>
      {children}
      {actions != null ? (
        <div
          className="shrink-0"
          {...(actionsStopDrag ? { onPointerDown: stopSortableDragPointerDown } : {})}
        >
          {actions}
        </div>
      ) : null}
    </>
  );

  const listboxOptionProps =
    listboxOption != null
      ? {
          role: 'option' as const,
          'aria-selected':
            (listboxOption.ariaSelected ?? selected) ? ('true' as const) : ('false' as const),
          ...(listboxOption.ariaCurrent === true ? { 'aria-current': 'true' as const } : {}),
          ...(listboxOption.ariaLabel != null ? { 'aria-label': listboxOption.ariaLabel } : {}),
          tabIndex: listboxOption.tabIndex ?? (selected ? 0 : -1),
          ...(listboxOption.onClick != null ? { onClick: listboxOption.onClick } : {}),
          ...(listboxOption.onDoubleClick != null
            ? { onDoubleClick: listboxOption.onDoubleClick }
            : {}),
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            listboxOption.onKeyDown?.(event);
            if (event.defaultPrevented) {
              return;
            }
            handleSidebarOptionKeyDown(event, () => {
              listboxOption.onClick?.(event as unknown as MouseEvent<HTMLElement>);
            });
          }
        }
      : {};

  const treeItemProps =
    treeItem != null
      ? {
          role: 'treeitem' as const,
          'aria-selected': selected ? ('true' as const) : ('false' as const),
          ...(treeItem.ariaLabel != null ? { 'aria-label': treeItem.ariaLabel } : {}),
          ...(treeItem.expanded != null
            ? { 'aria-expanded': treeItem.expanded ? ('true' as const) : ('false' as const) }
            : {}),
          ...(treeItem.controlsId != null ? { 'aria-controls': treeItem.controlsId } : {}),
          ...(treeItem.level != null ? { 'aria-level': treeItem.level } : {}),
          ...(treeItem.setSize != null ? { 'aria-setsize': treeItem.setSize } : {}),
          ...(treeItem.posInSet != null ? { 'aria-posinset': treeItem.posInSet } : {}),
          tabIndex: treeItem.tabIndex ?? (selected ? 0 : -1),
          ...(treeItem.onClick != null ? { onClick: treeItem.onClick } : {}),
          ...(treeItem.onDoubleClick != null ? { onDoubleClick: treeItem.onDoubleClick } : {}),
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            treeItem.onKeyDown?.(event);
            if (event.defaultPrevented) {
              return;
            }
            handleSidebarOptionKeyDown(event, () => {
              treeItem.onClick?.(event as unknown as MouseEvent<HTMLElement>);
            });
          }
        }
      : {};

  const interactiveProps = listboxOption != null ? listboxOptionProps : treeItemProps;

  if (sortable != null) {
    return (
      <SortableSidebarItem
        id={sortable.id}
        as={Container}
        className={rowClassName}
        dragHandleLabel={sortable.dragHandleLabel}
        disabled={sortable.disabled}
        onRowContextMenu={onContextMenu}
        {...interactiveProps}
      >
        {rowContent}
      </SortableSidebarItem>
    );
  }

  return (
    <Container className={rowClassName} onContextMenu={onContextMenu} {...interactiveProps}>
      {rowContent}
    </Container>
  );
}
