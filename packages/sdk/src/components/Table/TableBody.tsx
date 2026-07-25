import { useContext } from '@harborclient/sdk/react';
import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';
import { TableVariantContext } from './TableContext.js';

interface Props extends ComponentPropsWithoutRef<'tbody'> {
  /**
   * Header or body row content.
   */
  children: ReactNode;
}

/**
 * Table body section wrapper.
 */
export function TableBody({ children, className, ...props }: Props): JSX.Element {
  const variant = useContext(TableVariantContext);

  return (
    <tbody
      {...props}
      className={cn(
        variant === 'bordered' ? 'hc-table-body [&_tr:last-child_td]:border-b-0' : 'hc-table-body',
        className
      )}
    >
      {children}
    </tbody>
  );
}
