import type { JSX, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { SidebarColorDot } from './SidebarColorDot.js';
import { SidebarItem, type SidebarItemSortableConfig } from './SidebarItem.js';
import { SIDEBAR_ITEM_BUTTON_CLASS } from './sidebarItemClasses.js';

interface Props {
  /**
   * Environment display name.
   */
  name: string;

  /**
   * Summary text for environment variables (e.g. "3 variables").
   */
  variableSummary: string;

  /**
   * Optional color dot beside the environment name.
   */
  colorDot?: {
    color: string | null | undefined;
    visible?: boolean;
    label?: string;
  };

  /**
   * Whether this row should use selected/highlighted row styling.
   */
  selected?: boolean;

  /**
   * dnd-kit sortable configuration for environment reordering.
   */
  sortable?: SidebarItemSortableConfig;

  /**
   * Accessible label for the listbox option. When omitted, the name is derived
   * from visible row content (name, variable summary).
   */
  ariaLabel?: string;

  /**
   * Overrides the `aria-selected` state. When omitted, falls back to `selected`.
   * Use to decouple selection semantics from highlight styling.
   */
  ariaSelected?: boolean;

  /**
   * When true, marks the row as the current item with `aria-current="true"`.
   */
  ariaCurrent?: boolean;

  /**
   * Called when the user right-clicks the row container.
   */
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Called when the primary label area is activated.
   */
  onClick?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Called when the primary label area is double-clicked.
   */
  onDoubleClick?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Called when Enter is pressed on the primary label area.
   */
  onEnter?: () => void;

  /**
   * Trailing actions slot, typically a row actions menu.
   */
  actions?: ReactNode;

  /**
   * Optional data attribute value for keyboard navigation focus targets.
   */
  dataSidebarEnvironmentId?: string | number;

  /**
   * HTML element for the row container. Use `li` inside {@link SidebarListbox}.
   */
  as?: 'div' | 'li';
}

/**
 * Renders an environment row in the Collections sidebar Environments section.
 *
 * The accessible name is derived from visible row content (name, variable summary).
 */
export function SidebarEnvironmentItem({
  name,
  variableSummary,
  colorDot,
  selected = false,
  sortable,
  ariaLabel,
  ariaSelected,
  ariaCurrent,
  onContextMenu,
  onClick,
  onDoubleClick,
  onEnter,
  actions,
  dataSidebarEnvironmentId,
  as = 'li'
}: Props): JSX.Element {
  const useListboxOption = as === 'li';

  /**
   * Opens environment settings when Enter is pressed on the name area.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Enter' || onEnter == null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onEnter();
  };

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
              ariaLabel,
              ariaSelected,
              ariaCurrent,
              onClick,
              onDoubleClick,
              onKeyDown: onEnter != null ? handleKeyDown : undefined
            }
          : undefined
      }
    >
      <span
        className={SIDEBAR_ITEM_BUTTON_CLASS}
        {...(dataSidebarEnvironmentId != null
          ? { 'data-sidebar-environment-id': String(dataSidebarEnvironmentId) }
          : {})}
      >
        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
          <span className="min-w-0 truncate">{name}</span>
          {colorDot != null ? (
            <SidebarColorDot
              color={colorDot.color}
              visible={colorDot.visible}
              label={colorDot.label}
            />
          ) : null}
        </span>
        <span className="shrink-0 text-muted">{variableSummary}</span>
      </span>
    </SidebarItem>
  );
}
