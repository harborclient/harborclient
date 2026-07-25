import { requireHostReact } from './reactHost.js';

/**
 * Sentinel value compiled from JSX fragments; resolved to host React.Fragment at runtime.
 */
export const Fragment = Symbol.for('@harborclient/sdk.Fragment');

/**
 * Builds a React element using the installed host React instance.
 *
 * @param {import('react').ElementType} type - Element type or Fragment sentinel.
 * @param {Record<string, unknown> | null | undefined} props - Element props.
 * @param {string | number | undefined} key - React key when provided by the compiler.
 * @returns {import('react').ReactElement}
 */
function build(type, props, key) {
  const react = requireHostReact();
  const elementType = type === Fragment ? react.Fragment : type;
  const { children, ...rest } = props ?? {};
  if (key !== undefined) {
    rest.key = key;
  }
  return react.createElement(elementType, rest, children);
}

/** @type {typeof import('react/jsx-runtime').jsx} */
export const jsx = build;

/** @type {typeof import('react/jsx-runtime').jsxs} */
export const jsxs = build;
