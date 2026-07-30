import type * as React from 'react';
import type * as ReactDOM from 'react-dom';

/**
 * Installs the HarborClient renderer React instance for plugin JSX and hooks.
 *
 * @param react - React namespace from the host.
 */
export function setHostReact(react: typeof React): void;

/**
 * Returns the installed host React instance.
 *
 * @returns Host React namespace.
 * @throws When {@link setHostReact} has not been called yet.
 */
export function requireHostReact(): typeof React;

/**
 * Installs the HarborClient renderer React DOM instance for plugin portals.
 *
 * @param reactDom - React DOM namespace from the host shim.
 */
export function setHostReactDom(reactDom: typeof ReactDOM): void;

/**
 * Returns the installed host React DOM instance.
 *
 * @returns Host React DOM namespace.
 * @throws When {@link setHostReactDom} has not been called yet.
 */
export function requireHostReactDom(): typeof ReactDOM;
