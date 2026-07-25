import type * as React from 'react';

/**
 * Host React fragment, resolved from the externalized `react` module at runtime.
 */
export declare const Fragment: React.ExoticComponent<{ children?: React.ReactNode }>;

/**
 * Automatic JSX runtime entry for third-party deps aliased to this module.
 */
export function jsx(
  type: React.ElementType,
  props: Record<string, unknown> | null | undefined,
  key?: string | number
): React.ReactElement;

/**
 * Automatic JSX runtime entry for elements with multiple children.
 */
export function jsxs(
  type: React.ElementType,
  props: Record<string, unknown> | null | undefined,
  key?: string | number
): React.ReactElement;

/**
 * Development JSX transform entry; delegates to {@link jsx}.
 */
export function jsxDEV(
  type: React.ElementType,
  props: Record<string, unknown> | null | undefined,
  key?: string | number
): React.ReactElement;

export namespace JSX {
  interface Element extends React.JSX.Element {}
  interface ElementClass extends React.JSX.ElementClass {}
  interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty {}
  interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
  type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
  interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
  interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
  interface IntrinsicElements extends React.JSX.IntrinsicElements {}
}
