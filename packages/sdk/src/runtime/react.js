import { requireHostReact } from './reactHost.js';

/**
 * Returns a hook from the installed host React instance.
 *
 * @param {keyof typeof import('react')} name - Hook name on the React namespace.
 * @returns {unknown} Hook function from host React.
 */
function hook(name) {
  const react = requireHostReact();
  const fn = react[name];
  if (typeof fn !== 'function') {
    throw new Error(`React hook "${String(name)}" is not available on hc.react.`);
  }
  return fn;
}

/** @type {typeof import('react').useState} */
export function useState(initialState) {
  return hook('useState')(initialState);
}

/** @type {typeof import('react').useEffect} */
export function useEffect(effect, deps) {
  return hook('useEffect')(effect, deps);
}

/** @type {typeof import('react').useCallback} */
export function useCallback(callback, deps) {
  return hook('useCallback')(callback, deps);
}

/** @type {typeof import('react').useMemo} */
export function useMemo(factory, deps) {
  return hook('useMemo')(factory, deps);
}

/** @type {typeof import('react').useRef} */
export function useRef(initialValue) {
  return hook('useRef')(initialValue);
}

/** @type {typeof import('react').useSyncExternalStore} */
export function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
  return hook('useSyncExternalStore')(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Defers host React lookup until render so module-level `React.forwardRef(...)`
 * calls (e.g. from @fortawesome/react-fontawesome) work before activate().
 *
 * @type {typeof import('react').forwardRef}
 */
export function forwardRef(render) {
  /** @type {ReturnType<typeof import('react').forwardRef> | null} */
  let forwarded = null;

  /**
   * Lazily wraps the render function with host React.forwardRef on first render.
   *
   * @param {Record<string, unknown>} props - Component props.
   * @param {import('react').Ref<unknown>} ref - Ref forwarded from the parent.
   * @returns {import('react').ReactElement}
   */
  function LazyForwardRef(props, ref) {
    const react = requireHostReact();
    if (forwarded === null) {
      forwarded = react.forwardRef(render);
    }
    return react.createElement(forwarded, { ...props, ref });
  }

  const displayName = render.displayName ?? render.name ?? 'Component';
  LazyForwardRef.displayName = `ForwardRef(${displayName})`;

  return LazyForwardRef;
}

/** @type {typeof import('react').useImperativeHandle} */
export function useImperativeHandle(ref, create, deps) {
  return hook('useImperativeHandle')(ref, create, deps);
}

/** @type {typeof import('react').cloneElement} */
export function cloneElement(element, props, ...children) {
  return hook('cloneElement')(element, props, ...children);
}

/** @type {typeof import('react').isValidElement} */
export function isValidElement(element) {
  return hook('isValidElement')(element);
}

/** @type {typeof import('react').createContext} */
export function createContext(defaultValue) {
  return hook('createContext')(defaultValue);
}

/** @type {typeof import('react').useContext} */
export function useContext(context) {
  return hook('useContext')(context);
}

/** @type {typeof import('react').useId} */
export function useId() {
  return hook('useId')();
}

/** @type {typeof import('react').useLayoutEffect} */
export function useLayoutEffect(effect, deps) {
  return hook('useLayoutEffect')(effect, deps);
}

/** @type {typeof import('react').useReducer} */
export function useReducer(reducer, initialArg, init) {
  return hook('useReducer')(reducer, initialArg, init);
}

/** @type {typeof import('react').createElement} */
export function createElement(type, props, ...children) {
  return hook('createElement')(type, props, ...children);
}

/**
 * Defers host React lookup until render so module-level `React.memo(...)`
 * calls work before activate().
 *
 * @type {typeof import('react').memo}
 */
export function memo(Component, propsAreEqual) {
  /** @type {ReturnType<typeof import('react').memo> | null} */
  let Memoized = null;

  /**
   * Lazily wraps the component with host React.memo on first render.
   *
   * @param {Record<string, unknown>} props - Component props.
   * @returns {import('react').ReactElement}
   */
  function LazyMemo(props) {
    const react = requireHostReact();
    if (Memoized === null) {
      Memoized = react.memo(Component, propsAreEqual);
    }
    return react.createElement(Memoized, props);
  }

  const displayName =
    (typeof Component === 'function' ? (Component.displayName ?? Component.name) : null) ??
    'Component';
  LazyMemo.displayName = `Memo(${displayName})`;

  return LazyMemo;
}

/**
 * Named SDK React exports used as the Proxy target for the default export.
 */
const reactNamespace = {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
  forwardRef,
  useImperativeHandle,
  cloneElement,
  isValidElement,
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useReducer,
  createElement,
  memo
};

/**
 * Default React namespace for `import React from 'react'` when aliasing bare
 * `react` to `@harborclient/sdk/react`. Named exports are served from the SDK;
 * other properties fall back to the installed host React instance.
 */
const defaultExport = new Proxy(reactNamespace, {
  get(target, prop, receiver) {
    if (prop in target) {
      return Reflect.get(target, prop, receiver);
    }
    return requireHostReact()[prop];
  }
});

export default defaultExport;
