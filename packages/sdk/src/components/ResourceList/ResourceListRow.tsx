import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

interface Props extends Omit<ComponentPropsWithoutRef<'li'>, 'children'> {
  /**
   * Primary title or name for the resource.
   */
  primary: ReactNode;

  /**
   * Optional secondary line such as a URL or identifier.
   */
  secondary?: ReactNode;

  /**
   * Optional metadata rendered below primary/secondary content, e.g. badges.
   */
  meta?: ReactNode;

  /**
   * Trailing action buttons or menus.
   */
  actions?: ReactNode;

  /**
   * When true, allows primary content and actions to wrap on narrow widths.
   */
  wrap?: boolean;
}

/**
 * Bordered list row with primary text, optional secondary line, metadata, and actions.
 */
export function ResourceListRow({
  primary,
  secondary,
  meta,
  actions,
  wrap = false,
  className,
  ...props
}: Props): JSX.Element {
  return (
    <li
      {...props}
      className={cn(
        'hc-resource-list-row flex items-center justify-between gap-3 rounded-[10px] border border-separator/80 px-4 py-[14px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[background-color,box-shadow] duration-[120ms] ease-out hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.28)]',
        wrap && 'flex-wrap',
        className
      )}
    >
      <div className="hc-resource-list-row-content min-w-0">
        <div className="hc-resource-list-row-primary min-w-0">{primary}</div>
        {secondary != null ? (
          <div className="hc-resource-list-row-secondary truncate text-[14px] text-muted">
            {secondary}
          </div>
        ) : null}
        {meta}
      </div>
      {actions ? (
        <div className="hc-resource-list-row-actions flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </li>
  );
}
