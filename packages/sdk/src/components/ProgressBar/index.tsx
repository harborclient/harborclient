import type { ComponentPropsWithoutRef, JSX } from 'react';
import { cn } from '../utils.js';
import { progressFillPercent } from './progressBar.logic.js';

export interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /**
   * Current progress count (for example completed items).
   */
  value: number;

  /**
   * Maximum progress count (for example total items).
   */
  max: number;

  /**
   * Accessible name announced for the progress bar.
   */
  label: string;
}

/**
 * Determinate horizontal progress bar with accent fill and width transition.
 */
export function ProgressBar({ value, max, label, className, ...props }: Props): JSX.Element {
  const fillPercent = progressFillPercent(value, max);

  return (
    <div
      {...props}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cn('hc-progress-bar h-2 overflow-hidden rounded-full bg-separator', className)}
    >
      <div
        className="hc-progress-bar-fill h-full rounded-full bg-accent transition-[width] duration-200 motion-reduce:transition-none"
        style={{ width: `${fillPercent}%` }}
      />
    </div>
  );
}
