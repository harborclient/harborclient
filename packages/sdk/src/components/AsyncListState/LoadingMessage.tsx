import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

interface Props extends ComponentPropsWithoutRef<'p'> {
  /**
   * Loading text announced to assistive technologies.
   */
  children?: ReactNode;
}

/**
 * Muted loading label used while async list data is fetched.
 */
export function LoadingMessage({ children = 'Loading…', className, ...props }: Props): JSX.Element {
  return (
    <p
      {...props}
      role="status"
      className={cn('hc-loading-message text-[14px] text-muted', className)}
    >
      {children}
    </p>
  );
}
