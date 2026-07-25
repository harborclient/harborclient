import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

interface Props extends ComponentPropsWithoutRef<'thead'> {
  /**
   * Header or body row content.
   */
  children: ReactNode;
}

/**
 * Table header section wrapper.
 */
export function TableHeader({ children, className, ...props }: Props): JSX.Element {
  return (
    <thead {...props} className={cn('hc-table-header', className)}>
      {children}
    </thead>
  );
}
