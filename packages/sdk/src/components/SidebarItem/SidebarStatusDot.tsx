import type { JSX } from 'react';
import { cn } from '../utils.js';

interface Props {
  /**
   * Tailwind background color class for the dot (e.g. from {@link statusDotClass}).
   */
  className: string;

  /**
   * Screen-reader text describing the status when a visible label is not shown.
   */
  srOnlyLabel?: string;

  /**
   * Native tooltip shown on hover. Prefer the same wording as {@link srOnlyLabel}.
   */
  title?: string;
}

/**
 * Renders a small circular status indicator with optional screen-reader text.
 */
export function SidebarStatusDot({ className, srOnlyLabel, title }: Props): JSX.Element {
  return (
    <span className="flex shrink-0 items-center gap-1.5" title={title}>
      <span
        className={cn('inline-block h-2 w-2 shrink-0 rounded-full', className)}
        aria-hidden="true"
      />
      {srOnlyLabel != null ? <span className="sr-only">{srOnlyLabel}</span> : null}
    </span>
  );
}
