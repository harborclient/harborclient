import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

interface Props extends Omit<ComponentPropsWithoutRef<'p'>, 'children'> {
  /**
   * Status or helper text content.
   */
  children: ReactNode;

  /**
   * When true, exposes the message as a live region for assistive technologies.
   */
  live?: boolean;
}

/**
 * Muted helper or progress text with optional polite live-region semantics.
 */
export function StatusMessage({ children, live = true, className, ...props }: Props): JSX.Element {
  return (
    <p
      {...props}
      className={cn('hc-status-message text-[14px] text-muted', className)}
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
    >
      {children}
    </p>
  );
}
