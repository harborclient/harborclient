import type { ComponentPropsWithoutRef, JSX } from 'react';
import { cn } from '../utils.js';

/**
 * Visual tone for compact circular status indicators.
 */
export type StatusDotVariant = 'success' | 'danger' | 'muted' | 'accent' | 'warning' | 'info';

/**
 * Size preset for the status dot.
 */
export type StatusDotSize = 'sm' | 'md';

interface Props extends Omit<ComponentPropsWithoutRef<'span'>, 'children'> {
  /**
   * Color preset for the dot background.
   */
  variant?: StatusDotVariant;

  /**
   * Screen-reader text describing the status when a visible label is not shown.
   */
  label?: string;

  /**
   * Dot diameter preset. `md` is the default list-row size; `sm` fits compact
   * footer indicators.
   */
  size?: StatusDotSize;

  /**
   * Native tooltip text for hover affordance.
   */
  title?: string;
}

/**
 * Returns the Tailwind background class for the chosen status dot variant.
 *
 * @param variant - Color preset for the dot.
 * @returns Tailwind background color class.
 */
export function statusDotVariantClass(variant: StatusDotVariant): string {
  switch (variant) {
    case 'success':
      return 'bg-success';
    case 'danger':
      return 'bg-danger';
    case 'accent':
      return 'bg-accent';
    case 'warning':
      return 'bg-warning';
    case 'info':
      return 'bg-info';
    case 'muted':
    default:
      return 'bg-muted';
  }
}

/**
 * Returns Tailwind size classes for the chosen dot size preset.
 *
 * @param size - Dot diameter preset.
 * @returns Tailwind width and height classes.
 */
function sizeClasses(size: StatusDotSize): string {
  return size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';
}

/**
 * Renders a small circular status indicator with optional screen-reader text.
 * Use `label` when status is not conveyed by adjacent visible text.
 */
export function StatusDot({
  variant = 'muted',
  label,
  size = 'md',
  title,
  className,
  ...props
}: Props): JSX.Element {
  const hasLabel = label != null && label.length > 0;

  return (
    <span className={cn('inline-flex shrink-0 items-center', className)} title={title} {...props}>
      <span
        className={cn(
          'hc-status-dot inline-block shrink-0 rounded-full',
          sizeClasses(size),
          statusDotVariantClass(variant)
        )}
        aria-hidden="true"
      />
      {hasLabel ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
