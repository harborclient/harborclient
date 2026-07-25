import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

/**
 * Visual tone for compact status badges.
 */
export type BadgeVariant = 'success' | 'danger' | 'muted' | 'accent' | 'warning' | 'category';

interface Props extends Omit<ComponentPropsWithoutRef<'span'>, 'children'> {
  /**
   * Badge label content.
   */
  children: ReactNode;

  /**
   * Color and background preset.
   */
  variant?: BadgeVariant;
}

/**
 * Returns background and text classes for the chosen badge variant.
 *
 * @returns Tailwind classes for the badge span.
 */
function variantClasses(variant: BadgeVariant): string {
  switch (variant) {
    case 'success':
      return 'bg-success/20 text-success';
    case 'danger':
      return 'bg-danger/20 text-danger';
    case 'accent':
      return 'bg-accent/20 text-accent';
    case 'warning':
      return 'bg-warning/20 text-warning';
    case 'category':
      return 'bg-accent/15 text-text';
    case 'muted':
    default:
      return 'bg-control text-muted';
  }
}

/**
 * Compact pill badge for status labels in lists and settings panels.
 */
export function Badge({ children, variant = 'muted', className, ...props }: Props): JSX.Element {
  return (
    <span
      {...props}
      className={cn(
        'hc-badge inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[14px]',
        variantClasses(variant),
        className
      )}
    >
      {children}
    </span>
  );
}
