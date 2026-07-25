import type * as React from 'react';

/**
 * Sentinel value compiled from JSX fragments; resolved to host React.Fragment at runtime.
 */
export declare const Fragment: unique symbol;

/**
 * Automatic JSX runtime entry used when `jsxImportSource` is `@harborclient/sdk`.
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
