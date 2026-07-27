import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ComponentPropsWithoutRef, JSX } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { sourceRow } from '../SidebarItem/sidebarItemClasses.js';
import { cn } from '../utils.js';

/**
 * One entry in a {@link PageSidebar} navigation list.
 */
export interface PageSidebarItem<T extends string = string> {
  /**
   * Stable section identifier passed to `onSelect` when the row is activated.
   */
  value: T;

  /**
   * Visible label for the navigation row.
   */
  label: string;

  /**
   * Optional decorative icon shown before the label.
   */
  icon?: IconDefinition;
}

interface Props<T extends string> extends Omit<
  ComponentPropsWithoutRef<'nav'>,
  'aria-label' | 'onSelect'
> {
  /**
   * Navigation entries to render in the sidebar.
   */
  items: PageSidebarItem<T>[];

  /**
   * Currently selected section value.
   */
  selected: T;

  /**
   * Called when the user selects a different section.
   */
  onSelect: (value: T) => void;

  /**
   * Accessible name for the sidebar `nav` element.
   */
  ariaLabel: string;
}

/**
 * Narrow sidebar navigation for multi-section pages such as settings overlays.
 * Row chrome matches collections sidebar items via {@link sourceRow}.
 */
export function PageSidebar<T extends string>({
  items,
  selected,
  onSelect,
  ariaLabel,
  className,
  ...props
}: Props<T>): JSX.Element {
  return (
    <nav
      {...props}
      className={cn(
        'hc-page-sidebar flex w-[220px] shrink-0 flex-col gap-0 border-r border-separator bg-sidebar px-2 py-3',
        className
      )}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = selected === item.value;

        return (
          <button
            key={item.value}
            type="button"
            className={cn(
              'hc-sidebar-item hc-page-sidebar-item',
              sourceRow(active, true),
              'min-h-[30px] w-full cursor-pointer border-none text-left text-inherit',
              item.icon && 'gap-2'
            )}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(item.value)}
          >
            {item.icon ? (
              <FaIcon
                icon={item.icon}
                className="hc-page-sidebar-item-icon h-3.5 w-3.5 shrink-0 text-muted"
                aria-hidden
              />
            ) : null}
            <span className="hc-page-sidebar-item-label min-w-0 truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
