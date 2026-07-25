/** Global key shared across bundled plugin copies of this module and the view host. */
const HOST_REACT_GLOBAL_KEY = '__HARBORCLIENT_HOST_REACT__';

/** Global key for the host React DOM instance (createPortal, etc.). */
const HOST_REACT_DOM_GLOBAL_KEY = '__HARBORCLIENT_HOST_REACT_DOM__';

/** @type {typeof import('react') | null} */
let hostReact = null;

/** @type {typeof import('react-dom') | null} */
let hostReactDom = null;

/**
 * Reads the host React instance published on globalThis by the view host bootstrap.
 *
 * @returns {typeof import('react') | null} Host React when available.
 */
function readGlobalHostReact() {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  const candidate = globalThis[HOST_REACT_GLOBAL_KEY];
  return candidate ?? null;
}

/**
 * Installs the HarborClient renderer React instance for plugin JSX and hooks.
 *
 * @param {typeof import('react')} react - React namespace from `hc.react`.
 */
export function setHostReact(react) {
  hostReact = react;
  if (typeof globalThis !== 'undefined') {
    globalThis[HOST_REACT_GLOBAL_KEY] = react;
  }
}

/**
 * Returns the installed host React instance.
 *
 * Bundled plugins ship their own copy of this module; the view host publishes
 * React on globalThis before importing bundle.js so module-scope SDK hooks work.
 *
 * @returns {typeof import('react')} Host React namespace.
 * @throws {Error} When {@link setHostReact} has not been called yet.
 */
export function requireHostReact() {
  if (hostReact == null) {
    const globalReact = readGlobalHostReact();
    if (globalReact != null) {
      hostReact = globalReact;
    }
  }
  if (hostReact == null) {
    throw new Error(
      'Plugin React host is not installed. Call installReact(hc.react) at the start of activate().'
    );
  }
  return hostReact;
}

/**
 * Reads the host React DOM instance published on globalThis by the view host bootstrap.
 *
 * @returns {typeof import('react-dom') | null} Host React DOM when available.
 */
function readGlobalHostReactDom() {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  const candidate = globalThis[HOST_REACT_DOM_GLOBAL_KEY];
  return candidate ?? null;
}

/**
 * Installs the HarborClient renderer React DOM instance for plugin portals.
 *
 * @param {typeof import('react-dom')} reactDom - React DOM namespace from the host shim.
 */
export function setHostReactDom(reactDom) {
  hostReactDom = reactDom;
  if (typeof globalThis !== 'undefined') {
    globalThis[HOST_REACT_DOM_GLOBAL_KEY] = reactDom;
  }
}

/**
 * Returns the installed host React DOM instance.
 *
 * @returns {typeof import('react-dom')} Host React DOM namespace.
 * @throws {Error} When {@link setHostReactDom} has not been called yet.
 */
export function requireHostReactDom() {
  if (hostReactDom == null) {
    const globalReactDom = readGlobalHostReactDom();
    if (globalReactDom != null) {
      hostReactDom = globalReactDom;
    }
  }
  if (hostReactDom == null) {
    throw new Error(
      'Plugin React DOM host is not installed. The view host must call setHostReactDom() before activate().'
    );
  }
  return hostReactDom;
}
