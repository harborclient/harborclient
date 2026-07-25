import { useContext } from '@harborclient/sdk/react';
import type { ComponentPropsWithoutRef, JSX } from 'react';
import { cn } from '../utils.js';
import { TableVariantContext, tableHeadClass, tableHeadClassLoose } from './TableContext.js';

type Props = ComponentPropsWithoutRef<'th'>;

/**
 * Header cell with table styling for the active variant.
 */
export function TableHead({ children, className, scope = 'col', ...props }: Props): JSX.Element {
  const variant = useContext(TableVariantContext);

  return (
    <th
      {...props}
      scope={scope}
      className={cn(
        'hc-table-head',
        variant === 'loose' ? tableHeadClassLoose : tableHeadClass,
        className
      )}
    >
      {children}
    </th>
  );
}
