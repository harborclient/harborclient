import type * as ReactNamespace from 'react';
import type * as ReactDOMNamespace from 'react-dom';

declare global {
  /**
   * Host React instance shared with dynamically imported plugin bundles.
   */
  var __HARBORCLIENT_REACT__: typeof ReactNamespace | undefined;

  /**
   * Host React DOM instance shared with dynamically imported plugin bundles.
   */
  var __HARBORCLIENT_REACT_DOM__: typeof ReactDOMNamespace | undefined;
}

/**
 * Publishes the renderer host React instances for plugin shim modules.
 *
 * Plugin bundles import shims instead of bare `react` specifiers because blob-URL
 * dynamic imports cannot resolve npm packages. Shims read these globals so they work
 * in production builds where Vite inlines shim source as `data:` URLs.
 *
 * @param react - Same React module instance used by the HarborClient renderer.
 * @param reactDom - Same React DOM module instance used by the HarborClient renderer.
 */
export function installPluginReactHost(
  react: typeof ReactNamespace,
  reactDom: typeof ReactDOMNamespace
): void {
  globalThis.__HARBORCLIENT_REACT__ = react;
  globalThis.__HARBORCLIENT_REACT_DOM__ = reactDom;
}

/**
 * Returns the installed host React instance for plugin shims and tests.
 *
 * @returns Host React module reference.
 * @throws When {@link installPluginReactHost} has not run yet.
 */
export function getPluginReactHost(): typeof ReactNamespace {
  const react = globalThis.__HARBORCLIENT_REACT__;
  if (!react) {
    throw new Error('Plugin React host is not installed.');
  }
  return react;
}

/**
 * Returns the installed host React DOM instance for plugin shims and tests.
 *
 * @returns Host React DOM module reference.
 * @throws When {@link installPluginReactHost} has not run yet.
 */
export function getPluginReactDomHost(): typeof ReactDOMNamespace {
  const reactDom = globalThis.__HARBORCLIENT_REACT_DOM__;
  if (!reactDom) {
    throw new Error('Plugin React DOM host is not installed.');
  }
  return reactDom;
}
