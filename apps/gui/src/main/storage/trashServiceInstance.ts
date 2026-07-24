import type { IStorage } from './IStorage';
import { getLocalDatabase } from './localDatabaseInstance';
import { TrashService } from './TrashService';

let instance: TrashService | null = null;

/**
 * Creates the trash service singleton used by IPC delete handlers.
 *
 * @param storage - Routed storage facade backing sidebar entities.
 */
export function initTrashService(storage: IStorage): TrashService {
  instance = new TrashService(storage, getLocalDatabase());
  return instance;
}

/**
 * Returns the initialized trash service singleton.
 */
export function getTrashService(): TrashService {
  if (!instance) {
    throw new Error('Trash service not initialized');
  }
  return instance;
}

/**
 * Clears the trash service singleton for unit tests.
 */
export function clearTrashServiceForTesting(): void {
  instance = null;
}
