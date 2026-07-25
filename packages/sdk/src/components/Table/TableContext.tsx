import { createContext } from '@harborclient/sdk/react';

/**
 * Layout preset for {@link Table} and its subcomponents.
 */
export type TableVariant = 'bordered' | 'loose';

/**
 * Default header cell classes for bordered editor tables.
 */
export const tableHeadClass =
  'border-r border-b border-separator p-3 text-left text-[14px] font-medium uppercase tracking-wide text-muted last:border-r-0';

/**
 * Default body cell classes for bordered editor tables.
 */
export const tableCellClass = 'border-r border-b border-separator p-3 last:border-r-0';

/**
 * Header cell classes for loose tables with separate cell spacing.
 */
export const tableHeadClassLoose =
  'pb-1 text-left text-[14px] font-medium uppercase tracking-wide text-muted';

/**
 * Body cell classes for loose tables with separate cell spacing.
 */
export const tableCellClassLoose = '';

export const TableVariantContext = createContext<TableVariant>('bordered');
