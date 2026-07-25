import * as React from 'react';

export const Fragment = React.Fragment;

/**
 * Builds a React element using the externalized host React directly.
 *
 * Used when bundling third-party deps (e.g. @uiw/react-codemirror,
 * @fortawesome/react-fontawesome) that import `react/jsx-runtime`. Aliasing
 * those imports to this module keeps them on the same host React instance as
 * the plugin shell without requiring installReact() to have run first.
 *
 * @param {import('react').ElementType} type - Element type or Fragment.
 * @param {Record<string, unknown> | null | undefined} props - Element props.
 * @param {string | number | undefined} key - React key when provided by the compiler.
 * @returns {import('react').ReactElement}
 */
function build(type, props, key) {
  const { children, ...rest } = props ?? {};
  if (key !== undefined) {
    rest.key = key;
  }
  return React.createElement(type, props === null ? props : rest, children);
}

/** @type {typeof import('react/jsx-runtime').jsx} */
export const jsx = build;

/** @type {typeof import('react/jsx-runtime').jsxs} */
export const jsxs = build;

/**
 * Development JSX transform entry; delegates to the production jsx helper.
 *
 * @param {import('react').ElementType} type - Element type or Fragment.
 * @param {Record<string, unknown> | null | undefined} props - Element props.
 * @param {string | number | undefined} key - React key when provided by the compiler.
 * @returns {import('react').ReactElement}
 */
export function jsxDEV(type, props, key) {
  return build(type, props, key);
}
