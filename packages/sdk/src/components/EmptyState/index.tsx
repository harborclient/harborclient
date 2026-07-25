import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

type EmptyStateVariant = 'inline' | 'centered';

interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /**
   * Empty-state message content.
   */
  children: ReactNode;

  /**
   * Layout preset; centered fills available space in panel bodies.
   */
  variant?: EmptyStateVariant;
}

/**
 * Returns layout classes for inline or centered empty placeholders.
 *
 * @returns Tailwind classes for the wrapper.
 */
function variantClasses(variant: EmptyStateVariant): string {
  if (variant === 'centered') {
    return 'flex flex-1 items-center justify-center p-4 text-center text-muted';
  }
  return 'text-muted';
}

/**
 * Placeholder shown when a panel or list has no content to display.
 */
export function EmptyState({
  children,
  variant = 'inline',
  className,
  ...props
}: Props): JSX.Element {
  return (
    <div {...props} className={cn('hc-empty-state', variantClasses(variant), className)}>
      {children}
    </div>
  );
}
