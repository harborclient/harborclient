import { Fragment, jsx } from './jsx-runtime.js';

export { Fragment };

/**
 * Development JSX transform entry; delegates to the production jsx helper.
 *
 * @param {import('react').ElementType} type - Element type or Fragment sentinel.
 * @param {Record<string, unknown> | null | undefined} props - Element props.
 * @param {string | number | undefined} key - React key when provided by the compiler.
 * @returns {import('react').ReactElement}
 */
export function jsxDEV(type, props, key) {
  return jsx(type, props, key);
}
