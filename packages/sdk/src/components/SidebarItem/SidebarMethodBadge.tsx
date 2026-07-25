import type { JSX } from 'react';
import { cn } from '../utils.js';
import { METHOD_CLASSES } from './sidebarItemClasses.js';

interface Props {
  /**
   * HTTP method name shown in the badge (e.g. GET, POST).
   */
  method: string;

  /**
   * When true, renders the method in uppercase with medium font weight.
   */
  uppercase?: boolean;
}

/**
 * Renders a colored HTTP method badge for sidebar request and history rows.
 */
export function SidebarMethodBadge({ method, uppercase = false }: Props): JSX.Element {
  const methodKey = method.toLowerCase();
  const colorClass = METHOD_CLASSES[methodKey] ?? 'text-info';

  return (
    <span className={cn('shrink-0 px-1 py-px', uppercase && 'font-medium uppercase', colorClass)}>
      {method}
    </span>
  );
}
