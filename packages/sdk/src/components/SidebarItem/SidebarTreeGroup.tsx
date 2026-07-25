import type { JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

interface Props {
  /**
   * Child tree rows or nested groups.
   */
  children: ReactNode;

  /**
   * Stable id referenced by the parent treeitem's `aria-controls`.
   */
  id: string;

  /**
   * Additional classes merged onto the group element.
   */
  className?: string;
}

/**
 * Child region for an expanded folder treeitem.
 *
 * Renders `role="group"` and must use the same `id` passed to the parent
 * folder's `childrenId` / `aria-controls`.
 */
export function SidebarTreeGroup({ children, id, className }: Props): JSX.Element {
  return (
    <ul role="group" id={id} className={cn('m-0 list-none p-0', className)}>
      {children}
    </ul>
  );
}
