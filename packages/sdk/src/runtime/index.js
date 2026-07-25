import { requireHostReact, setHostReact } from './reactHost.js';

/**
 * Installs the HarborClient renderer React instance for plugin JSX and hooks.
 *
 * Call once at the start of `activate(hc)` before registering UI contributions.
 *
 * @param {typeof import('react')} react - React namespace from `hc.react`.
 */
export function installReact(react) {
  setHostReact(react);
}

/**
 * Creates a React component from a factory that receives the host React namespace.
 *
 * Useful when you need hooks or createElement in the same module as activate()
 * without importing React directly.
 *
 * @template {Record<string, unknown>} P
 * @param {(react: typeof import('react')) => import('react').ComponentType<P>} factory
 * @returns {import('react').ComponentType<P>}
 */
export function createPluginComponent(factory) {
  /** @type {import('react').ComponentType<P> | null} */
  let Component = null;

  /**
   * Lazily builds the component on first render after installReact().
   *
   * @param {P} props - Component props.
   * @returns {import('react').ReactElement | null}
   */
  function PluginComponent(props) {
    if (Component == null) {
      Component = factory(requireHostReact());
    }
    const react = requireHostReact();
    return react.createElement(Component, props);
  }

  return PluginComponent;
}

/**
 * Registers a custom appearance theme. The returned disposable is tracked
 * automatically by the host.
 *
 * @param {import('../types').PluginContext} hc - Renderer plugin context.
 * @param {import('../types').ThemeContribution} theme - Theme definition; `theme.id` must match `contributes.themes`.
 * @returns {import('../types').Disposable} Disposable that unregisters the theme.
 */
export function registerTheme(hc, theme) {
  return hc.themes.register(theme);
}

/**
 * Registers a File -> Import handler. The returned disposable is tracked
 * automatically by the host.
 *
 * @param {import('../types').PluginContext} hc - Renderer plugin context.
 * @param {string | string[]} extensions - File extensions such as `.json` or `yaml`.
 * @param {import('../types').ImportHandler} handler - Import detection and execution callbacks.
 * @returns {import('../types').Disposable} Disposable that unregisters the handler.
 */
export function registerImportHandler(hc, extensions, handler) {
  return hc.imports.registerHandler(extensions, handler);
}

/**
 * Identity helper that applies `ThemeContribution` typing to a theme literal.
 *
 * @param {import('../types').ThemeContribution} theme - Theme definition.
 * @returns {import('../types').ThemeContribution} The same theme, typed.
 */
export function defineTheme(theme) {
  return theme;
}
