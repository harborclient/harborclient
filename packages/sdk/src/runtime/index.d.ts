import type * as React from 'react';
import type { Disposable, ImportHandler, PluginContext, ThemeContribution } from '../types.js';

/**
 * Installs the HarborClient renderer React instance for plugin JSX and hooks.
 *
 * Call once at the start of `activate(hc)` before registering UI contributions.
 *
 * @param react - React namespace from `hc.react`.
 */
export function installReact(react: typeof React): void;

/**
 * Creates a React component from a factory that receives the host React namespace.
 *
 * @param factory - Builds a component type using hooks or createElement from host React.
 * @returns Component safe to pass to `hc.ui.register*` registration APIs.
 */
export function createPluginComponent<P extends Record<string, unknown>>(
  factory: (react: typeof React) => React.ComponentType<P>
): React.ComponentType<P>;

/**
 * Registers a custom appearance theme and tracks its disposable for cleanup.
 *
 * @param hc - Renderer plugin context.
 * @param theme - Theme definition; `theme.id` must match `contributes.themes`.
 * @returns Disposable that unregisters the theme.
 */
export function registerTheme(hc: PluginContext, theme: ThemeContribution): Disposable;

/**
 * Registers a File -> Import handler and tracks its disposable for cleanup.
 *
 * @param hc - Renderer plugin context.
 * @param extensions - File extensions such as `.json` or `yaml`.
 * @param handler - Import detection and execution callbacks.
 * @returns Disposable that unregisters the handler.
 */
export function registerImportHandler(
  hc: PluginContext,
  extensions: string | string[],
  handler: ImportHandler
): Disposable;

/**
 * Identity helper that applies `ThemeContribution` typing to a theme literal.
 *
 * @param theme - Theme definition.
 * @returns The same theme, typed.
 */
export function defineTheme(theme: ThemeContribution): ThemeContribution;
