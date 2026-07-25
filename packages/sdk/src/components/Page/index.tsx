import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { PageHeader } from '../PageHeader/index.js';
import { cn } from '../utils.js';

interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'> {
  /**
   * Page heading rendered in the header row.
   */
  title: string;

  /**
   * Optional muted summary shown below the title.
   */
  description?: string;

  /**
   * Optional decorative icon shown before the title.
   */
  icon?: IconDefinition;

  /**
   * Action controls aligned to the right side of the header row, such as close
   * or back buttons.
   */
  actions?: ReactNode;

  /**
   * Optional trailing action row below the body, such as Save/Cancel footers.
   */
  footer?: ReactNode;

  /**
   * When true, omits the scroll container and padding so the page can render
   * inside a parent that already scrolls (for example {@link SidebarLayout}).
   */
  embedded?: boolean;

  /**
   * Additional Tailwind classes merged onto the outer wrapper.
   */
  className?: string;

  /**
   * Main page body content below the header.
   */
  children?: ReactNode;
}

/**
 * Full-area page shell with a {@link PageHeader}, scrollable body, and optional
 * footer. Use the default mode for self-contained overlay pages; set
 * `embedded` when the parent already provides scroll and padding.
 */
export function Page({
  title,
  description,
  icon,
  actions,
  footer,
  embedded = false,
  className,
  children,
  ...props
}: Props): JSX.Element {
  const header = (
    <PageHeader title={title} description={description} icon={icon}>
      {actions}
    </PageHeader>
  );

  if (embedded) {
    return (
      <div {...props} className={cn('hc-page', className)}>
        {header}
        {children}
        {footer}
      </div>
    );
  }

  return (
    <div
      {...props}
      className={cn('hc-page flex min-h-0 flex-1 flex-col overflow-y-auto p-6', className)}
    >
      <div className="hc-page-inner mx-auto w-full">
        {header}
        {children}
        {footer}
      </div>
    </div>
  );
}
