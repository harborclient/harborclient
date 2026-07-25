import { useContext } from '@harborclient/sdk/react';
import type { ComponentPropsWithoutRef, JSX } from 'react';
import { cn } from '../utils.js';
import { TableVariantContext, tableCellClass, tableCellClassLoose } from './TableContext.js';

type Props = ComponentPropsWithoutRef<'td'>;

/**
 * Body cell with table styling for the active variant.
 */
export function TableCell({ children, className, ...props }: Props): JSX.Element {
  const variant = useContext(TableVariantContext);

  return (
    <td
      {...props}
      className={cn(
        'hc-table-cell',
        variant === 'loose' ? tableCellClassLoose : tableCellClass,
        className
      )}
    >
      {children}
    </td>
  );
}
