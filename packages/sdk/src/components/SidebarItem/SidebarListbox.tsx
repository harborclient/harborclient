import type { JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

interface Props {
  /**
   * Listbox option rows. Each child should be a {@link SidebarItem} with `as="li"`.
   */
  children: ReactNode;

  /**
   * When true, multiple options may be selected at once.
   */
  multiselectable?: boolean;

  /**
   * Accessible name for the listbox when the section title is not sufficient.
   */
  'aria-label'?: string;

  /**
   * Additional classes merged onto the listbox element.
   */
  className?: string;
}

/**
 * Accessible listbox container for flat sidebar item lists.
 *
 * Wrap rows rendered with {@link SidebarItem} `as="li"` and `listboxOption` so
 * each row exposes `role="option"` and `aria-selected` correctly.
 *
 * @example
 * ```tsx
 * <SidebarListbox aria-label="Collections">
 *   <SidebarRequestItem as="li" name="List users" method="GET" />
 * </SidebarListbox>
 * ```
 */
export function SidebarListbox({
  children,
  multiselectable = false,
  'aria-label': ariaLabel,
  className
}: Props): JSX.Element {
  return (
    <ul
      role="listbox"
      aria-multiselectable={multiselectable ? true : undefined}
      aria-label={ariaLabel}
      className={cn('m-0 list-none p-0', className)}
    >
      {children}
    </ul>
  );
}
