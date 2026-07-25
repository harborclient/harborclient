import type { JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

export interface Props {
  /**
   * Section heading text or node.
   */
  title: ReactNode;

  /**
   * Helper copy shown below the title.
   */
  description: ReactNode;

  /**
   * Editor and any trailing controls for this section.
   */
  children: ReactNode;

  /**
   * When true, stretches the section to fill remaining vertical space in script tabs.
   */
  fill?: boolean;

  /**
   * Extra classes appended to the outer wrapper.
   */
  className?: string;

  /**
   * Overrides the default title classes (`text-[18px] text-muted`).
   */
  titleClassName?: string;

  /**
   * Optional id on the title span for label associations.
   */
  titleId?: string;
}

/**
 * Shared settings section shell: title, description, and editor content.
 * Used across collection, folder, environment, and globals settings views.
 */
export function FormSection({
  title,
  description,
  children,
  fill = false,
  className,
  titleClassName,
  titleId
}: Props): JSX.Element {
  return (
    <div className={cn('mb-6 flex flex-col gap-1', fill && 'min-h-0 flex-1', className)}>
      <span
        id={titleId}
        className={cn(titleClassName ?? 'text-[18px] text-muted', fill && 'shrink-0')}
      >
        {title}
      </span>
      <p
        className={cn(
          'hc-form-group-description m-0 mb-2 text-[14px] text-muted',
          fill && 'shrink-0'
        )}
      >
        {description}
      </p>
      {children}
    </div>
  );
}
