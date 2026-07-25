import type * as React from 'react';

export { Fragment } from './jsx-runtime.js';

/**
 * Development JSX runtime entry; delegates to the production jsx helper.
 */
export function jsxDEV(
  type: React.ElementType,
  props: Record<string, unknown> | null | undefined,
  key?: string | number
): React.ReactElement;
