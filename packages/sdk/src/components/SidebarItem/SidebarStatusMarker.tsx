import type { JSX } from 'react';
import { cn } from '../utils.js';

interface Props {
  /**
   * Bracket marker text (e.g. A, M, D, C).
   */
  marker: string;

  /**
   * Tailwind classes applied to the marker text.
   */
  className?: string;

  /**
   * Tooltip and accessible name for the marker.
   */
  label: string;
}

/**
 * Renders a git change status marker in square brackets after a file name.
 */
export function SidebarStatusMarker({ marker, className, label }: Props): JSX.Element {
  return (
    <span className={cn('shrink-0', className)} role="img" title={label} aria-label={label}>
      [{marker}]
    </span>
  );
}
