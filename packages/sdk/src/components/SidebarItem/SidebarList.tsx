import type { JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

interface Props {
  /**
   * List rows. Each child should render as an `<li>` (e.g. {@link SidebarCommitItem} `as="li"`).
   */
  children: ReactNode;

  /**
   * Accessible name for the list when the section title is not sufficient.
   */
  'aria-label'?: string;

  /**
   * Additional classes merged onto the list element.
   */
  className?: string;
}

/**
 * Accessible list container for non-selectable sidebar rows.
 *
 * Wrap rows rendered with `as="li"` so each child is a `role="listitem"`.
 *
 * @example
 * ```tsx
 * <SidebarList aria-label="Commits">
 *   <SidebarCommitItem as="li" message="Fix auth" author="Alex" timestampLabel="2h ago" icon={faCodeBranch} />
 * </SidebarList>
 * ```
 */
export function SidebarList({ children, 'aria-label': ariaLabel, className }: Props): JSX.Element {
  return (
    <ul role="list" aria-label={ariaLabel} className={cn('m-0 list-none p-0', className)}>
      {children}
    </ul>
  );
}
