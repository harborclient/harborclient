import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

interface Props extends ComponentPropsWithoutRef<'li'> {
  /**
   * Empty-state message content.
   */
  children: ReactNode;
}

/**
 * Inline empty-state row rendered inside a {@link ResourceList}.
 */
export function ResourceListEmptyItem({ children, className, ...props }: Props): JSX.Element {
  return (
    <li {...props} className={cn('hc-resource-list-empty-item text-[14px] text-muted', className)}>
      {children}
    </li>
  );
}
