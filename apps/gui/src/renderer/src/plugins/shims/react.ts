/**
 * Re-exports the host React instance for plugin bundles that externalize `react`.
 *
 * Registered via {@link patchPluginReactImports} so dynamically imported plugin
 * modules can resolve bare `react` specifiers to the same instance as the main app.
 * Reads {@link globalThis.__HARBORCLIENT_REACT__} directly so packaged builds can
 * inline this file as a self-contained `data:` URL module.
 */
const React = globalThis.__HARBORCLIENT_REACT__;
if (!React) {
  throw new Error('Plugin React host is not installed.');
}

export default React;

export const {
  Component,
  Fragment,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  version
} = React;
