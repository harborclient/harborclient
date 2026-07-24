import { PluginDatabaseManager } from './PluginDatabaseManager';

let manager: PluginDatabaseManager | null = null;

/**
 * Registers the singleton plugin database manager for IPC and lifecycle hooks.
 *
 * @param instance - Initialized manager bound to userData.
 */
export function setPluginDatabaseManager(instance: PluginDatabaseManager): void {
  manager = instance;
}

/**
 * Returns the registered plugin database manager.
 *
 * @throws When handlers run before initialization.
 */
export function getPluginDatabaseManager(): PluginDatabaseManager {
  if (!manager) {
    throw new Error('PluginDatabaseManager is not initialized.');
  }
  return manager;
}

/**
 * Clears the singleton during tests.
 */
export function clearPluginDatabaseManagerForTesting(): void {
  manager = null;
}
