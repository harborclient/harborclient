import type { SearchAddon } from '@xterm/addon-search';
import type { Terminal } from '@xterm/xterm';

/**
 * One live terminal tab: xterm instance plus its search addon.
 */
interface TerminalRegistryEntry {
  /**
   * Active xterm.js instance.
   */
  terminal: Terminal;

  /**
   * Search addon loaded on {@link terminal}, when registered.
   */
  searchAddon?: SearchAddon;
}

/**
 * Global key so Vite HMR cannot split the registry across duplicate module instances.
 */
const REGISTRY_GLOBAL_KEY = '__hcTerminalRegistryEntries__';

/**
 * Returns the process-wide terminal registry map (survives HMR module reloads).
 *
 * @returns Mutable map of tab id → terminal entry.
 */
function getEntries(): Map<string, TerminalRegistryEntry> {
  const globalObject = globalThis as typeof globalThis & {
    [REGISTRY_GLOBAL_KEY]?: Map<string, TerminalRegistryEntry>;
  };
  if (globalObject[REGISTRY_GLOBAL_KEY] == null) {
    globalObject[REGISTRY_GLOBAL_KEY] = new Map();
  }
  return globalObject[REGISTRY_GLOBAL_KEY];
}

/**
 * Registers a live xterm instance so non-React code (for example AI tools) can read its buffer.
 *
 * @param id - Stable footer terminal tab id.
 * @param terminal - Active xterm.js instance for that tab.
 */
export function registerTerminalInstance(id: string, terminal: Terminal): void {
  const entries = getEntries();
  const existing = entries.get(id);
  entries.set(id, {
    terminal,
    searchAddon: existing?.searchAddon
  });
}

/**
 * Registers the search addon for one footer terminal tab.
 *
 * @param id - Stable footer terminal tab id.
 * @param searchAddon - Active {@link SearchAddon} for that tab.
 */
export function registerTerminalSearchAddon(id: string, searchAddon: SearchAddon): void {
  const entries = getEntries();
  const existing = entries.get(id);
  if (existing == null) {
    return;
  }
  entries.set(id, { ...existing, searchAddon });
}

/**
 * Removes a terminal tab from the registry when its xterm instance is disposed.
 *
 * @param id - Stable footer terminal tab id.
 */
export function unregisterTerminalInstance(id: string): void {
  const entries = getEntries();
  const existing = entries.get(id);
  existing?.searchAddon?.clearDecorations();
  entries.delete(id);
}

/**
 * Returns the live xterm instance for one footer terminal tab, if mounted.
 *
 * @param id - Stable footer terminal tab id.
 * @returns The registered xterm instance, or undefined when the tab is not mounted.
 */
export function getTerminalInstance(id: string): Terminal | undefined {
  return getEntries().get(id)?.terminal;
}

/**
 * Returns the search addon for one footer terminal tab, if mounted.
 *
 * @param id - Stable footer terminal tab id.
 * @returns The registered {@link SearchAddon}, or undefined when the tab is not mounted.
 */
export function getTerminalSearchAddon(id: string): SearchAddon | undefined {
  return getEntries().get(id)?.searchAddon;
}

/**
 * Removes every registered terminal instance. Intended for unit tests only.
 */
export function clearTerminalRegistry(): void {
  getEntries().clear();
}
