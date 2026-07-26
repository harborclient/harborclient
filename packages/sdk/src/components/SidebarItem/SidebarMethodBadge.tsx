import type { JSX } from 'react';
import { cn } from '../utils.js';
import { methodBadgeClass } from './sidebarItemClasses.js';

interface Props {
  /**
   * HTTP method name shown in the badge (e.g. GET, POST).
   */
  method: string;

  /**
   * When true, renders the method in uppercase with medium font weight.
   */
  uppercase?: boolean;

  /**
   * When false, renders the method in neutral theme text instead of per-method colors.
   */
  methodColors?: boolean;
}

/**
 * Renders a colored HTTP method badge for sidebar request and history rows.
 *
 * @param method - HTTP method name shown in the badge.
 * @param uppercase - When true, applies uppercase medium-weight styling.
 * @param methodColors - When false, uses neutral theme text instead of per-method colors.
 */
export function SidebarMethodBadge({
  method,
  uppercase = false,
  methodColors = true
}: Props): JSX.Element {
  return (
    <span
      className={cn(
        'shrink-0 px-1 py-px',
        uppercase && 'font-medium uppercase',
        methodBadgeClass(method, methodColors)
      )}
    >
      {method}
    </span>
  );
}
