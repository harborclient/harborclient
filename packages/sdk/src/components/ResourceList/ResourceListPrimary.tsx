import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

interface Props extends ComponentPropsWithoutRef<'div'> {
  /**
   * Primary title content.
   */
  children: ReactNode;
}

/**
 * Primary title styling for {@link ResourceListRow}.
 */
export function ResourceListPrimary({ children, className, ...props }: Props): JSX.Element {
  return (
    <div
      {...props}
      className={cn(
        'hc-resource-list-primary truncate text-[14px] font-medium text-text',
        className
      )}
    >
      {children}
    </div>
  );
}
