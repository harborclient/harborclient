import type { Terminal } from '@xterm/xterm';

/**
 * Live xterm instances keyed by footer terminal tab id.
 */
const terminalInstances = new Map<string, Terminal>();

/**
 * Registers a live xterm instance so non-React code (for example AI tools) can read its buffer.
 *
 * @param id - Stable footer terminal tab id.
 * @param terminal - Active xterm.js instance for that tab.
 */
export function registerTerminalInstance(id: string, terminal: Terminal): void {
  terminalInstances.set(id, terminal);
}

/**
 * Removes a terminal tab from the registry when its xterm instance is disposed.
 *
 * @param id - Stable footer terminal tab id.
 */
export function unregisterTerminalInstance(id: string): void {
  terminalInstances.delete(id);
}

/**
 * Returns the live xterm instance for one footer terminal tab, if mounted.
 *
 * @param id - Stable footer terminal tab id.
 * @returns The registered xterm instance, or undefined when the tab is not mounted.
 */
export function getTerminalInstance(id: string): Terminal | undefined {
  return terminalInstances.get(id);
}

/**
 * Removes every registered terminal instance. Intended for unit tests only.
 */
export function clearTerminalRegistry(): void {
  terminalInstances.clear();
}
