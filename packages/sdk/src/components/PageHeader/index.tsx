import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { cn } from '../utils.js';

interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /**
   * Page heading rendered as an `h2`.
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
   * Action controls aligned to the right side of the header row.
   */
  children?: ReactNode;
}

/**
 * Full-bleed page header with a bordered bottom edge, title block on the left,
 * and optional action controls on the right.
 */
export function PageHeader({
  title,
  description,
  icon,
  children,
  className,
  ...props
}: Props): JSX.Element {
  return (
    <div
      {...props}
      className={cn(
        'hc-page-header -mx-6 mb-4 flex flex-wrap items-center gap-2 border-b border-separator px-6 py-4',
        className
      )}
    >
      <div className="hc-page-header-content min-w-0 flex-1">
        <h2 className="hc-page-header-title m-0 flex items-center gap-2 text-[22px] leading-[1.15] font-bold tracking-[-0.01em] text-text">
          {icon ? (
            <FaIcon
              icon={icon}
              className="hc-page-header-title-icon h-4 w-4 shrink-0 text-muted"
              aria-hidden
            />
          ) : null}
          {title}
        </h2>
        {description ? (
          <p className="hc-page-header-description m-0 mt-1 leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {children ? (
        <div className="hc-page-header-actions flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
