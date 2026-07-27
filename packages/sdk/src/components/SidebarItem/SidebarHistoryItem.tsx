import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX, MouseEvent, ReactNode } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { SidebarItem } from './SidebarItem.js';
import { SidebarMethodBadge } from './SidebarMethodBadge.js';
import { SidebarStatusDot } from './SidebarStatusDot.js';
import { SIDEBAR_ITEM_BUTTON_CLASS, statusDotClass } from './sidebarItemClasses.js';

interface Props {
  /**
   * HTTP method shown in the leading badge.
   */
  method: string;

  /**
   * Primary label text for the history entry.
   */
  name: string;

  /**
   * When true, shows a run icon instead of HTTP status metadata.
   */
  isRun?: boolean;

  /**
   * HTTP status code for request history entries.
   */
  status?: number;

  /**
   * HTTP status text for request history entries.
   */
  statusText?: string;

  /**
   * When false, hides the HTTP status indicator even when status is available.
   */
  statusDotVisible?: boolean;

  /**
   * When false, renders the method badge in neutral theme text instead of per-method colors.
   */
  methodColors?: boolean;

  /**
   * Icon shown for run history entries.
   */
  runIcon?: IconDefinition;

  /**
   * Whether this row is part of a multi-selection.
   */
  selected?: boolean;

  /**
   * Tooltip title for the primary label area.
   */
  title?: string;

  /**
   * Accessible label for the listbox option.
   */
  ariaLabel: string;

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

  /**
   * Additional class names merged onto the row container.
   */
  className?: string;
}

/**
 * Renders a request or run history entry row in the Collections sidebar History section.
 */
export function SidebarHistoryItem({
  method,
  name,
  isRun = false,
  status,
  statusText,
  statusDotVisible = true,
  methodColors = true,
  runIcon,
  selected = false,
  title,
  ariaLabel,
  onContextMenu,
  onClick,
  actions,
  as = 'li',
  className
}: Props): JSX.Element {
  const useListboxOption = as === 'li';
  const optionAriaLabel =
    !isRun && status != null && statusText != null
      ? `${ariaLabel}, responded ${status} ${statusText}`
      : ariaLabel;

  return (
    <SidebarItem
      selected={selected}
      onContextMenu={onContextMenu}
      actions={actions}
      as={as}
      className={className}
      listboxOption={
        useListboxOption
          ? {
              ariaLabel: optionAriaLabel,
              onClick
            }
          : undefined
      }
    >
      <span className={`${SIDEBAR_ITEM_BUTTON_CLASS} py-0.5`} title={title}>
        <SidebarMethodBadge method={method} uppercase methodColors={methodColors} />
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <span className="min-w-0 flex-1 truncate text-text">{name}</span>
          {isRun && runIcon != null ? (
            <FaIcon icon={runIcon} className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
          ) : null}
        </span>
        {!isRun && status != null && statusText != null ? (
          <SidebarStatusDot
            className={statusDotClass(status)}
            visible={statusDotVisible}
            title={`${status} ${statusText}`}
            srOnlyLabel={`${status} ${statusText}`}
          />
        ) : null}
      </span>
    </SidebarItem>
  );
}
