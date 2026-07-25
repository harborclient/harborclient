import type { ComponentPropsWithoutRef, JSX } from 'react';
import { cn } from '../utils.js';

export interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /**
   * Empty-section message without angle brackets; the component wraps the
   * label in `&lt;…&gt;` automatically.
   */
  label: string;
}

/**
 * Muted placeholder for sidebar sections and lists that have no items to show.
 * Spacing such as top margin is left to callers via `className`.
 */
export function EmptySectionLabel({ label, className, ...props }: Props): JSX.Element {
  return (
    <span
      {...props}
      className={cn(
        'hc-empty-section-label mx-auto my-2 w-[90%] rounded-full border border-dashed border-separator py-1 text-center text-[14px] text-muted uppercase',
        className
      )}
    >
      {label}
    </span>
  );
}
