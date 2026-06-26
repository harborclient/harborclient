import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX, ReactNode } from 'react';
import { FaIcon } from '#/renderer/src/components/FaIcon';

interface Props {
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

  /**
   * Extra classes merged onto the outer header wrapper.
   */
  className?: string;
}

/**
 * Full-bleed page header with a bordered bottom edge, title block on the left,
 * and optional action controls on the right.
 */
export function PageHeader({ title, description, icon, children, className }: Props): JSX.Element {
  const wrapperClassName = className
    ? `-mx-6 mb-4 flex flex-wrap items-center gap-2 border-b border-separator px-6 pb-4 ${className}`
    : '-mx-6 mb-4 flex flex-wrap items-center gap-2 border-b border-separator px-6 pb-4';

  return (
    <div className={wrapperClassName}>
      <div className="min-w-0 flex-1">
        <h2 className="m-0 flex items-center gap-2 text-[17px] font-semibold text-text">
          {icon ? <FaIcon icon={icon} className="h-4 w-4 shrink-0 text-muted" aria-hidden /> : null}
          {title}
        </h2>
        {description ? <p className="m-0 mt-1 text-[14px] text-muted">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
