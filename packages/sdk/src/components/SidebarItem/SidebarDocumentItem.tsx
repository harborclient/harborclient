import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faFileLines } from '@fortawesome/free-solid-svg-icons';
import type { JSX, MouseEvent, ReactNode } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { cn } from '../utils.js';
import { SidebarItem } from './SidebarItem.js';
import { SidebarMarkerDot } from './SidebarMarkerDot.js';
import { SidebarStatusMarker } from './SidebarStatusMarker.js';
import { SIDEBAR_ITEM_BUTTON_CLASS } from './sidebarItemClasses.js';

interface Props {
  /**
   * Icon shown before the document name. Defaults to a file-lines icon when omitted.
   */
  icon?: IconDefinition;

  /**
   * Optional Tailwind classes merged onto the leading icon. The icon already
   * includes `pl-1` so its left edge aligns with `SidebarMethodBadge` text on
   * neighboring request rows.
   */
  iconClassName?: string;

  /**
   * Primary label text for the row.
   */
  name: string;

  /**
   * Optional Tailwind classes applied to the name text (e.g. git status markers).
   */
  nameClassName?: string;

  /**
   * Optional marker dot configuration for collection sidebar rows.
   */
  markerDot?: {
    marker: string | null | undefined;
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
   * Accessible label for the listbox option. When omitted, the name is derived
   * from visible row content (name, markers).
   */
  ariaLabel?: string;

  /**
   * Overrides the `aria-selected` state. When omitted, falls back to `selected`.
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
   * Trailing actions slot, typically a row actions menu.
   */
  actions?: ReactNode;

  /**
   * HTML element for the row container. Use `li` inside {@link SidebarListbox}.
   */
  as?: 'div' | 'li';
}

/**
 * Renders a markdown document sidebar row with file icon, optional marker dot or git
 * status marker, and shared row chrome. Used in both Collections and Git sidebars.
 *
 * The accessible name defaults to visible row content (name, markers) but can be
 * overridden with `ariaLabel` (e.g. to include git status context).
 */
export function SidebarDocumentItem({
  icon = faFileLines,
  iconClassName,
  name,
  nameClassName,
  markerDot,
  statusMarker,
  selected = false,
  ariaLabel,
  ariaSelected,
  ariaCurrent,
  onContextMenu,
  onClick,
  onDoubleClick,
  actions,
  as = 'li'
}: Props): JSX.Element {
  const useListboxOption = as === 'li';

  return (
    <SidebarItem
      selected={selected}
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
              onDoubleClick
            }
          : undefined
      }
    >
      <span className={SIDEBAR_ITEM_BUTTON_CLASS}>
        <FaIcon
          icon={icon}
          className={cn('h-3.5 w-3.5 shrink-0 pl-1 text-muted', iconClassName)}
          aria-hidden
        />
        {markerDot != null ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className={`min-w-0 truncate ${nameClassName ?? ''}`}>{name}</span>
            <SidebarMarkerDot
              marker={markerDot.marker}
              visible={markerDot.visible}
              label={markerDot.label}
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
