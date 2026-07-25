import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /**
   * Action buttons rendered in a right-aligned row.
   */
  children: ReactNode;

  /**
   * When true, adds top margin before the action row (common in modal bodies).
   */
  spaced?: boolean;
}

/**
 * Right-aligned action button row for modal bodies and overlay footers.
 */
export function ModalFooter({ children, spaced = false, className, ...props }: Props): JSX.Element {
  return (
    <div
      {...props}
      className={cn('hc-modal-footer flex justify-end gap-2', spaced && 'mt-4', className)}
    >
      {children}
    </div>
  );
}
