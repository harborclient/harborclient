import { createElement } from '@harborclient/sdk/react';
import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';
import { type TableVariant, TableVariantContext } from './TableContext.js';

export type { TableVariant } from './TableContext.js';
export {
  tableCellClass,
  tableCellClassLoose,
  tableHeadClass,
  tableHeadClassLoose
} from './TableContext.js';
export { TableBody } from './TableBody.js';
export { TableCell } from './TableCell.js';
export { TableHead } from './TableHead.js';
export { TableHeader } from './TableHeader.js';

interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'> {
  /**
   * Table header and body sections.
   */
  children: ReactNode;

  /**
   * Layout preset for the table shell and cell styling.
   */
  variant?: TableVariant;

  /**
   * Additional Tailwind classes merged onto the outer wrapper or table element.
   */
  className?: string;
}

/**
 * Table shell for editable row layouts.
 */
export function Table({ children, variant = 'bordered', className, ...props }: Props): JSX.Element {
  if (variant === 'loose') {
    return createElement(
      TableVariantContext.Provider,
      { value: variant },
      createElement(
        'table',
        {
          ...props,
          className: cn(
            'hc-table w-full border-separate border-spacing-x-1.5 border-spacing-y-1.5',
            className
          )
        },
        children
      )
    );
  }

  return createElement(
    TableVariantContext.Provider,
    { value: variant },
    createElement(
      'div',
      {
        ...props,
        className: cn('hc-table overflow-hidden rounded-lg border border-separator', className)
      },
      createElement('table', { className: 'hc-table-element w-full border-collapse' }, children)
    )
  );
}
