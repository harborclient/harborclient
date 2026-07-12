import { BrowserWindow, dialog } from 'electron';
import { writeFile } from 'fs/promises';
import { maskVariablesForExport, validateEnvironmentExport } from '#/main/storage/collectionData';
import { mintFreshEnvironmentExportUuid, resolveImportUuid } from '#/main/storage/uuid';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import { handle } from '#/main/ipc/handle';
import { confirmDuplicateImport, openImportFile } from '#/main/ipc/handlers/importDialogs';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { getTrashService } from '#/main/storage/trashServiceInstance';
import type { Environment, EnvironmentExport, ImportAction } from '#/shared/types';

/**
 * Result of importing an environment from a portable export file.
 */
export interface EnvironmentImportResult {
  /**
   * Imported or updated environment.
   */
  environment: Environment;

  /**
   * Whether a new environment was created or an existing one was updated.
   */
  action: ImportAction;
}

/**
 * Looks up an existing environment by portable uuid.
 *
 * @param db - Database instance backing environment persistence.
 * @param uuid - Stable environment identifier from an export file.
 * @returns Matching environment, or undefined when not found.
 */
function findExistingEnvironment(db: IStorage, uuid: string): Environment | undefined {
  if (db instanceof RoutingStorage) {
    return db.findEnvironmentByUuid(uuid);
  }
  return undefined;
}

/**
 * Persists an imported environment export, deduplicating by uuid when present.
 *
 * @param db - Database instance backing environment persistence.
 * @param win - Focused browser window for duplicate-import prompts, if any.
 * @param data - Validated environment export payload.
 * @returns The created or updated environment with action, or null when canceled.
 */
export async function importEnvironmentData(
  db: IStorage,
  win: BrowserWindow | null,
  data: EnvironmentExport
): Promise<EnvironmentImportResult | null> {
  let payload = data;

  const importUuid = data.uuid?.trim();
  if (importUuid) {
    const existing = findExistingEnvironment(db, importUuid);
    if (existing) {
      const choice = await confirmDuplicateImport(win, 'environment', existing.name);
      if (choice === 'cancel') {
        return null;
      }
      if (choice === 'update') {
        const environment = await db.updateEnvironment(existing.id, data.name, data.variables);
        return { environment, action: 'updated' };
      }
      payload = mintFreshEnvironmentExportUuid(data);
    }
  }

  const targetUuid = resolveImportUuid(payload.uuid);
  const created = await db.createEnvironment(payload.name, targetUuid);
  const environment = await db.updateEnvironment(created.id, payload.name, payload.variables);
  return { environment, action: 'created' };
}

/**
 * Registers IPC handlers for named variable environment CRUD and import/export.
 *
 * @param db - Database instance backing environment persistence.
 */
export function registerEnvironmentHandlers(db: IStorage): void {
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
  handle('environments:delete', ipcArgSchemas.dbId, (_event, id) =>
    getTrashService().moveEnvironmentToTrash(id)
  );

  // Deep-copies an environment into a new record with a fresh uuid.
  handle('environments:duplicate', ipcArgSchemas.dbId, (_event, id) => {
    if (!(db instanceof RoutingStorage)) {
      throw new Error('Environment duplicate is unavailable.');
    }
    return db.duplicateEnvironment(id);
  });

  // Reorders environments in the sidebar.
  handle(
    'environments:reorder',
    ipcArgSchemas.environmentReorder,
    (_event, orderedEnvironmentIds) => {
      if (!(db instanceof RoutingStorage)) {
        throw new Error('Environment reorder is unavailable.');
      }
      return db.reorderEnvironments(orderedEnvironmentIds);
    }
  );

  // Exports an environment to a JSON file via a native save dialog.
  handle('environments:export', ipcArgSchemas.dbId, async (_event, id) => {
    const environments = await db.listEnvironments();
    const environment = environments.find((item) => item.id === id);
    if (!environment) {
      throw new Error(`Environment not found: ${id}`);
    }

    const data: EnvironmentExport = {
      harborclientVersion: 1,
      harborclientExport: 'environment',
      uuid: environment.uuid,
      name: environment.name,
      variables: maskVariablesForExport(environment.variables)
    };

    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      defaultPath: `${data.name}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    };
    const { canceled, filePath } = win
      ? await dialog.showSaveDialog(win, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (canceled || !filePath) {
      return { canceled: true };
    }

    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { canceled: false, path: filePath };
  });

  // Imports an environment from a JSON file selected via a native open dialog.
  handle('environments:import', ipcArgSchemas.none, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const file = await openImportFile(win);
    if (!file) {
      return null;
    }

    const exportData = validateEnvironmentExport(file.parsed);
    const result = await importEnvironmentData(db, win, exportData);
    return result?.environment ?? null;
  });
}
