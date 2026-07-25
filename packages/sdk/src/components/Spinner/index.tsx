import type { ComponentPropsWithoutRef, JSX } from 'react';
import { cn } from '../utils.js';

type SpinnerSize = 'sm' | 'md';

interface Props extends Omit<ComponentPropsWithoutRef<'span'>, 'children'> {
  /**
   * Visual size preset for the spinner SVG.
   */
  size?: SpinnerSize;

  /**
   * Accessible label announced while the spinner is visible.
   */
  label?: string;
}

/**
 * Returns width and height classes for the spinner size preset.
 *
 * @returns Tailwind dimension classes.
 */
function sizeClasses(size: SpinnerSize): string {
  return size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
}

/**
 * Accent-colored spinning indicator shared by busy overlays, tabs, and modals.
 */
export function Spinner({ size = 'md', label, className, ...props }: Props): JSX.Element {
  return (
    <span
      {...props}
      className={cn('hc-spinner inline-flex items-center justify-center', className)}
      role={label ? 'status' : undefined}
      aria-label={label}
    >
      <svg
        className={cn('hc-spinner-icon animate-spin text-accent', sizeClasses(size))}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden={label ? true : undefined}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </span>
  );
}
