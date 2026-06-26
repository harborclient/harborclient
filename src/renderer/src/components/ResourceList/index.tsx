import type { JSX, ReactNode } from 'react';

interface ResourceListProps {
  /**
   * List row elements, typically {@link ResourceListRow} items.
   */
  children: ReactNode;

  /**
   * Additional Tailwind classes merged onto the list element.
   */
  className?: string;
}

/**
 * Vertical list shell used for bordered resource rows in settings and Team Hub.
 *
 * @param children - List item elements.
 * @param className - Extra classes appended after the layout preset.
 */
export function ResourceList({ children, className }: ResourceListProps): JSX.Element {
  const base = 'm-0 flex list-none flex-col gap-2 p-0';
  const classes = className ? `${base} ${className}` : base;

  return <ul className={classes}>{children}</ul>;
}

interface ResourceListRowProps {
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

  /**
   * Additional Tailwind classes merged onto the row element.
   */
  className?: string;
}

/**
 * Bordered list row with primary text, optional secondary line, metadata, and actions.
 *
 * @param primary - Main label for the resource.
 * @param secondary - Optional muted secondary line.
 * @param meta - Optional content below the title block.
 * @param actions - Trailing controls aligned to the row end.
 * @param wrap - Whether the row uses flex-wrap for narrow layouts.
 * @param className - Extra classes appended after the layout preset.
 */
export function ResourceListRow({
  primary,
  secondary,
  meta,
  actions,
  wrap = false,
  className
}: ResourceListRowProps): JSX.Element {
  const wrapClass = wrap ? 'flex-wrap' : '';
  const base =
    `flex items-center justify-between gap-3 rounded-md border border-separator px-3 py-2 ${wrapClass}`.trim();
  const classes = className ? `${base} ${className}` : base;

  return (
    <li className={classes}>
      <div className="min-w-0">
        <div className="min-w-0">{primary}</div>
        {secondary != null ? (
          <div className="truncate text-[14px] text-muted">{secondary}</div>
        ) : null}
        {meta}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
      ) : null}
    </li>
  );
}

/**
 * Primary title styling for {@link ResourceListRow}.
 *
 * @param children - Title content.
 */
export function ResourceListPrimary({ children }: { children: ReactNode }): JSX.Element {
  return <div className="truncate text-[14px] font-medium text-text">{children}</div>;
}

/**
 * Inline empty-state row rendered inside a {@link ResourceList}.
 *
 * @param children - Empty message content.
 */
export function ResourceListEmptyItem({ children }: { children: ReactNode }): JSX.Element {
  return <li className="text-[14px] text-muted">{children}</li>;
}
