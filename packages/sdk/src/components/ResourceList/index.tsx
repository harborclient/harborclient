import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

export { ResourceListEmptyItem } from './ResourceListEmptyItem.js';
export { ResourceListPrimary } from './ResourceListPrimary.js';
export { ResourceListRow } from './ResourceListRow.js';

interface Props extends ComponentPropsWithoutRef<'ul'> {
  /**
   * List row elements, typically {@link ResourceListRow} items.
   */
  children: ReactNode;
}

/**
 * Vertical list shell used for bordered resource rows in settings and Team Hub.
 */
export function ResourceList({ children, className, ...props }: Props): JSX.Element {
  return (
    <ul
      {...props}
      className={cn('hc-resource-list m-0 flex list-none flex-col gap-[10px] p-0', className)}
    >
      {children}
    </ul>
  );
}
