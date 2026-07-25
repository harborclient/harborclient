import type { JSX, MouseEvent, ReactNode } from 'react';
import { SidebarColorDot } from './SidebarColorDot.js';
import { SidebarItem, type SidebarItemSortableConfig } from './SidebarItem.js';
import { SidebarMethodBadge } from './SidebarMethodBadge.js';
import { SidebarStatusMarker } from './SidebarStatusMarker.js';
import { SIDEBAR_ITEM_BUTTON_CLASS } from './sidebarItemClasses.js';

interface Props {
  /**
   * HTTP method shown in the leading badge.
   */
  method: string;

  /**
   * Primary label text for the row.
   */
  name: string;

  /**
   * Optional Tailwind classes applied to the name text (e.g. git status colors).
   */
  nameClassName?: string;

  /**
   * Optional color dot configuration for collection sidebar rows.
   */
  colorDot?: {
    color: string | null | undefined;
    visible?: boolean;
    label?: string;
  };

  /**
   * Optional git change status marker shown after the name in git sidebar rows.
   */
  statusMarker?: {
    marker: string;
    className?: string;
    label: string;
  };

  /**
   * Whether this row should use selected/highlighted row styling.
   */
  selected?: boolean;

  /**
   * Optional dnd-kit sortable configuration.
   */
  sortable?: SidebarItemSortableConfig;

  /**
   * Accessible label for the listbox option. When omitted, the name is derived
   * from visible row content (method, name, markers).
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
   * Trailing actions slot, typically a row actions menu.
   */
  actions?: ReactNode;

  /**
   * HTML element for the row container. Use `li` inside {@link SidebarListbox}.
   */
  as?: 'div' | 'li';
}

/**
 * Renders a saved-request sidebar row with method badge, optional color dot or git
 * status marker, and shared row chrome. Used in both Collections and Git sidebars.
 *
 * The accessible name defaults to visible row content (method, name, markers) but
 * can be overridden with `ariaLabel` (e.g. to include git status context).
 *
 * Wrap lists in {@link SidebarListbox} and pass `as="li"` for valid listbox semantics.
 */
export function SidebarRequestItem({
  method,
  name,
  nameClassName,
  colorDot,
  statusMarker,
  selected = false,
  sortable,
  ariaLabel,
  ariaSelected,
  ariaCurrent,
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
              ariaLabel,
              ariaSelected,
              ariaCurrent,
              onClick
            }
          : undefined
      }
    >
      <span className={SIDEBAR_ITEM_BUTTON_CLASS}>
        <SidebarMethodBadge method={method} />
        {colorDot != null ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className={`min-w-0 truncate ${nameClassName ?? ''}`}>{name}</span>
            <SidebarColorDot
              color={colorDot.color}
              visible={colorDot.visible}
              label={colorDot.label}
            />
          </span>
        ) : (
          <span className={`min-w-0 truncate ${nameClassName ?? ''}`}>{name}</span>
        )}
        {statusMarker != null ? (
          <SidebarStatusMarker
            marker={statusMarker.marker}
            className={statusMarker.className}
            label={statusMarker.label}
          />
        ) : null}
      </span>
    </SidebarItem>
  );
}
