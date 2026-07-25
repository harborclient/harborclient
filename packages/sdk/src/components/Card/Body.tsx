import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

interface Props extends ComponentPropsWithoutRef<'div'> {
  /**
   */
  children: ReactNode;
}

/**
 * Renders the body of a card.
 */
export function Body({ children, className, ...props }: Props): JSX.Element {
  return (
    <div {...props} className={cn('hc-card-body p-4', className)}>
      {children}
    </div>
  );
}
