import type { IDatabase } from '#/main/db/IDatabase';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for named variable environment CRUD.
 *
 * @param db - Database instance backing environment persistence.
 */
export function registerEnvironmentHandlers(db: IDatabase): void {
  // Lists all named variable environments.
  handle('environments:list', ipcArgSchemas.none, () => db.listEnvironments());

  // Creates a new environment with the given display name.
  handle('environments:create', ipcArgSchemas.name, (_event, environmentName) =>
    db.createEnvironment(environmentName)
  );

  // Updates an environment's name and variables.
  handle(
    'environments:update',
    ipcArgSchemas.environmentUpdate,
    (_event, id, environmentName, variables) => db.updateEnvironment(id, environmentName, variables)
  );

  // Deletes an environment by id.
  handle('environments:delete', ipcArgSchemas.dbId, (_event, id) => db.deleteEnvironment(id));
}
