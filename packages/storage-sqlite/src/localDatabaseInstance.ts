import { LocalDatabase } from './LocalDatabase';

let instance: LocalDatabase | null = null;

/**
 * Opens the local registry singleton and returns it.
 *
 * @param userDataPath - Electron app userData path for the registry file.
 */
export async function initLocalDatabase(userDataPath: string): Promise<LocalDatabase> {
  if (instance) {
    await instance.init();
    return instance;
  }

  const database = new LocalDatabase(userDataPath);
  await database.init();
  instance = database;
  return database;
}

/**
 * Returns the initialized local registry singleton.
 */
export function getLocalDatabase(): LocalDatabase {
  if (!instance) {
    throw new Error('Local registry not initialized');
  }
  return instance;
}

/**
 * Installs a registry instance for unit tests.
 *
 * @param database - Registry to use as the singleton.
 */
export function setLocalDatabaseForTesting(database: LocalDatabase): void {
  instance = database;
}

/**
 * Clears the registry singleton for unit tests.
 */
export function clearLocalDatabaseForTesting(): void {
  instance = null;
}
