/**
 * Re-exports the host React DOM instance for plugin bundles that externalize `react-dom`.
 *
 * Registered via {@link patchPluginReactImports} so dynamically imported plugin
 * modules can resolve bare `react-dom` specifiers to the same instance as the main app.
 * Reads {@link globalThis.__HARBORCLIENT_REACT_DOM__} directly so packaged builds can
 * inline this file as a self-contained `data:` URL module.
 */
const ReactDOM = globalThis.__HARBORCLIENT_REACT_DOM__;
if (!ReactDOM) {
  throw new Error('Plugin React DOM host is not installed.');
}

export default ReactDOM;

export const {
  createPortal,
  flushSync,
  preconnect,
  prefetchDNS,
  preinit,
  preinitModule,
  preload,
  preloadModule,
  unstable_batchedUpdates,
  version
} = ReactDOM;
