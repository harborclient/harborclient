import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ComponentPropsWithoutRef, JSX } from 'react';
import { FaIcon } from '../FaIcon/index.js';
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
 * Tailwind classes for a sidebar navigation row.
 */
function sidebarRow(active: boolean): string {
  return active
    ? 'group flex cursor-pointer items-center gap-1 rounded-md bg-selection px-1.5 py-2 app-no-drag'
    : 'group flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-2 hover:bg-selection/60 app-no-drag';
}

/**
 * Narrow sidebar navigation for multi-section pages such as settings overlays.
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
        'hc-page-sidebar flex w-[220px] shrink-0 flex-col gap-1 border-r border-separator bg-sidebar px-2 py-3',
        className
      )}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = selected === item.value;
        const rowClass = item.icon
          ? `hc-page-sidebar-item ${sidebarRow(
              active
            )} w-full gap-2 border-none text-left text-[15px] app-no-drag`
          : `hc-page-sidebar-item ${sidebarRow(
              active
            )} w-full border-none text-left text-[15px] app-no-drag`;

        return (
          <button
            key={item.value}
            type="button"
            className={rowClass}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(item.value)}
          >
            {item.icon ? (
              <FaIcon
                icon={item.icon}
                className={cn(
                  'hc-page-sidebar-item-icon h-[18px] w-[18px] shrink-0',
                  active ? 'text-text' : 'text-muted'
                )}
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
